import { Bar, BarChart, Cell, LabelList, Tooltip, XAxis, YAxis } from 'recharts'
import type { NamedTotal } from '../../data/metrics'
import { ink, measureColor, otherFill, tickStyle } from '../../theme/palette'
import { fmtCompact, fmtNumber } from '../../format'
import { makeTooltip } from './ChartTooltip'
import { ChartFrame } from './ChartFrame'

/** The countable fields on a NamedTotal. */
type Measure = 'interactions' | 'generations' | 'acceptances' | 'locAdded' | 'aiCredits' | 'activeDays'

interface Props {
  data: NamedTotal[]
  measure: Measure
  /** Series name shown in the tooltip. */
  label: string
  /** Axis label width — user logins and model names need different room. */
  labelWidth?: number
}

const ROW_HEIGHT = 26
const MIN_HEIGHT = 140

/**
 * Horizontal ranked bars — one series, so identity comes from the category axis
 * and color is decoration rather than an encoding. Values are labelled directly
 * at the bar end: it removes a lookup, and it satisfies the relief rule for the
 * palette slots that sit under 3:1 on the light surface.
 */
export function RankedBarChart({ data, measure, label, labelWidth = 150 }: Props) {
  // Volume measures share the interaction hue; anything else falls back to it.
  const color = measureColor[measure as keyof typeof measureColor] ?? measureColor.interactions
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
          tick={tickStyle}
          tickLine={false}
          axisLine={false}
          interval={0}
        />
        <Tooltip content={Tip} cursor={{ fill: 'var(--surface-2)' }} />
        <Bar dataKey={measure} name={label} radius={[4, 4, 4, 4]} isAnimationActive={false}>
          {data.map((d) => (
            // "Other" is a remainder, not a category — keep it neutral.
            <Cell key={d.name} fill={d.name === 'Other' ? otherFill : color} />
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
