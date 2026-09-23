import type { FeatureInteractionsByDay } from '../../data/metrics'
import { series as palette, otherFill } from '../../theme/palette'
import { fmtMetricLabel, fmtNumber } from '../../format'
import { DailyMultiSeriesChart, type DailySeries } from './DailyMultiSeriesChart'

/**
 * Interactions per day, broken down by feature: the top 7 features over the
 * selected range keep their own stacked series, and every remaining feature's
 * interactions for that day fold into one neutral `Other` series so the
 * complete attributed total is never dropped. Ranking, folding, and the
 * zero-activity-day fill all happen in `interactionsByFeaturePerDay`; this
 * component only assigns colors and renders.
 */
interface Props {
  data: FeatureInteractionsByDay
}

export function FeatureInteractionsChart({ data }: Props) {
  if (data.featureNames.length === 0 && !data.hasOther) {
    return <p className="empty">No attributed feature interaction data for this range.</p>
  }

  // Ranked features first (their own palette slot each), "Other" last and in
  // the neutral remainder color — never a ranked series' hue. palette[3]
  // (series-4) is excluded from rotation: it only clears 3:1 contrast with a
  // persistent value label, and these stacked areas carry no on-chart labels.
  const safePalette = palette.filter((_, i) => i !== 3)
  const chartSeries: DailySeries[] = data.featureNames.map((name, i) => ({
    key: name,
    name: fmtMetricLabel(name),
    color: safePalette[i % safePalette.length]!,
  }))
  if (data.hasOther) chartSeries.push({ key: 'Other', name: 'Other', color: otherFill })

  const rows = data.points.map((p) => ({ date: p.date, ...p.values }))

  return (
    <DailyMultiSeriesChart
      data={rows}
      series={chartSeries}
      variant="area"
      valueFormatter={fmtNumber}
      emptyMessage="No dated records in this range."
    />
  )
}
