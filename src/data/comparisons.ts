import {
  adoptionPhaseDistribution,
  isActive,
} from './metrics'
import { organizationGroupFor } from './organizationGroups'
import { SURFACE_DEFINITIONS, type SurfaceKey } from './surfaces'
import type { CustomizationTotal, EntityAliases, UserDay } from './types'

export const ADOPTION_BUCKETS = [
  'Phase 4',
  'Phase 3',
  'Phase 2',
  'Phase 1',
  'No Cohort',
  'Unknown',
] as const

export type AdoptionBucket = (typeof ADOPTION_BUCKETS)[number]

export const TOOL_COLUMNS = SURFACE_DEFINITIONS.map(({ key, label }) => ({ key, label }))

export type ToolKey = SurfaceKey

export const CUSTOMIZATION_COLUMNS = [
  { key: 'mcp', label: 'MCP' },
  { key: 'customAgent', label: 'Custom agent' },
  { key: 'skill', label: 'Skill' },
  { key: 'plugin', label: 'Plugin' },
  { key: 'slashCommand', label: 'Slash command' },
] as const

export type CustomizationKey = (typeof CUSTOMIZATION_COLUMNS)[number]['key']

interface ComparisonRow {
  key: string
  label: string
}

export interface AdoptionComparisonRow extends ComparisonRow {
  phases: Record<AdoptionBucket, { percentage: number; users: number }>
}

export interface CreditComparisonRow extends ComparisonRow {
  usage: number | null
  deviation: number | null
}

export interface ToolComparisonRow extends ComparisonRow {
  usage: Record<ToolKey, number>
}

export interface CustomizationComparisonRow extends ComparisonRow {
  usage: Record<CustomizationKey, { mean: number; total: number }>
}

export interface FeaturePreferenceRow extends ComparisonRow {
  shares: Record<string, number | null>
}

export interface LocComparisonRow extends ComparisonRow {
  locAdded: number
  locDeleted: number
  locAddedPerUser: number
  locDeletedPerUser: number
}

export interface OrganizationComparisons {
  adoption: AdoptionComparisonRow[]
  credits: {
    total: CreditComparisonRow[]
    perUser: CreditComparisonRow[]
    dailyPerActiveUser: CreditComparisonRow[]
  }
  tools: ToolComparisonRow[]
  customizations: CustomizationComparisonRow[]
  featureColumns: string[]
  featurePreferences: FeaturePreferenceRow[]
  loc: LocComparisonRow[]
}

interface Group {
  key: string
  label: string
  records: UserDay[]
  users: Set<number>
}

interface GroupMetrics {
  group: Group
  totalCredits: number | null
  creditsPerUser: number | null
  creditsPerUserDeviation: number | null
  dailyCreditsPerActiveUser: number | null
  dailyCreditsPerActiveUserDeviation: number | null
}

function groupRecords(records: UserDay[], aliases?: EntityAliases): Group[] {
  const groups = new Map<string, Group>()
  for (const record of records) {
    const identity = organizationGroupFor(record, aliases)
    let group = groups.get(identity.key)
    if (!group) {
      group = { key: identity.key, label: identity.label, records: [], users: new Set() }
      groups.set(identity.key, group)
    }
    group.records.push(record)
    group.users.add(record.userId)
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label))
}

function emptyAdoptionCounts(): Record<AdoptionBucket, { percentage: number; users: number }> {
  return {
    'Phase 4': { percentage: 0, users: 0 },
    'Phase 3': { percentage: 0, users: 0 },
    'Phase 2': { percentage: 0, users: 0 },
    'Phase 1': { percentage: 0, users: 0 },
    'No Cohort': { percentage: 0, users: 0 },
    Unknown: { percentage: 0, users: 0 },
  }
}

function adoptionBucket(phaseNumber: number | undefined): AdoptionBucket {
  if (phaseNumber === 4) return 'Phase 4'
  if (phaseNumber === 3) return 'Phase 3'
  if (phaseNumber === 2) return 'Phase 2'
  if (phaseNumber === 1) return 'Phase 1'
  if (phaseNumber === 0) return 'No Cohort'
  return 'Unknown'
}

