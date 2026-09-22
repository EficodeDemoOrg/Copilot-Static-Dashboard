import type { SurfaceDayPoint } from '../../data/metrics'
import { series as palette } from '../../theme/palette'
import { fmtNumber } from '../../format'
import { DailyMultiSeriesChart, type DailySeries } from './DailyMultiSeriesChart'

/**
 * Required interpretation copy: GitHub documents `used_copilot_coding_agent`
 * and `used_copilot_cloud_agent` as backward-compatible names carrying the
 * same value, so `usersBySurfaceByDay` already folds them with a logical OR
 * into one `copilotCloudAgent` count. This note is why the chart shows one
 * combined line instead of two, rather than leaving a reader to wonder where
 * the other surface went.
 */
export const SURFACE_USAGE_NOTE =
  "Copilot cloud/coding agent is plotted once: GitHub retains 'used_copilot_coding_agent' and 'used_copilot_cloud_agent' as backward-compatible names carrying the same value, so showing both would duplicate one signal rather than reveal two surfaces."

// palette[3] (series-4) is skipped: it only clears 3:1 contrast with a
// persistent value label, and these lines carry no on-chart labels.
const SURFACE_SERIES: DailySeries[] = [
  { key: 'agent', name: 'IDE agent mode', color: palette[0] },
  { key: 'chat', name: 'IDE chat', color: palette[5] },
  { key: 'cli', name: 'Copilot CLI', color: palette[4] },
  { key: 'copilotCloudAgent', name: 'Copilot cloud / coding agent', color: palette[6] },
]

interface Props {
  data: SurfaceDayPoint[]
}

/** Distinct users per day for each Copilot surface. */
export function SurfaceUsageChart({ data }: Props) {
  return (
    <>
      <DailyMultiSeriesChart
        data={data}
        series={SURFACE_SERIES}
        variant="line"
        valueFormatter={fmtNumber}
        emptyMessage="No dated records in this range."
      />
      <p className="card__note">{SURFACE_USAGE_NOTE}</p>
    </>
  )
}
