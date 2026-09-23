import type { CustomizationTotal, FeatureTotal, UserDay } from './types'
import { distinctOrganizationGroups, organizationGroupKey } from './organizationGroups'

/**
 * Pure aggregations over already-filtered records. No React, no formatting —
 * this is the seam that future visualisations plug into.
 */

/**
 * A user-day counts as active when the user actually did something. In the
 * reference sample 338 of 790 records had zero interactions *and* zero
 * generations while still carrying AI credits, so "one record = one active day"
 * would overstate adoption by ~43%. Anywhere this number is shown, the rule is
 * shown with it.
 */
export const isActive = (r: UserDay): boolean => r.interactions > 0 || r.generations > 0

export interface Totals {
  activeUsers: number
  /** Distinct users appearing at all, active or not — the gap against activeUsers is the dormant seats. */
  usersSeen: number
  /** Records that met the active rule. */
  activeUserDays: number
  /** Every record in range, active or not. */
  records: number
  interactions: number
  generations: number
  acceptances: number
  /** acceptances / generations, or null when nothing was generated. */
  acceptanceRate: number | null
  locAdded: number
  locDeleted: number
  locSuggestedToAdd: number
  aiCredits: number
}

export interface DayPoint {
  date: string
  activeUsers: number
  interactions: number
  generations: number
  acceptances: number
  /** Percentage 0–100, or null on days with no generations — a gap, not a zero. */
  acceptanceRate: number | null
  aiCredits: number
}

export interface NamedTotal {
  name: string
  interactions: number
  generations: number
  acceptances: number
  locAdded: number
  aiCredits: number
  activeDays: number
}

export interface DateRange {
  start: string
  end: string
}

/**
 * `acceptances / generations` as a percentage. Null rather than 0 when there is
 * no denominator, so charts can leave a gap instead of drawing a false collapse.
 *
 * Note there is no LoC equivalent: `loc_added_sum` exceeds `loc_suggested_to_add_sum`
 * on 131 of 790 sample records (108% sample-wide), so lines added is a magnitude,
 * never a numerator.
 */
function rate(acceptances: number, generations: number): number | null {
  return generations > 0 ? (acceptances / generations) * 100 : null
}

export function totals(records: UserDay[]): Totals {
  const users = new Set<number>()
  const seen = new Set<number>()
  let activeUserDays = 0
  let interactions = 0
  let generations = 0
  let acceptances = 0
  let locAdded = 0
  let locDeleted = 0
  let locSuggestedToAdd = 0
  let aiCredits = 0

  for (const r of records) {
    interactions += r.interactions
    generations += r.generations
    acceptances += r.acceptances
    locAdded += r.locAdded
    locDeleted += r.locDeleted
    locSuggestedToAdd += r.locSuggestedToAdd
    aiCredits += r.aiCredits
    seen.add(r.userId)
    if (isActive(r)) {
      activeUserDays++
      users.add(r.userId)
    }
  }

  return {
    activeUsers: users.size,
    usersSeen: seen.size,
    activeUserDays,
    records: records.length,
    interactions,
    generations,
    acceptances,
    acceptanceRate: rate(acceptances, generations),
    locAdded,
    locDeleted,
    locSuggestedToAdd,
    aiCredits,
  }
}

export function dateRange(records: UserDay[]): DateRange | undefined {
  if (records.length === 0) return undefined
  let start = records[0]!.day
  let end = records[0]!.day
  for (const r of records) {
    if (r.day < start) start = r.day
    if (r.day > end) end = r.day
  }
  return { start, end }
}

/** Add `days` to a YYYY-MM-DD string, staying in UTC so DST never shifts a day. */
function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Daily series across the full observed span, including days with no activity —
 * otherwise an area chart silently closes gaps and overstates steady usage.
 */
export function byDay(records: UserDay[], bounds?: DateRange): DayPoint[] {
  interface Acc {
    users: Set<number>
    interactions: number
    generations: number
    acceptances: number
    aiCredits: number
  }
  const acc = new Map<string, Acc>()

  for (const r of records) {
    let a = acc.get(r.day)
    if (!a) {
      a = { users: new Set(), interactions: 0, generations: 0, acceptances: 0, aiCredits: 0 }
      acc.set(r.day, a)
    }
    a.interactions += r.interactions
    a.generations += r.generations
    a.acceptances += r.acceptances
    a.aiCredits += r.aiCredits
    if (isActive(r)) a.users.add(r.userId)
  }

  const range = bounds ?? dateRange(records)
  if (!range) return []

  const out: DayPoint[] = []
  // Guard against a pathological range blowing up the series.
  for (let d = range.start, i = 0; d <= range.end && i < 1000; d = addDays(d, 1), i++) {
    const a = acc.get(d)
    out.push({
      date: d,
      activeUsers: a?.users.size ?? 0,
      interactions: a?.interactions ?? 0,
      generations: a?.generations ?? 0,
      acceptances: a?.acceptances ?? 0,
      acceptanceRate: a ? rate(a.acceptances, a.generations) : null,
      aiCredits: a?.aiCredits ?? 0,
    })
  }
  return out
}

