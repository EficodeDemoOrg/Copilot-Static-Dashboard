import { fmtCompact } from '../../format'

/**
 * Required interpretation copy: this is the one requested summary number —
 * total AI credits divided by distinct users seen in range — not the
 * dashboard's unrelated active-user KPI row, so it gets its own formula
 * caption rather than sharing the KpiRow's generic hints.
 */
export const AVERAGE_AI_CREDITS_NOTE = 'Total AI credits ÷ distinct users seen in the selected range.'

interface Props {
  /** `null` means no denominator — an em dash, never a misleading 0. */
  value: number | null
}

/**
 * A single focused summary tile, not a row: `KpiRow` is built for a grid of
 * unrelated counters, and this is one deliberately isolated average. Reuses
 * the `.kpi` card token so it still looks native beside the rest of the
 * dashboard.
 */
export function AverageAiCreditsStat({ value }: Props) {
  return (
    <div className="kpi kpi--solo">
      <div className="kpi__label">Average AI credits used</div>
      <div className="kpi__value">{value === null ? '—' : fmtCompact(value)}</div>
      <div className="kpi__hint">{AVERAGE_AI_CREDITS_NOTE}</div>
    </div>
  )
}
