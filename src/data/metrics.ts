import type { CustomizationTotal, FeatureTotal, UserDay } from './types'
import { distinctOrganizationGroups } from './organizationGroups'
import { SURFACE_DEFINITIONS, type SurfaceKey } from './surfaces'

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

export interface WeeklyDateRange extends DateRange {}

export interface WeeklyStackedSeries {
  key: string
  label: string
  /** Remainder/no-data series use the shared neutral chart color. */
  neutral?: boolean
}

export interface WeeklyStackedPoint {
  weekStart: string
  weekEnd: string
  values: Record<string, number>
}

export interface WeeklyStackedData {
  series: WeeklyStackedSeries[]
  points: WeeklyStackedPoint[]
}

export type AdoptionFlowStateKind = 'phase' | 'unknown' | 'inactive'

export interface AdoptionFlowNode {
  id: string
  periodIndex: number
  weekStart: string
  weekEnd: string
  stateKey: string
  label: string
  phaseNumber?: number
  kind: AdoptionFlowStateKind
  users: number
}

export interface AdoptionFlowLink {
  source: string
  target: string
  users: number
}

export interface AdoptionPhaseFlowData {
  periods: WeeklyDateRange[]
  nodes: AdoptionFlowNode[]
  links: AdoptionFlowLink[]
  cohortUsers: number
}

export const CREDIT_CYCLE_DAYS = 28
export const USD_PER_AI_CREDIT = 0.01
export const SPENDING_CAPS_USD = [
  10,
  50,
  100,
  200,
  300,
  400,
  500,
  600,
  700,
  800,
  1_000,
] as const

export interface CreditCycle extends DateRange {
  index: number
}

export interface SpendingCapScenario {
  capUsd: number
  capCredits: number
  cappedUsers: number
  organizationSavingsUsd: number
  organizationSavingsPercentage: number | null
  savingsPerCappedEmployeeUsd: number | null
  medianWeekdaysToCap: number | null
}

export interface NumbersTableMetrics {
  cycles: CreditCycle[]
  totalUsers: number
  inactiveUsers: number
  inactivePercentage: number | null
  belowAllowanceUsers: number
  belowAllowancePercentage: number | null
  allowanceCredits: number
  spendingCaps: SpendingCapScenario[]
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

/** Consecutive 28-day usage cycles, anchored to the selected range's first day. */
export function creditCycleRanges(range?: DateRange): CreditCycle[] {
  if (!range || range.start > range.end) return []

  const cycles: CreditCycle[] = []
  for (
    let start = range.start, index = 0;
    start <= range.end;
    start = addDays(start, CREDIT_CYCLE_DAYS), index++
  ) {
    const fullCycleEnd = addDays(start, CREDIT_CYCLE_DAYS - 1)
    cycles.push({
      index,
      start,
      end: fullCycleEnd > range.end ? range.end : fullCycleEnd,
    })
  }
  return cycles
}

/** Monday containing `date`, calculated in UTC so local time and DST cannot move the bucket. */
function calendarWeekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  const daysSinceMonday = (d.getUTCDay() + 6) % 7
  return addDays(date, -daysSinceMonday)
}

/**
 * Monday-Sunday buckets clipped to the selected/report range. The clipped
 * endpoints are presentation-honest: a Wednesday filter start never labels
 * the first bar as if Monday and Tuesday were included.
 */
export function weeklyDateRanges(range?: DateRange): WeeklyDateRange[] {
  if (!range || range.start > range.end) return []

  const ranges: WeeklyDateRange[] = []
  for (
    let monday = calendarWeekStart(range.start), i = 0;
    monday <= range.end && i < 1000;
    monday = addDays(monday, 7), i++
  ) {
    const sunday = addDays(monday, 6)
    ranges.push({
      start: monday < range.start ? range.start : monday,
      end: sunday > range.end ? range.end : sunday,
    })
  }
  return ranges
}

function emptyWeeklyPoints(range?: DateRange): WeeklyStackedPoint[] {
  return weeklyDateRanges(range).map(({ start, end }) => ({
    weekStart: start,
    weekEnd: end,
    values: {},
  }))
}

function pointsByCalendarWeek(points: WeeklyStackedPoint[]): Map<string, WeeklyStackedPoint> {
  return new Map(points.map((point) => [calendarWeekStart(point.weekStart), point]))
}

function inRange(day: string, range?: DateRange): boolean {
  return !range || (day >= range.start && day <= range.end)
}

const OTHER_WEEKLY_KEY = '__other__'
const UNKNOWN_WEEKLY_KEY = '__unknown__'
const surfaceKey = (key: SurfaceKey) => `surface:${key}`

