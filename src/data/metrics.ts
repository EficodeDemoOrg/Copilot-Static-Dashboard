import type { UserDay } from './types'

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
  const users = new Set<string>()
  const seen = new Set<string>()
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
    seen.add(r.user)
    if (isActive(r)) {
      activeUserDays++
      users.add(r.user)
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
    users: Set<string>
    interactions: number
    generations: number
    acceptances: number
  }
  const acc = new Map<string, Acc>()

  for (const r of records) {
    let a = acc.get(r.day)
    if (!a) {
      a = { users: new Set(), interactions: 0, generations: 0, acceptances: 0 }
      acc.set(r.day, a)
    }
    a.interactions += r.interactions
    a.generations += r.generations
    a.acceptances += r.acceptances
    if (isActive(r)) a.users.add(r.user)
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
    })
  }
  return out
}

function groupBy(records: UserDay[], key: (r: UserDay) => string): NamedTotal[] {
  const acc = new Map<string, NamedTotal>()
  for (const r of records) {
    const name = key(r)
    let e = acc.get(name)
    if (!e) {
      e = { name, interactions: 0, generations: 0, acceptances: 0, locAdded: 0, aiCredits: 0, activeDays: 0 }
      acc.set(name, e)
    }
    e.interactions += r.interactions
    e.generations += r.generations
    e.acceptances += r.acceptances
    e.locAdded += r.locAdded
    e.aiCredits += r.aiCredits
    if (isActive(r)) e.activeDays++
  }
  return [...acc.values()].sort((a, b) => b.interactions - a.interactions)
}

export const byUser = (records: UserDay[]): NamedTotal[] => groupBy(records, (r) => r.user)

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

export function distinctOrgs(records: UserDay[]): string[] {
  const set = new Set<string>()
  for (const r of records) if (r.organizationId) set.add(r.organizationId)
  return [...set].sort((a, b) => a.localeCompare(b))
}

export interface Filters {
  start?: string
  end?: string
  organization?: string
}

export function applyFilters(records: UserDay[], f: Filters): UserDay[] {
  return records.filter((r) => {
    if (f.start && r.day < f.start) return false
    if (f.end && r.day > f.end) return false
    if (f.organization && r.organizationId !== f.organization) return false
    return true
  })
}
