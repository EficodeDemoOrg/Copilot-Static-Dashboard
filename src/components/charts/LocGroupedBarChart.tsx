import { Bar, BarChart, Legend, Tooltip, XAxis, YAxis } from 'recharts'
import type { FeatureLocTotal } from '../../data/metrics'
import { ink, measureColor, tickStyle } from '../../theme/palette'
import { fmtCompact, fmtNumber } from '../../format'
import { makeTooltip } from './ChartTooltip'
import { ChartFrame } from './ChartFrame'
import { categoryAxisTick } from './CategoryAxisTick'

/**
 * Attribution disclaimer for breakdowns GitHub can omit unattributed activity
 * from. An "Other" bucket is deliberately never synthesised here: subtracting
 * an attributed total from a top-level total would imply attribution that
 * does not exist in the export.
 */
export const ATTRIBUTED_LOC_NOTE =
  "Covers attributed breakdown data only. GitHub's model and language breakdowns can omit unattributed activity, so these totals may not reconcile with the top-level lines-added/deleted figures."

const ROW_HEIGHT = 32
const MIN_HEIGHT = 160

interface Props {
  data: FeatureLocTotal[]
  /** Axis label width — feature/model/language names need different room. */
  labelWidth?: number
  /** Shown below the chart when `data` is empty — the caller knows why (no attribution, no features, …). */
  emptyMessage?: string
  /** Interpretation copy rendered under the chart, e.g. the attribution disclaimer for model/language views. */
  note?: string
}

/**
 * Reusable grouped horizontal LoC bar chart, shared by the feature, model, and
 * language visualisations: one paired added/deleted bar per ranked name, so
 * both measures stay separately readable rather than being netted into one
 * "changed lines" bar. Callers rank and truncate the data (all features; top 5
 * for model/language) — this component only renders whatever it is given, and
 * grows to fit every row rather than clipping the tail silently.
 */
export function LocGroupedBarChart({ data, labelWidth = 150, emptyMessage, note }: Props) {
  if (data.length === 0) {
    return <p className="empty">{emptyMessage ?? 'No attributed LoC data for this range.'}</p>
  }

  const Tip = makeTooltip(fmtNumber, (name) => name)
  const height = Math.max(MIN_HEIGHT, data.length * ROW_HEIGHT + 44)

  return (
    <>
      <ChartFrame height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 0 }} barGap={2}>
          <XAxis type="number" tickFormatter={fmtCompact} tick={tickStyle} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={labelWidth}
            tick={categoryAxisTick(labelWidth)}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <Tooltip content={Tip} cursor={{ fill: 'var(--surface-2)' }} />
          <Legend wrapperStyle={{ color: ink.secondary, fontSize: 12 }} />
          <Bar
            dataKey="locAdded"
            name="Added"
            fill={measureColor.locAdded}
            radius={[3, 3, 3, 3]}
            isAnimationActive={false}
          />
          <Bar
            dataKey="locDeleted"
            name="Deleted"
            fill={measureColor.locDeleted}
            radius={[3, 3, 3, 3]}
            isAnimationActive={false}
          />
        </BarChart>
      </ChartFrame>
      {note && <p className="card__note">{note}</p>}
    </>
  )
}