function rankedNames(totals: Map<string, number>, limit: number): string[] {
  return [...totals.entries()]
    .filter(([, total]) => total > 0)
    .sort(([nameA, totalA], [nameB, totalB]) => totalB - totalA || nameA.localeCompare(nameB))
    .slice(0, limit)
    .map(([name]) => name)
}

function fillWeeklySeries(points: WeeklyStackedPoint[], series: WeeklyStackedSeries[]): void {
  for (const point of points) {
    for (const item of series) point.values[item.key] ??= 0
  }
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

export interface BubbleCloudDatum {
  /** Stable raw identifier used as the React/data key. */
  key: string
  /** Presentation label. Raw feature/model names are formatted by the view. */
  label: string
  value: number
}

export function topBubbleCloud(
  data: BubbleCloudDatum[],
  limit = 7,
): BubbleCloudDatum[] {
  const ranked = data
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key))
  const top = ranked.slice(0, limit)
  const remainder = ranked.slice(limit)

  if (remainder.length === 0) return top

  return [
    ...top,
    {
      key: '__others__',
      label: 'Others',
      value: remainder.reduce((sum, item) => sum + item.value, 0),
    },
  ]
}

function interactionsByBreakdownCloud(
  records: UserDay[],
  pick: (record: UserDay) => FeatureTotal[],
): BubbleCloudDatum[] {
  const totalByName = new Map<string, number>()

  for (const record of records) {
    for (const item of pick(record)) {
      totalByName.set(item.name, (totalByName.get(item.name) ?? 0) + item.interactions)
    }
  }

  return [...totalByName.entries()]
    .sort(([nameA, totalA], [nameB, totalB]) => totalB - totalA || nameA.localeCompare(nameB))
    .map(([name, value]) => ({
      key: name,
      label: name,
      value,
    }))
}

/** Every observed feature, ranked by interactions across the filtered range. */
export function interactionsByFeatureCloud(records: UserDay[]): BubbleCloudDatum[] {
  return interactionsByBreakdownCloud(records, (record) => record.totalsByFeature)
}

/** Every observed model, ranked by interaction count rather than Lines of Code. */
export function interactionsByModelCloud(records: UserDay[]): BubbleCloudDatum[] {
  return interactionsByBreakdownCloud(records, (record) => record.totalsByModelFeature)
}

/** Distinct users across the filtered range for each logical usage surface. */
export function usersBySurfaceCloud(records: UserDay[]): BubbleCloudDatum[] {
  const usersBySurface = new Map<SurfaceKey, Set<number>>(
    SURFACE_DEFINITIONS.map((surface) => [surface.key, new Set<number>()]),
  )

  for (const record of records) {
    for (const surface of SURFACE_DEFINITIONS) {
      if (surface.isUsed(record)) usersBySurface.get(surface.key)!.add(record.userId)
    }
  }

  return SURFACE_DEFINITIONS.map((surface) => ({
    key: surface.key,
    label: surface.label,
    value: usersBySurface.get(surface.key)!.size,
  }))
}

/**
 * Distinct users grouped by the exact number of logical surfaces they used
 * across the filtered range. Flags are unioned before counting, so each user
 * lands in exactly one bucket.
 */
export function usersBySurfaceCountCloud(records: UserDay[]): BubbleCloudDatum[] {
  const surfacesByUser = new Map<number, Set<SurfaceKey>>()

  for (const record of records) {
    let surfaces = surfacesByUser.get(record.userId)
    if (!surfaces) {
      surfaces = new Set()
      surfacesByUser.set(record.userId, surfaces)
    }
    for (const surface of SURFACE_DEFINITIONS) {
      if (surface.isUsed(record)) surfaces.add(surface.key)
    }
  }

  const counts = Array.from({ length: SURFACE_DEFINITIONS.length + 1 }, () => 0)
  for (const surfaces of surfacesByUser.values()) {
    if (surfaces.size > 0) counts[surfaces.size] = (counts[surfaces.size] ?? 0) + 1
  }

  const bubbles: BubbleCloudDatum[] = []
  for (let count = 1; count <= SURFACE_DEFINITIONS.length; count++) {
    bubbles.push({
      key: String(count),
      label: `${count} ${count === 1 ? 'surface' : 'surfaces'}`,
      value: counts[count] ?? 0,
    })
  }

  return bubbles
}

/**
 * Weekly model interactions. Ranking is fixed across the selected range so a
 * model keeps the same stack position and color in every bar.
 */