/**
 * Distinct users per day for each usage surface. `copilotCloudAgent` is a
 * logical OR of `usedCopilotCloudAgent` and `usedCopilotCodingAgent` — GitHub
 * documents these as backward-compatible names carrying the same signal, so
 * they must never be summed as if they were independent surfaces.
 */
export interface SurfaceDayPoint {
  date: string
  agent: number
  chat: number
  cli: number
  copilotCloudAgent: number
}

export function usersBySurfaceByDay(records: UserDay[], bounds?: DateRange): SurfaceDayPoint[] {
  interface Acc {
    agent: Set<number>
    chat: Set<number>
    cli: Set<number>
    copilotCloudAgent: Set<number>
  }
  const acc = new Map<string, Acc>()

  for (const r of records) {
    let a = acc.get(r.day)
    if (!a) {
      a = { agent: new Set(), chat: new Set(), cli: new Set(), copilotCloudAgent: new Set() }
      acc.set(r.day, a)
    }
    if (r.usedAgent) a.agent.add(r.userId)
    if (r.usedChat) a.chat.add(r.userId)
    if (r.usedCli) a.cli.add(r.userId)
    if (r.usedCopilotCloudAgent || r.usedCopilotCodingAgent) a.copilotCloudAgent.add(r.userId)
  }

  const range = bounds ?? dateRange(records)
  if (!range) return []

  const out: SurfaceDayPoint[] = []
  for (let d = range.start, i = 0; d <= range.end && i < 1000; d = addDays(d, 1), i++) {
    const a = acc.get(d)
    out.push({
      date: d,
      agent: a?.agent.size ?? 0,
      chat: a?.chat.size ?? 0,
      cli: a?.cli.size ?? 0,
      copilotCloudAgent: a?.copilotCloudAgent.size ?? 0,
    })
  }
  return out
}

/**
 * Interactions by feature, per day. Ranking is decided once over the whole
 * selected range so the same features stay the same series from one day to
 * the next; only the top `limit` keep their own series, and every other
 * feature's interactions for that day fold into `Other`. Every calendar day in
 * range is present, including zero-activity days, and every series value in a
 * `FeatureDayPoint` defaults to 0 rather than being omitted.
 */
export interface FeatureDayPoint {
  date: string
  /** Interactions keyed by feature name (top-ranked features) plus `Other` when folded features exist. */
  values: Record<string, number>
}

export interface FeatureInteractionsByDay {
  /** Ranked feature names carried as their own series, in descending-interaction rank order. */
  featureNames: string[]
  /** True when at least one feature was folded into `Other`. */
  hasOther: boolean
  points: FeatureDayPoint[]
}

export function interactionsByFeaturePerDay(
  records: UserDay[],
  bounds?: DateRange,
  limit = 7,
): FeatureInteractionsByDay {
  const totalByName = new Map<string, number>()
  for (const r of records) {
    for (const f of r.totalsByFeature) {
      totalByName.set(f.name, (totalByName.get(f.name) ?? 0) + f.interactions)
    }
  }
  const ranked = [...totalByName.entries()]
    .map(([name, interactions]) => ({ name, interactions }))
    .sort((a, b) => b.interactions - a.interactions || a.name.localeCompare(b.name))

  const featureNames = ranked.slice(0, limit).map((f) => f.name)
  const hasOther = ranked.length > limit
  const topSet = new Set(featureNames)

  const perDay = new Map<string, Map<string, number>>()
  for (const r of records) {
    let values = perDay.get(r.day)
    if (!values) {
      values = new Map()
      perDay.set(r.day, values)
    }
    for (const f of r.totalsByFeature) {
      const key = topSet.has(f.name) ? f.name : 'Other'
      values.set(key, (values.get(key) ?? 0) + f.interactions)
    }
  }

  const range = bounds ?? dateRange(records)
  const points: FeatureDayPoint[] = []
  if (range) {
    for (let d = range.start, i = 0; d <= range.end && i < 1000; d = addDays(d, 1), i++) {
      const dayValues = perDay.get(d)
      const values: Record<string, number> = {}
      for (const name of featureNames) values[name] = dayValues?.get(name) ?? 0
      if (hasOther) values.Other = dayValues?.get('Other') ?? 0
      points.push({ date: d, values })
    }
  }

  return { featureNames, hasOther, points }
}