function adoptionRows(groups: Group[]): AdoptionComparisonRow[] {
  const rows = groups.map((group) => {
    const phases = emptyAdoptionCounts()
    for (const phase of adoptionPhaseDistribution(group.records)) {
      phases[adoptionBucket(phase.phaseNumber)].users += phase.users
    }
    for (const bucket of ADOPTION_BUCKETS) {
      phases[bucket].percentage = (phases[bucket].users / group.users.size) * 100
    }
    return { key: group.key, label: group.label, phases }
  })

  return rows.sort((a, b) => {
    for (const bucket of ADOPTION_BUCKETS) {
      const difference = b.phases[bucket].percentage - a.phases[bucket].percentage
      if (difference !== 0) return difference
    }
    return a.label.localeCompare(b.label)
  })
}

function populationStats(values: number[]): { mean: number | null; deviation: number | null } {
  if (values.length === 0) return { mean: null, deviation: null }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  return { mean, deviation: Math.sqrt(variance) }
}

function creditRows(
  groups: GroupMetrics[],
  pickUsage: (group: GroupMetrics) => number | null,
  pickDeviation?: (group: GroupMetrics) => number | null,
): CreditComparisonRow[] {
  return groups
    .map((group) => {
      return {
        key: group.group.key,
        label: group.group.label,
        usage: pickUsage(group),
        deviation: pickDeviation?.(group) ?? null,
      }
    })
    .sort((a, b) => {
      if (a.usage === null) return b.usage === null ? a.label.localeCompare(b.label) : 1
      if (b.usage === null) return -1
      return b.usage - a.usage || a.label.localeCompare(b.label)
    })
}

function creditMetrics(group: Group): Omit<GroupMetrics, 'group'> {
  const creditsByUser = new Map<number, number>()
  const daily = new Map<string, { credits: number; activeUsers: Set<number> }>()

  for (const record of group.records) {
    if (!record.aiCreditsReported) continue

    creditsByUser.set(record.userId, (creditsByUser.get(record.userId) ?? 0) + record.aiCredits)

    let day = daily.get(record.day)
    if (!day) {
      day = { credits: 0, activeUsers: new Set() }
      daily.set(record.day, day)
    }
    day.credits += record.aiCredits
    if (isActive(record)) day.activeUsers.add(record.userId)
  }

  const userTotals = [...creditsByUser.values()]
  const perUser = populationStats(userTotals)
  const dailyPerActiveUser = populationStats(
    [...daily.values()]
      .filter((day) => day.activeUsers.size > 0)
      .map((day) => day.credits / day.activeUsers.size),
  )

  return {
    totalCredits: userTotals.length > 0 ? userTotals.reduce((sum, value) => sum + value, 0) : null,
    creditsPerUser: perUser.mean,
    creditsPerUserDeviation: perUser.deviation,
    dailyCreditsPerActiveUser: dailyPerActiveUser.mean,
    dailyCreditsPerActiveUserDeviation: dailyPerActiveUser.deviation,
  }
}

function toolRows(groups: Group[]): ToolComparisonRow[] {
  return groups.map((group) => {
    const users: Record<ToolKey, Set<number>> = {
      agent: new Set(),
      chat: new Set(),
      cli: new Set(),
      vscodeAgent: new Set(),
      copilotApp: new Set(),
      codeReviewActive: new Set(),
      codeReviewPassive: new Set(),
      cloudAgent: new Set(),
    }

    for (const record of group.records) {
      for (const surface of SURFACE_DEFINITIONS) {
        if (surface.isUsed(record)) {
          users[surface.key].add(record.userId)
        }
      }
    }

    return {
      key: group.key,
      label: group.label,
      usage: {
        agent: (users.agent.size / group.users.size) * 100,
        chat: (users.chat.size / group.users.size) * 100,
        cli: (users.cli.size / group.users.size) * 100,
        vscodeAgent: (users.vscodeAgent.size / group.users.size) * 100,
        copilotApp: (users.copilotApp.size / group.users.size) * 100,
        codeReviewActive: (users.codeReviewActive.size / group.users.size) * 100,
        codeReviewPassive: (users.codeReviewPassive.size / group.users.size) * 100,
        cloudAgent: (users.cloudAgent.size / group.users.size) * 100,
      },
    }
  })
}

function customizationTotal(records: UserDay[], pick: (record: UserDay) => CustomizationTotal[]): number {
  let total = 0
  for (const record of records) {
    for (const item of pick(record)) total += item.interactionCount
  }
  return total
}

