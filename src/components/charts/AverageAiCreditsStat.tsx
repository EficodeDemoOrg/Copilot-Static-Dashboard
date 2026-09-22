import { fmtCompact } from '../../format'

/**
 * Required interpretation copy: this is the one requested summary number —
 * total AI credits divided by distinct users seen in range — so it gets its
 * own formula caption rather than a generic hint.
 */
export const AVERAGE_AI_CREDITS_NOTE = 'Total AI credits ÷ distinct users seen in the selected range.'

interface Props {
  /** `null` means no denominator — an em dash, never a misleading 0. */
  value: number | null
  /** Defaults to the original "total ÷ distinct users" tile's copy. */
  label?: string
  note?: string
}

/**
 * A single focused summary tile for one AI-credit average. Reuses the `.kpi`
 * card token so it stays visually consistent whether it appears alone or, as
 * it does today, side by side with the other two credit averages.
 * `label`/`note` are overridable so the same tile shape can show the related
 * per-user and total daily-average figures without duplicating this markup.
 */
export function AverageAiCreditsStat({ value, label = 'Average AI credits used', note = AVERAGE_AI_CREDITS_NOTE }: Props) {
  return (
    <div className="kpi">
      <div className="kpi__label">{label}</div>
      <div className="kpi__value">{value === null ? '—' : fmtCompact(value)}</div>
      <div className="kpi__hint">{note}</div>
    </div>
  )
}