/**
 * Population mean — the plain average, with an explicit 0 for an empty input
 * so callers that need a "no data" signal instead (e.g. `averageAiCredits`)
 * check their own denominator rather than trusting this fallback.
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

/**
 * Population standard deviation — `sqrt(sum((x - mean)^2) / N)`. The filtered
 * export is the full population being reported, not a sample, so this never
 * divides by `N - 1`.
 */
function popStdDev(values: number[]): number {
  if (values.length === 0) return 0
  const m = mean(values)
  const variance = values.reduce((a, x) => a + (x - m) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

/**
 * Mean and ±1 population-standard-deviation bounds for LoC added and deleted,
 * per day, across that day's user records. Bounds are chart-ready: the lower
 * bound is floored at 0 so the band never implies negative LoC.
 */
export interface LocDeviationDayPoint {
  date: string
  locAddedMean: number
  locAddedLower: number
  locAddedUpper: number
  locDeletedMean: number
  locDeletedLower: number
  locDeletedUpper: number
}

export function dailyLocDeviation(records: UserDay[], bounds?: DateRange): LocDeviationDayPoint[] {
  interface Acc {
    added: number[]
    deleted: number[]
  }
  const acc = new Map<string, Acc>()
  for (const r of records) {
    let a = acc.get(r.day)
    if (!a) {
      a = { added: [], deleted: [] }
      acc.set(r.day, a)
    }
    a.added.push(r.locAdded)
    a.deleted.push(r.locDeleted)
  }

  const range = bounds ?? dateRange(records)
  if (!range) return []

  const out: LocDeviationDayPoint[] = []
  for (let d = range.start, i = 0; d <= range.end && i < 1000; d = addDays(d, 1), i++) {
    const a = acc.get(d)
    const added = a?.added ?? []
    const deleted = a?.deleted ?? []
    const addedMean = mean(added)
    const addedStd = popStdDev(added)
    const deletedMean = mean(deleted)
    const deletedStd = popStdDev(deleted)
    out.push({
      date: d,
      locAddedMean: addedMean,
      locAddedLower: Math.max(0, addedMean - addedStd),
      locAddedUpper: addedMean + addedStd,
      locDeletedMean: deletedMean,
      locDeletedLower: Math.max(0, deletedMean - deletedStd),
      locDeletedUpper: deletedMean + deletedStd,
    })
  }
  return out
}

/** Added/deleted LoC attributed to one feature, model, or language name. */
export interface FeatureLocTotal {
  name: string
  locAdded: number
  locDeleted: number
}

/**
 * Sums `locAdded`/`locDeleted` from a compact breakdown array (feature, model,
 * or language) by name, ranked by combined LoC touched, descending, with a
 * deterministic name tie-break. An empty or entirely-absent breakdown across
 * every record yields an empty result — never invented attribution.
 */
function aggregateFeatureLoc(records: UserDay[], pick: (r: UserDay) => FeatureTotal[]): FeatureLocTotal[] {
  const acc = new Map<string, FeatureLocTotal>()
  for (const r of records) {
    for (const f of pick(r)) {
      let e = acc.get(f.name)
      if (!e) {
        e = { name: f.name, locAdded: 0, locDeleted: 0 }
        acc.set(f.name, e)
      }
      e.locAdded += f.locAdded
      e.locDeleted += f.locDeleted
    }
  }
  return [...acc.values()].sort(
    (a, b) => b.locAdded + b.locDeleted - (a.locAdded + a.locDeleted) || a.name.localeCompare(b.name),
  )
}

/** LoC added/deleted aggregated by feature, across the full attributed set (no top-N cutoff). */
export function locByFeature(records: UserDay[]): FeatureLocTotal[] {
  return aggregateFeatureLoc(records, (r) => r.totalsByFeature)
}

/** Top `limit` models by combined LoC added + deleted, added/deleted kept separate for grouped bars. */
export function topModelLoc(records: UserDay[], limit = 5): FeatureLocTotal[] {
  return aggregateFeatureLoc(records, (r) => r.totalsByModelFeature).slice(0, limit)
}

/** Top `limit` languages by combined LoC added + deleted, added/deleted kept separate for grouped bars. */
export function topLanguageLoc(records: UserDay[], limit = 5): FeatureLocTotal[] {
  return aggregateFeatureLoc(records, (r) => r.totalsByLanguageFeature).slice(0, limit)
}

/**
 * How many users landed at each adoption phase, using each user's *highest*
 * numeric phase seen in the selected range. A user who never carried phase
 * data in range lands in the explicit `Unknown` bucket rather than being
 * silently folded into phase 0 (a real, reportable phase in its own right) or
 * dropped from the count entirely.
 */
export interface AdoptionPhaseTotal {
  /** Human-readable label, e.g. "Phase 2" or "No Cohort"; "Unknown" for the explicit no-data bucket. */
  label: string
  /** Undefined only for the `Unknown` bucket. */
  phaseNumber?: number
  users: number
}

const UNKNOWN_ADOPTION_PHASE = 'Unknown'

export function adoptionPhaseDistribution(records: UserDay[]): AdoptionPhaseTotal[] {
  // One entry per user, so highest-phase selection can never produce more than one bucket per user.
  const phasesByUser = new Map<number, { phaseNumber: number; label: string }[]>()
  for (const r of records) {
    if (!phasesByUser.has(r.userId)) phasesByUser.set(r.userId, [])
    if (r.adoptionPhaseNumber !== undefined) {
      phasesByUser.get(r.userId)!.push({
        phaseNumber: r.adoptionPhaseNumber,
        label: r.adoptionPhase ?? String(r.adoptionPhaseNumber),
      })
    }
  }

  const counts = new Map<string, AdoptionPhaseTotal>()
  for (const phases of phasesByUser.values()) {
    const best =
      phases.length === 0
        ? { phaseNumber: undefined, label: UNKNOWN_ADOPTION_PHASE }
        : phases.reduce((a, b) =>
            b.phaseNumber > a.phaseNumber || (b.phaseNumber === a.phaseNumber && b.label.localeCompare(a.label) < 0)
              ? b
              : a,
          )
    const key = best.phaseNumber === undefined ? UNKNOWN_ADOPTION_PHASE : `${best.phaseNumber}:${best.label}`
    let e = counts.get(key)
    if (!e) {
      e = { label: best.label, phaseNumber: best.phaseNumber, users: 0 }
      counts.set(key, e)
    }
    e.users++
  }

  return [...counts.values()].sort((a, b) => {
    if (a.phaseNumber === undefined) return 1
    if (b.phaseNumber === undefined) return -1
    return a.phaseNumber - b.phaseNumber || a.label.localeCompare(b.label)
  })
}

/** Total AI credits divided by distinct users seen in range; null with no denominator. */
export function averageAiCredits(records: UserDay[]): number | null {
  const users = new Set<number>()
  let credits = 0
  for (const r of records) {
    users.add(r.userId)
    credits += r.aiCredits
  }
  return users.size > 0 ? credits / users.size : null
}

export interface AverageDailyAiCredits {
  /** Mean of each day's total AI credits across every day in range, including zero-activity days. */
  total: number | null
  /** Mean of each day's (AI credits / that day's active users), skipping days with no active users. */
  perUser: number | null
}

/**
 * Daily AI credit averages, computed from the same zero-filled `DayPoint[]`
 * the daily chart uses so both stay in lockstep with the report window.
 * `total` folds in zero-activity days (a fair "typical day" figure); `perUser`
 * only counts days with at least one active user, since dividing by zero
 * active users on an empty day is meaningless rather than zero.
 */
export function averageDailyAiCredits(daily: DayPoint[]): AverageDailyAiCredits {
  if (daily.length === 0) return { total: null, perUser: null }
  const daysWithUsers = daily.filter((d) => d.activeUsers > 0)
  return {
    total: mean(daily.map((d) => d.aiCredits)),
    perUser: daysWithUsers.length > 0 ? mean(daysWithUsers.map((d) => d.aiCredits / d.activeUsers)) : null,
  }
}

/**
 * One anonymous chart point: an ordinal position and a credit total, with no
 * user id or login attached. Points are ordered by credit total, descending,
 * for a readable ranked chart — the internal user id used to break ties never
 * leaves this function.
 */
export interface AnonymousCreditPoint {
  index: number
  credits: number
}

export interface CreditDistribution {
  points: AnonymousCreditPoint[]
  mean: number
  /** Population standard deviation across per-user credit totals. */
  stdDev: number
}

export function anonymousAiCreditsPerUser(records: UserDay[]): CreditDistribution {
  const creditsByUser = new Map<number, number>()
  for (const r of records) {
    creditsByUser.set(r.userId, (creditsByUser.get(r.userId) ?? 0) + r.aiCredits)
  }
  const totals = [...creditsByUser.entries()].sort(([idA, a], [idB, b]) => b - a || idA - idB).map(([, c]) => c)

  return {
    points: totals.map((credits, index) => ({ index, credits })),
    mean: mean(totals),
    stdDev: popStdDev(totals),
  }
}

/**
 * Same shape as {@link anonymousAiCreditsPerUser}, but each point is one
 * user's mean daily AI credits (their credit total \u00f7 their own number of
 * day-records) rather than their period total — a "typical day" figure per
 * user, so the distribution isn't skewed by users who simply have more days
 * of data in range.
 */
export function anonymousDailyAiCreditsPerUser(records: UserDay[]): CreditDistribution {
  const creditsByUser = new Map<number, number>()
  const daysByUser = new Map<number, number>()
  for (const r of records) {
    creditsByUser.set(r.userId, (creditsByUser.get(r.userId) ?? 0) + r.aiCredits)
    daysByUser.set(r.userId, (daysByUser.get(r.userId) ?? 0) + 1)
  }
  const dailyMeans = [...creditsByUser.entries()]
    .map(([id, total]) => [id, total / (daysByUser.get(id) ?? 1)] as const)
    .sort(([idA, a], [idB, b]) => b - a || idA - idB)
    .map(([, credits]) => credits)

  return {
    points: dailyMeans.map((credits, index) => ({ index, credits })),
    mean: mean(dailyMeans),
    stdDev: popStdDev(dailyMeans),
  }
}

/** One customization (custom agent, MCP server, skill, plugin, or slash command) and its interaction count. */
export interface CustomizationRanking {
  name: string
  interactionCount: number
}

export interface CustomizationRankingResult {
  /** Full descending list. */
  all: CustomizationRanking[]
  /** First `limit` entries of `all`. */
  top: CustomizationRanking[]
}

function rankCustomizations(
  records: UserDay[],
  pick: (r: UserDay) => CustomizationTotal[],
  limit = 5,
): CustomizationRankingResult {
  const acc = new Map<string, number>()
  for (const r of records) {
    for (const e of pick(r)) {
      acc.set(e.name, (acc.get(e.name) ?? 0) + e.interactionCount)
    }
  }
  const all = [...acc.entries()]
    .map(([name, interactionCount]) => ({ name, interactionCount }))
    .sort((a, b) => b.interactionCount - a.interactionCount || a.name.localeCompare(b.name))
  return { all, top: all.slice(0, limit) }
}

export const customAgentRanking = (records: UserDay[]): CustomizationRankingResult =>
  rankCustomizations(records, (r) => r.totalsByCustomAgent)

export const mcpRanking = (records: UserDay[]): CustomizationRankingResult =>
  rankCustomizations(records, (r) => r.totalsByMcp)

export const skillRanking = (records: UserDay[]): CustomizationRankingResult =>
  rankCustomizations(records, (r) => r.totalsBySkill)

export const pluginRanking = (records: UserDay[]): CustomizationRankingResult =>
  rankCustomizations(records, (r) => r.totalsByPlugin)

export const slashCommandRanking = (records: UserDay[]): CustomizationRankingResult =>
  rankCustomizations(records, (r) => r.totalsBySlashCmd)

/**
 * Keep the top `limit` entries and fold the tail into a single "Other" bar, so a
 * long tail never turns the chart into unreadable hairlines.
 */
export function topNWithOther(items: NamedTotal[], limit: number): { top: NamedTotal[]; otherCount: number } {
  if (items.length <= limit) return { top: items, otherCount: 0 }
  const top = items.slice(0, limit)
  const other = items.slice(limit).reduce<NamedTotal>(
    (a, t) => ({
      name: 'Other',
      interactions: a.interactions + t.interactions,
      generations: a.generations + t.generations,
      acceptances: a.acceptances + t.acceptances,
      locAdded: a.locAdded + t.locAdded,
      aiCredits: a.aiCredits + t.aiCredits,
      activeDays: a.activeDays + t.activeDays,
    }),
    { name: 'Other', interactions: 0, generations: 0, acceptances: 0, locAdded: 0, aiCredits: 0, activeDays: 0 },
  )
  return { top: [...top, other], otherCount: items.length - limit }
}

export { distinctOrganizationGroups }

export interface Filters {
  start?: string
  end?: string
  organizationGroup?: string
}

export function applyFilters(records: UserDay[], f: Filters): UserDay[] {
  return records.filter((r) => {
    if (f.start && r.day < f.start) return false
    if (f.end && r.day > f.end) return false
    if (
      f.organizationGroup &&
      organizationGroupKey(r.enterpriseId, r.organizationId) !== f.organizationGroup
    ) {
      return false
    }
    return true
  })
}
