/** Display formatting. Kept out of metrics.ts so aggregations stay pure numbers. */

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const plain = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
export const fmtNumber = (n: number): string => plain.format(n)
export const fmtCompact = (n: number): string => compact.format(n)

/** Null means "no denominator" — an em dash, never "0%". */
export const fmtPercent = (n: number | null): string => (n === null ? '—' : `${n.toFixed(1)}%`)

/** "2026-05-01" -> "1 May" for axis ticks. Dates are treated as UTC calendar days. */
export function fmtDayShort(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** "2026-05-01" -> "1 May 2026" for headers and tooltips. */
export function fmtDayLong(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