export function interactionsByModelPerWeek(
  records: UserDay[],
  bounds?: DateRange,
  limit = 7,
): WeeklyStackedData {
  const range = bounds ?? dateRange(records)
  const points = emptyWeeklyPoints(range)
  const totalByName = new Map<string, number>()

  for (const record of records) {
    if (!inRange(record.day, range)) continue
    for (const model of record.totalsByModelFeature) {
      totalByName.set(model.name, (totalByName.get(model.name) ?? 0) + model.interactions)
    }
  }

  const names = rankedNames(totalByName, limit)
  const topNames = new Set(names)
  const keyByName = new Map(names.map((name, index) => [name, `category-${index}`]))
  const hasOther = [...totalByName.entries()].some(([name, total]) => total > 0 && !topNames.has(name))
  const series: WeeklyStackedSeries[] = names.map((name, index) => ({
    key: `category-${index}`,
    label: name,
  }))
  if (hasOther) series.push({ key: OTHER_WEEKLY_KEY, label: 'Other', neutral: true })

  const byWeek = pointsByCalendarWeek(points)
  for (const record of records) {
    if (!inRange(record.day, range)) continue
    const point = byWeek.get(calendarWeekStart(record.day))
    if (!point) continue
    for (const model of record.totalsByModelFeature) {
      if (model.interactions <= 0) continue
      const key = keyByName.get(model.name) ?? OTHER_WEEKLY_KEY
      if (key === OTHER_WEEKLY_KEY && !hasOther) continue
      point.values[key] = (point.values[key] ?? 0) + model.interactions
    }
  }

  fillWeeklySeries(points, series)
  return { series, points }
}

/**
 * Distinct users per logical surface and calendar week. Users are de-duplicated
 * independently for each surface; the stacked total is therefore a sum of
 * surface audiences, not a distinct-user total.
 */
export function usersBySurfacePerWeek(records: UserDay[], bounds?: DateRange): WeeklyStackedData {
  const range = bounds ?? dateRange(records)
  const points = emptyWeeklyPoints(range)
  const usersByWeek = new Map<string, Map<SurfaceKey, Set<number>>>()

  for (const record of records) {
    if (!inRange(record.day, range)) continue
    const week = calendarWeekStart(record.day)
    let bySurface = usersByWeek.get(week)
    if (!bySurface) {
      bySurface = new Map()
      usersByWeek.set(week, bySurface)
    }
    for (const surface of SURFACE_DEFINITIONS) {
      if (!surface.isUsed(record)) continue
      let users = bySurface.get(surface.key)
      if (!users) {
        users = new Set()
        bySurface.set(surface.key, users)
      }
      users.add(record.userId)
    }
  }

  for (const point of points) {
    const bySurface = usersByWeek.get(calendarWeekStart(point.weekStart))
    for (const surface of SURFACE_DEFINITIONS) {
      point.values[surfaceKey(surface.key)] = bySurface?.get(surface.key)?.size ?? 0
    }
  }

  return {
    series: SURFACE_DEFINITIONS.map((surface) => ({
      key: surfaceKey(surface.key),
      label: surface.label,
    })),
    points,
  }
}

interface WeeklyAdoptionPhase {
  label: string
  phaseNumber: number
}

const weeklyAdoptionIdentity = (phase: WeeklyAdoptionPhase) =>
  `phase:${phase.phaseNumber}:${phase.label}`

interface WeeklyAdoptionAggregation {
  usersByWeek: Map<string, Map<number, WeeklyAdoptionPhase | undefined>>
  cohortUserIds: Set<number>
}

function weeklyAdoptionAggregation(
  records: UserDay[],
  range?: DateRange,
): WeeklyAdoptionAggregation {
  const usersByWeek = new Map<string, Map<number, WeeklyAdoptionPhase | undefined>>()
  const cohortUserIds = new Set<number>()

  for (const record of records) {
    if (!inRange(record.day, range)) continue
    cohortUserIds.add(record.userId)

    const week = calendarWeekStart(record.day)
    let users = usersByWeek.get(week)
    if (!users) {
      users = new Map()
      usersByWeek.set(week, users)
    }

    const current = users.get(record.userId)
    if (!users.has(record.userId)) users.set(record.userId, undefined)
    if (record.adoptionPhaseNumber === undefined) continue

    const candidate = {
      phaseNumber: record.adoptionPhaseNumber,
      label: record.adoptionPhase ?? String(record.adoptionPhaseNumber),
    }
    if (
      !current ||
      candidate.phaseNumber > current.phaseNumber ||
      (candidate.phaseNumber === current.phaseNumber &&
        candidate.label.localeCompare(current.label) < 0)
    ) {
      users.set(record.userId, candidate)
    }
  }

  return { usersByWeek, cohortUserIds }
}

