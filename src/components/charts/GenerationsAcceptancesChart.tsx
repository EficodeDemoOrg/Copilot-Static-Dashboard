import type { DayPoint } from '../../data/metrics'
import { measureColor } from '../../theme/palette'
import { fmtNumber } from '../../format'
import { DailyMultiSeriesChart, type DailySeries } from './DailyMultiSeriesChart'

const SERIES: DailySeries[] = [
  { key: 'generations', name: 'Code generations', color: measureColor.generations },
  { key: 'acceptances', name: 'Acceptances', color: measureColor.acceptances },
]

interface Props {
  data: DayPoint[]
}

/**
 * Code generations and acceptances per day, plotted together on one shared
 * count axis. Deliberately counts only — this chart never recomputes or
 * implies an acceptance-rate percentage.
 */
export function GenerationsAcceptancesChart({ data }: Props) {
  return (
    <DailyMultiSeriesChart
      data={data}
      series={SERIES}
      variant="line"
      valueFormatter={fmtNumber}
      emptyMessage="No dated records in this range."
    />
  )
}