function customizationRows(groups: Group[]): CustomizationComparisonRow[] {
  return groups.map((group) => {
    const totals: Record<CustomizationKey, number> = {
      mcp: customizationTotal(group.records, (record) => record.totalsByMcp),
      customAgent: customizationTotal(group.records, (record) => record.totalsByCustomAgent),
      skill: customizationTotal(group.records, (record) => record.totalsBySkill),
      plugin: customizationTotal(group.records, (record) => record.totalsByPlugin),
      slashCommand: customizationTotal(group.records, (record) => record.totalsBySlashCmd),
    }
    const perUser = (total: number) => total / group.users.size

    return {
      key: group.key,
      label: group.label,
      usage: {
        mcp: { mean: perUser(totals.mcp), total: totals.mcp },
        customAgent: { mean: perUser(totals.customAgent), total: totals.customAgent },
        skill: { mean: perUser(totals.skill), total: totals.skill },
        plugin: { mean: perUser(totals.plugin), total: totals.plugin },
        slashCommand: { mean: perUser(totals.slashCommand), total: totals.slashCommand },
      },
    }
  })
}

function featurePreferenceRows(
  groups: Group[],
  limit: number,
): { columns: string[]; rows: FeaturePreferenceRow[] } {
  const totalByFeature = new Map<string, number>()
  for (const group of groups) {
    for (const record of group.records) {
      for (const feature of record.totalsByFeature) {
        totalByFeature.set(feature.name, (totalByFeature.get(feature.name) ?? 0) + feature.interactions)
      }
    }
  }

  const ranked = [...totalByFeature.entries()].sort(
    ([nameA, totalA], [nameB, totalB]) => totalB - totalA || nameA.localeCompare(nameB),
  )
  const top = ranked.slice(0, limit).map(([name]) => name)
  const hasOther = ranked.length > limit
  const columns = hasOther ? [...top, 'Other'] : top
  const topSet = new Set(top)

  const rows = groups.map((group) => {
    const interactions: Record<string, number> = Object.fromEntries(columns.map((name) => [name, 0]))
    for (const record of group.records) {
      for (const feature of record.totalsByFeature) {
        const key = topSet.has(feature.name) ? feature.name : hasOther ? 'Other' : feature.name
        interactions[key] = (interactions[key] ?? 0) + feature.interactions
      }
    }
    const total = Object.values(interactions).reduce((sum, value) => sum + value, 0)
    const shares: Record<string, number | null> = {}
    for (const column of columns) {
      shares[column] = total > 0 ? ((interactions[column] ?? 0) / total) * 100 : null
    }
    return { key: group.key, label: group.label, shares }
  })

  return { columns, rows }
}

function locRows(groups: Group[]): LocComparisonRow[] {
  return groups
    .map((group) => {
      let locAdded = 0
      let locDeleted = 0
      for (const record of group.records) {
        locAdded += record.locAdded
        locDeleted += record.locDeleted
      }
      return {
        key: group.key,
        label: group.label,
        locAdded,
        locDeleted,
        locAddedPerUser: locAdded / group.users.size,
        locDeletedPerUser: locDeleted / group.users.size,
      }
    })
    .sort(
      (a, b) =>
        b.locAddedPerUser +
          b.locDeletedPerUser -
          (a.locAddedPerUser + a.locDeletedPerUser) ||
        b.locAdded + b.locDeleted - (a.locAdded + a.locDeleted) ||
        a.label.localeCompare(b.label),
    )
}

export function compareOrganizationGroups(
  records: UserDay[],
  aliases?: EntityAliases,
  featureLimit = 7,
): OrganizationComparisons {
  const groups = groupRecords(records, aliases)
  const groupMetrics: GroupMetrics[] = groups.map((group) => ({ group, ...creditMetrics(group) }))
  const features = featurePreferenceRows(groups, featureLimit)

  return {
    adoption: adoptionRows(groups),
    credits: {
      total: creditRows(groupMetrics, (group) => group.totalCredits),
      perUser: creditRows(
        groupMetrics,
        (group) => group.creditsPerUser,
        (group) => group.creditsPerUserDeviation,
      ),
      dailyPerActiveUser: creditRows(
        groupMetrics,
        (group) => group.dailyCreditsPerActiveUser,
        (group) => group.dailyCreditsPerActiveUserDeviation,
      ),
    },
    tools: toolRows(groups),
    customizations: customizationRows(groups),
    featureColumns: features.columns,
    featurePreferences: features.rows,
    loc: locRows(groups),
  }
}