/**
 * Weekly adoption distribution. Each reporting user appears once in each week
 * at their highest numeric phase observed in that week; users with no usable
 * phase in the week appear in the explicit Unknown segment.
 */
export function adoptionPhaseByWeek(records: UserDay[], bounds?: DateRange): WeeklyStackedData {
  const range = bounds ?? dateRange(records)
  const points = emptyWeeklyPoints(range)
  const { usersByWeek: phasesByWeek } = weeklyAdoptionAggregation(records, range)

  const observedPhases = new Map<string, WeeklyAdoptionPhase>()
  let hasUnknown = false
  const byWeek = pointsByCalendarWeek(points)
  for (const [week, users] of phasesByWeek) {
    const point = byWeek.get(week)
    if (!point) continue
    for (const phase of users.values()) {
      if (!phase) {
        point.values[UNKNOWN_WEEKLY_KEY] = (point.values[UNKNOWN_WEEKLY_KEY] ?? 0) + 1
        hasUnknown = true
        continue
      }
      const key = weeklyAdoptionIdentity(phase)
      observedPhases.set(key, phase)
      point.values[key] = (point.values[key] ?? 0) + 1
    }
  }

  const orderedPhases = [...observedPhases.entries()].sort(
    ([, a], [, b]) => a.phaseNumber - b.phaseNumber || a.label.localeCompare(b.label),
  )
  const series: WeeklyStackedSeries[] = orderedPhases.map(([, phase], index) => ({
    key: `phase-${index}`,
    label: phase.label,
  }))
  if (hasUnknown) series.push({ key: UNKNOWN_WEEKLY_KEY, label: UNKNOWN_ADOPTION_PHASE, neutral: true })

  for (const point of points) {
    const values: Record<string, number> = {}
    orderedPhases.forEach(([identity], index) => {
      values[`phase-${index}`] = point.values[identity] ?? 0
    })
    if (hasUnknown) values[UNKNOWN_WEEKLY_KEY] = point.values[UNKNOWN_WEEKLY_KEY] ?? 0
    point.values = values
  }
  return { series, points }
}

const INACTIVE_ADOPTION_PHASE = 'Not active'
const INACTIVE_ADOPTION_KEY = '__inactive__'

interface AdoptionFlowStateDefinition {
  stateKey: string
  label: string
  phaseNumber?: number
  kind: AdoptionFlowStateKind
}

const adoptionFlowNodeId = (periodIndex: number, stateKey: string) =>
  `${periodIndex}:${stateKey}`

function compareAdoptionFlowStates(
  a: AdoptionFlowStateDefinition,
  b: AdoptionFlowStateDefinition,
): number {
  if (a.kind === 'phase' && b.kind === 'phase') {
    return (
      (b.phaseNumber ?? Number.NEGATIVE_INFINITY) -
        (a.phaseNumber ?? Number.NEGATIVE_INFINITY) ||
      a.label.localeCompare(b.label)
    )
  }
  if (a.kind === 'phase') return -1
  if (b.kind === 'phase') return 1
  if (a.kind === b.kind) return a.label.localeCompare(b.label)
  return a.kind === 'unknown' ? -1 : 1
}

/**
 * Anonymous user movement between adjacent calendar weeks. The cohort is every
 * distinct user seen anywhere in the selected range, so each week has the same
 * total population. A user with records but no usable phase is `Unknown`; a
 * cohort user with no record in a week is `Not active`.
 */
