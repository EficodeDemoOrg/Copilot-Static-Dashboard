import { Bar, BarChart, Cell, LabelList, Tooltip, XAxis, YAxis } from 'recharts'
import type { CustomizationRanking, NamedTotal } from '../../data/metrics'
import { ink, measureColor, otherFill, tickStyle } from '../../theme/palette'
import { fmtCompact, fmtNumber } from '../../format'
import { makeTooltip } from './ChartTooltip'
import { ChartFrame } from './ChartFrame'
import { categoryAxisTick } from './CategoryAxisTick'

/** Any ranked row this chart can plot — feature/measure totals, or a customization ranking. */
type RankedDatum = NamedTotal | CustomizationRanking

/** The countable numeric fields across every shape this chart accepts. */
type Measure = Exclude<keyof NamedTotal, 'name'> | Exclude<keyof CustomizationRanking, 'name'>

interface Props {
  data: RankedDatum[]
  measure: Measure
  /** Series name shown in the tooltip. */
  label: string
  /** Axis label width — user logins and model names need different room. */
  labelWidth?: number
  /** Bar color override; defaults to the measure's themed color, falling back to the interaction hue. */
  color?: string
  /** Shown instead of the chart when `data` is empty — the caller knows why (no export, nothing recorded, …). */
  emptyMessage?: string
}

const ROW_HEIGHT = 26
const MIN_HEIGHT = 140

/**
 * Horizontal ranked bars — one series, so identity comes from the category axis
 * and color is decoration rather than an encoding. Values are labelled directly
 * at the bar end: it removes a lookup, and it satisfies the relief rule for the
 * palette slots that sit under 3:1 on the light surface.
 *
 * Shared by feature/measure totals (`NamedTotal`) and the top-five customization
 * rankings (`CustomizationRanking`) — callers rank and truncate the data; this
 * component only renders whatever it is given.
 */
export function RankedBarChart({ data, measure, label, labelWidth = 150, color, emptyMessage }: Props) {
  if (data.length === 0) {
    return <p className="empty">{emptyMessage ?? 'No data for this range.'}</p>
  }

  // Volume measures share the interaction hue; anything else falls back to it.
  const resolvedColor = color ?? measureColor[measure as keyof typeof measureColor] ?? measureColor.interactions
  const Tip = makeTooltip(fmtNumber, (name) => name)

  const height = Math.max(MIN_HEIGHT, data.length * ROW_HEIGHT + 28)

  return (
    <ChartFrame height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 0 }} barCategoryGap={4}>
        <XAxis type="number" tickFormatter={fmtCompact} tick={tickStyle} tickLine={false} axisLine={false} hide />
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
        <Bar dataKey={measure} name={label} radius={[4, 4, 4, 4]} isAnimationActive={false}>
          {data.map((d) => (
            // "Other" is a remainder, not a category — keep it neutral.
            <Cell key={d.name} fill={d.name === 'Other' ? otherFill : resolvedColor} />
          ))}
          <LabelList
            dataKey={measure}
            position="right"
            formatter={(value) => fmtNumber(Number(value))}
            style={{ fill: ink.secondary, fontSize: 12 }}
          />
        </Bar>
      </BarChart>
    </ChartFrame>
  )
}
