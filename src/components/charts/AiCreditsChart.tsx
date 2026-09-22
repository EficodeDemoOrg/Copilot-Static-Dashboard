import type { DayPoint } from '../../data/metrics'
import { DailyUsageChart } from './DailyUsageChart'

/**
 * Required interpretation copy: GitHub defines `ai_credits_used` as a
 * consumption-analysis measure, not a billing/invoice total, so this note
 * stops a reader from mistaking the daily sum for an invoice line.
 */
export const AI_CREDITS_NOTE =
  'Daily sum of ai_credits_used — a consumption-analysis measure as GitHub defines it, not a billing or invoice total.'

interface Props {
  data: DayPoint[]
}

/** Total AI credits consumed per day, reusing the single-measure daily area chart. */
export function AiCreditsChart({ data }: Props) {
  return (
    <>
      <DailyUsageChart data={data} measure="aiCredits" label="AI credits" />
      <p className="card__note">{AI_CREDITS_NOTE}</p>
    </>
  )
}