export function adoptionPhaseFlowByWeek(
  records: UserDay[],
  bounds?: DateRange,
): AdoptionPhaseFlowData {
  const range = bounds ?? dateRange(records)
  const periods = weeklyDateRanges(range)
  const { usersByWeek, cohortUserIds } = weeklyAdoptionAggregation(records, range)
  const empty: AdoptionPhaseFlowData = {
    periods,
    nodes: [],
    links: [],
    cohortUsers: cohortUserIds.size,
  }
  if (periods.length === 0 || cohortUserIds.size === 0) return empty

  const definitions = new Map<string, AdoptionFlowStateDefinition>()
  const userStatesByPeriod: Array<Map<number, string>> = []
  const nodes: AdoptionFlowNode[] = []

  periods.forEach((period, periodIndex) => {
    const reportedUsers = usersByWeek.get(calendarWeekStart(period.start))
    const counts = new Map<string, number>()
    const userStates = new Map<number, string>()

    for (const userId of cohortUserIds) {
      const hasRecord = reportedUsers?.has(userId) ?? false
      const phase = reportedUsers?.get(userId)
      let definition: AdoptionFlowStateDefinition

      if (!hasRecord) {
        definition = {
          stateKey: INACTIVE_ADOPTION_KEY,
          label: INACTIVE_ADOPTION_PHASE,
          kind: 'inactive',
        }
      } else if (!phase) {
        definition = {
          stateKey: UNKNOWN_WEEKLY_KEY,
          label: UNKNOWN_ADOPTION_PHASE,
          kind: 'unknown',
        }
      } else {
        definition = {
          stateKey: weeklyAdoptionIdentity(phase),
          label: phase.label,
          phaseNumber: phase.phaseNumber,
          kind: 'phase',
        }
      }

      definitions.set(definition.stateKey, definition)
      userStates.set(userId, definition.stateKey)
      counts.set(definition.stateKey, (counts.get(definition.stateKey) ?? 0) + 1)
    }

    userStatesByPeriod.push(userStates)
    const orderedDefinitions = [...counts.keys()]
      .map((key) => definitions.get(key)!)
      .sort(compareAdoptionFlowStates)
    for (const definition of orderedDefinitions) {
      nodes.push({
        id: adoptionFlowNodeId(periodIndex, definition.stateKey),
        periodIndex,
        weekStart: period.start,
        weekEnd: period.end,
        ...definition,
        users: counts.get(definition.stateKey) ?? 0,
      })
    }
  })

  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const stateOrder = new Map(
    [...definitions.values()]
      .sort(compareAdoptionFlowStates)
      .map((definition, index) => [definition.stateKey, index]),
  )
  const links: AdoptionFlowLink[] = []

  for (let periodIndex = 0; periodIndex < periods.length - 1; periodIndex++) {
    const sourceStates = userStatesByPeriod[periodIndex]!
    const targetStates = userStatesByPeriod[periodIndex + 1]!
    const transitionCounts = new Map<string, AdoptionFlowLink>()

    for (const userId of cohortUserIds) {
      const sourceKey = sourceStates.get(userId)!
      const targetKey = targetStates.get(userId)!
      const source = adoptionFlowNodeId(periodIndex, sourceKey)
      const target = adoptionFlowNodeId(periodIndex + 1, targetKey)
      const key = `${source}\u0000${target}`
      const current = transitionCounts.get(key)
      if (current) current.users++
      else transitionCounts.set(key, { source, target, users: 1 })
    }

    links.push(
      ...[...transitionCounts.values()].sort((a, b) => {
        const sourceA = nodesById.get(a.source)!
        const sourceB = nodesById.get(b.source)!
        const targetA = nodesById.get(a.target)!
        const targetB = nodesById.get(b.target)!
        return (
          (stateOrder.get(sourceA.stateKey) ?? 0) -
            (stateOrder.get(sourceB.stateKey) ?? 0) ||
          (stateOrder.get(targetA.stateKey) ?? 0) -
            (stateOrder.get(targetB.stateKey) ?? 0)
        )
      }),
    )
  }

  return { periods, nodes, links, cohortUsers: cohortUserIds.size }
}

/**
 * Weekly attributed Lines of Code changed by feature. "Changed" deliberately
 * means the magnitude `added + deleted`, never a net or acceptance measure.
 */
export function locChangedByFeaturePerWeek(
  records: UserDay[],
  bounds?: DateRange,
  limit = 7,
): WeeklyStackedData {
  const range = bounds ?? dateRange(records)
  const points = emptyWeeklyPoints(range)
  const totalByName = new Map<string, number>()

  for (const record of records) {
    if (!inRange(record.day, range)) continue
    for (const feature of record.totalsByFeature) {
      const changed = feature.locAdded + feature.locDeleted
      totalByName.set(feature.name, (totalByName.get(feature.name) ?? 0) + changed)
    }
  }

  const names = rankedNames(totalByName, limit)
  const topNames = new Set(names)
  const keyByName = new Map(names.map((name, index) => [name, `category-${index}`]))
  const hasOther = [...totalByName.entries()].some(([name, total]) => total > 0 && !topNames.has(name))
  const series: WeeklyStackedSeries[] = names.map((name, index) => ({
    key: `category-${index}`,
    label: name,
  }))
  if (hasOther) series.push({ key: OTHER_WEEKLY_KEY, label: 'Other', neutral: true })

  const byWeek = pointsByCalendarWeek(points)
  for (const record of records) {
    if (!inRange(record.day, range)) continue
    const point = byWeek.get(calendarWeekStart(record.day))
    if (!point) continue
    for (const feature of record.totalsByFeature) {
      const changed = feature.locAdded + feature.locDeleted
      if (changed <= 0) continue
      const key = keyByName.get(feature.name) ?? OTHER_WEEKLY_KEY
      if (key === OTHER_WEEKLY_KEY && !hasOther) continue
      point.values[key] = (point.values[key] ?? 0) + changed
    }
  }

  fillWeeklySeries(points, series)
  return { series, points }
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

/** Middle value, averaging the two middle values for an even-sized population. */
function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle]!
  return (sorted[middle - 1]! + sorted[middle]!) / 2
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

const isWeekday = (day: string): boolean => {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay()
  return weekday !== 0 && weekday !== 6
}

function weekdaysInRange(range: DateRange): number {
  if (range.start > range.end) return 0
  let weekdays = 0
  for (let day = range.start; day <= range.end; day = addDays(day, 1)) {
    if (isWeekday(day)) weekdays++
  }
  return weekdays
}

/**
 * Headline user metrics and fixed spending-cap scenarios for the numbers/table
 * tab. User identities stay inside local sets/maps and never leave this result.
 */
export function numbersTableMetrics(
  records: UserDay[],
  range: DateRange,
  allowanceCredits: number,
  capAmountsUsd: readonly number[] = SPENDING_CAPS_USD,
): NumbersTableMetrics {
  const cycles = creditCycleRanges(range)
  const users = new Set<number>()
  const activeUsers = new Set<number>()
  const creditsByUserCycle = new Map<
    number,
    Map<number, { total: number; weekdays: number }>
  >()

  for (const record of records) {
    if (!inRange(record.day, range)) continue

    users.add(record.userId)
    if (isActive(record)) activeUsers.add(record.userId)

    const cycleIndex = cycles.findIndex(
      (cycle) => record.day >= cycle.start && record.day <= cycle.end,
    )
    if (cycleIndex >= 0) {
      let userCycles = creditsByUserCycle.get(record.userId)
      if (!userCycles) {
        userCycles = new Map()
        creditsByUserCycle.set(record.userId, userCycles)
      }
      const cycleCredits = userCycles.get(cycleIndex) ?? { total: 0, weekdays: 0 }
      cycleCredits.total += record.aiCredits
      if (isWeekday(record.day)) cycleCredits.weekdays += record.aiCredits
      userCycles.set(cycleIndex, cycleCredits)
    }
  }

  const totalUsers = users.size
  const inactiveUsers = totalUsers - activeUsers.size
  const belowAllowanceUsers = [...users].filter((userId) => {
    const userCycles = creditsByUserCycle.get(userId)
    return userCycles !== undefined
      && [...userCycles.values()].every(({ total }) => total < allowanceCredits)
  }).length

  const weekdayCount = weekdaysInRange(range)
  let currentOverageCredits = 0
  for (const userCycles of creditsByUserCycle.values()) {
    for (const credits of userCycles.values()) {
      currentOverageCredits += Math.max(credits.total - allowanceCredits, 0)
    }
  }

  const spendingCaps = capAmountsUsd.map((capUsd): SpendingCapScenario => {
    const capCredits = capUsd / USD_PER_AI_CREDIT
    const cappedUsers = new Set<number>()
    const weekdayOverageByUser = new Map<number, number>()
    let savingsCredits = 0

    for (const [userId, userCycles] of creditsByUserCycle) {
      let weekdayOverage = 0
      for (const credits of userCycles.values()) {
        const overageCredits = Math.max(credits.total - allowanceCredits, 0)
        if (overageCredits >= capCredits) cappedUsers.add(userId)
        savingsCredits += Math.max(overageCredits - capCredits, 0)
        weekdayOverage += Math.max(credits.weekdays - allowanceCredits, 0)
      }
      weekdayOverageByUser.set(userId, weekdayOverage)
    }

    const organizationSavingsUsd = savingsCredits * USD_PER_AI_CREDIT
    const cappedUserTimes =
      weekdayCount === 0
        ? []
        : [...cappedUsers]
            .map((userId) => (weekdayOverageByUser.get(userId) ?? 0) / weekdayCount)
            .filter((weekdayRate) => weekdayRate > 0)
            .map((weekdayRate) => capCredits / weekdayRate)

    return {
      capUsd,
      capCredits,
      cappedUsers: cappedUsers.size,
      organizationSavingsUsd,
      organizationSavingsPercentage:
        currentOverageCredits > 0 ? (savingsCredits / currentOverageCredits) * 100 : null,
      savingsPerCappedEmployeeUsd:
        cappedUsers.size > 0 ? organizationSavingsUsd / cappedUsers.size : null,
      medianWeekdaysToCap:
        cappedUserTimes.length > 0 ? median(cappedUserTimes) : null,
    }
  })

  return {
    cycles,
    totalUsers,
    inactiveUsers,
    inactivePercentage: totalUsers > 0 ? (inactiveUsers / totalUsers) * 100 : null,
    belowAllowanceUsers,
    belowAllowancePercentage:
      totalUsers > 0 ? (belowAllowanceUsers / totalUsers) * 100 : null,
    allowanceCredits,
    spendingCaps,
  }
}

/**
 * One anonymous user's activity and reported-credit totals. `index` is assigned
 * only after aggregation and carries no stable identity between filtered views.
 */
export interface AnonymousUserCreditPoint {
  index: number
  requests: number
  /** Lines added + lines deleted across every selected record. */
  codeChanges: number
  credits: number
  reportedCreditRecords: number
  totalRecords: number
}

export type UserCreditScatterMeasure = 'requests' | 'codeChanges'

export interface UserCreditOutlierFilterResult {
  points: AnonymousUserCreditPoint[]
  excludedCount: number
}

export type UserCreditTrendSegment = readonly [
  { x: number; y: number },
  { x: number; y: number },
]

export type CorrelationStrength = 'very weak' | 'weak' | 'moderate' | 'strong' | 'very strong'

export interface UserCreditCorrelation {
  coefficient: number
  direction: 'negative' | 'none' | 'positive'
  strength: CorrelationStrength
}

/**
 * Per-user activity for comparison with AI-credit consumption. Requests and
 * Lines of Code changed include every selected record. Credits include only
 * records where GitHub explicitly reported `ai_credits_used`; users with no
 * reported credit values are omitted rather than plotted at a false zero.
 */
export function anonymousUserCreditsPerUser(
  records: UserDay[],
): AnonymousUserCreditPoint[] {
  interface Acc {
    requests: number
    codeChanges: number
    credits: number
    reportedCreditRecords: number
    totalRecords: number
  }

  const byUser = new Map<number, Acc>()
  for (const record of records) {
    const current = byUser.get(record.userId) ?? {
      requests: 0,
      codeChanges: 0,
      credits: 0,
      reportedCreditRecords: 0,
      totalRecords: 0,
    }

    current.requests += record.interactions
    current.codeChanges += record.locAdded + record.locDeleted
    current.totalRecords++
    if (record.aiCreditsReported) {
      current.credits += record.aiCredits
      current.reportedCreditRecords++
    }
    byUser.set(record.userId, current)
  }

  return [...byUser.entries()]
    .filter(([, point]) => point.reportedCreditRecords > 0)
    .sort(
      ([idA, a], [idB, b]) =>
        b.credits - a.credits ||
        b.requests - a.requests ||
        b.codeChanges - a.codeChanges ||
        idA - idB,
    )
    .map(([, point], index) => ({ index, ...point }))
}

function quantile(sorted: number[], percentile: number): number {
  const position = (sorted.length - 1) * percentile
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.ceil(position)
  const lower = sorted[lowerIndex]!
  const upper = sorted[upperIndex]!
  return lower + (upper - lower) * (position - lowerIndex)
}

function tukeyFences(values: number[]): { lower: number; upper: number } {
  const sorted = [...values].sort((a, b) => a - b)
  const q1 = quantile(sorted, 0.25)
  const q3 = quantile(sorted, 0.75)
  const iqr = q3 - q1
  return {
    lower: q1 - iqr * 1.5,
    upper: q3 + iqr * 1.5,
  }
}

/**
 * Exclude extreme anonymous users using Tukey's 1.5×IQR fences independently
 * on reported credits and the selected activity measure. A point outside either
 * axis fence is excluded. Fewer than four points are left untouched because
 * quartile-based outlier classification is not useful for such a small group.
 */
export function filterUserCreditOutliers(
  data: AnonymousUserCreditPoint[],
  measure: UserCreditScatterMeasure,
): UserCreditOutlierFilterResult {
  if (data.length < 4) return { points: [...data], excludedCount: 0 }

  const creditFences = tukeyFences(data.map((point) => point.credits))
  const measureFences = tukeyFences(data.map((point) => point[measure]))
  const points = data.filter(
    (point) =>
      point.credits >= creditFences.lower &&
      point.credits <= creditFences.upper &&
      point[measure] >= measureFences.lower &&
      point[measure] <= measureFences.upper,
  )

  return {
    points,
    excludedCount: data.length - points.length,
  }
}

/**
 * Ordinary least-squares trend for the displayed scatter points. The returned
 * segment stays within the observed x/y bounds, so it describes the visible
 * population without extrapolating beyond it. Constant-credit populations have
 * no defined y-on-x slope and therefore return no segment.
 */
export function userCreditTrendSegment(
  data: AnonymousUserCreditPoint[],
  measure: UserCreditScatterMeasure,
): UserCreditTrendSegment | undefined {
  if (data.length < 2) return undefined

  const meanX = data.reduce((sum, point) => sum + point.credits, 0) / data.length
  const meanY = data.reduce((sum, point) => sum + point[measure], 0) / data.length
  let covariance = 0
  let varianceX = 0

  for (const point of data) {
    const xOffset = point.credits - meanX
    covariance += xOffset * (point[measure] - meanY)
    varianceX += xOffset * xOffset
  }

  if (varianceX === 0) return undefined

  const slope = covariance / varianceX
  const intercept = meanY - slope * meanX
  const minX = Math.min(...data.map((point) => point.credits))
  const maxX = Math.max(...data.map((point) => point.credits))
  const minY = Math.min(...data.map((point) => point[measure]))
  const maxY = Math.max(...data.map((point) => point[measure]))
  const candidates = [
    { x: minX, y: intercept + slope * minX },
    { x: maxX, y: intercept + slope * maxX },
  ]

  if (slope !== 0) {
    candidates.push(
      { x: (minY - intercept) / slope, y: minY },
      { x: (maxY - intercept) / slope, y: maxY },
    )
  }

  const epsilon = 1e-9
  const visible = candidates.filter(
    (point) =>
      point.x >= minX - epsilon &&
      point.x <= maxX + epsilon &&
      point.y >= minY - epsilon &&
      point.y <= maxY + epsilon,
  )
  const unique = visible.filter(
    (point, index) =>
      visible.findIndex(
        (candidate) =>
          Math.abs(candidate.x - point.x) < epsilon &&
          Math.abs(candidate.y - point.y) < epsilon,
      ) === index,
  )

  if (unique.length < 2) return undefined

  const start = unique.reduce((left, point) => (point.x < left.x ? point : left))
  const end = unique.reduce((right, point) => (point.x > right.x ? point : right))
  return [
    { x: start.x, y: Math.min(maxY, Math.max(minY, start.y)) },
    { x: end.x, y: Math.min(maxY, Math.max(minY, end.y)) },
  ]
}

export function correlationStrength(coefficient: number): CorrelationStrength {
  const magnitude = Math.abs(coefficient)
  if (magnitude < 0.2) return 'very weak'
  if (magnitude < 0.4) return 'weak'
  if (magnitude < 0.6) return 'moderate'
  if (magnitude < 0.8) return 'strong'
  return 'very strong'
}

/**
 * Pearson correlation between reported AI credits and the selected activity
 * measure for the displayed users. At least three points and variation on both
 * axes are required; otherwise a strength label would be misleading.
 */
export function userCreditCorrelation(
  data: AnonymousUserCreditPoint[],
  measure: UserCreditScatterMeasure,
): UserCreditCorrelation | undefined {
  if (data.length < 3) return undefined

  const meanX = data.reduce((sum, point) => sum + point.credits, 0) / data.length
  const meanY = data.reduce((sum, point) => sum + point[measure], 0) / data.length
  let covariance = 0
  let varianceX = 0
  let varianceY = 0

  for (const point of data) {
    const xOffset = point.credits - meanX
    const yOffset = point[measure] - meanY
    covariance += xOffset * yOffset
    varianceX += xOffset * xOffset
    varianceY += yOffset * yOffset
  }

  if (varianceX === 0 || varianceY === 0) return undefined

  const rawCoefficient = covariance / Math.sqrt(varianceX * varianceY)
  const clampedCoefficient = Math.max(-1, Math.min(1, rawCoefficient))
  const coefficient = Number(clampedCoefficient.toFixed(2))

  return {
    coefficient,
    direction: coefficient === 0 ? 'none' : coefficient > 0 ? 'positive' : 'negative',
    strength: correlationStrength(coefficient),
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
}

export function applyFilters(records: UserDay[], f: Filters): UserDay[] {
  return records.filter((r) => {
    if (f.start && r.day < f.start) return false
    if (f.end && r.day > f.end) return false
    return true
  })
}
