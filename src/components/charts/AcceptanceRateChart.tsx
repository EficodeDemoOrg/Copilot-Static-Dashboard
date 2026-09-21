import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts'
import type { DayPoint } from '../../data/metrics'
import { chrome, measureColor, tickStyle } from '../../theme/palette'
import { fmtDayLong, fmtDayShort, fmtPercent } from '../../format'
import { makeTooltip } from './ChartTooltip'
import { ChartFrame } from './ChartFrame'

interface Props {
  data: DayPoint[]
  /** Period average, drawn as a reference line so daily noise has a baseline. */
  average: number | null
}

const HEIGHT = 240

/**
 * Acceptance rate is the one bounded quality metric in this export:
 * acceptances / generations, fixed to a 0–100% axis so a quiet week cannot be
 * made to look like a crisis by auto-scaling.
 *
 * Days with no generations carry `null`, and `connectNulls={false}` leaves a gap
 * for them. Plotting those as 0% would read as a collapse in quality when it is
 * really an absence of data.
 */
export function AcceptanceRateChart({ data, average }: Props) {
  const color = measureColor.acceptanceRate
  const Tip = makeTooltip((v) => fmtPercent(v), fmtDayLong)

  const tickGap = Math.max(1, Math.ceil(data.length / 12))

  return (
    <ChartFrame height={HEIGHT}>
      <LineChart data={data} margin={{ top: 8, right: 22, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={chrome.grid} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmtDayShort}
          interval={tickGap - 1}
          tick={tickStyle}
          tickLine={false}
          axisLine={{ stroke: chrome.axis }}
          minTickGap={8}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tickFormatter={(v: number) => `${v}%`}
          tick={tickStyle}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip content={<Tip />} cursor={{ stroke: chrome.axis, strokeWidth: 1 }} />
        {average !== null && (
          <ReferenceLine y={average} stroke={chrome.axis} strokeDasharray="4 4" />
        )}
        <Line
          type="monotone"
          dataKey="acceptanceRate"
          name="Acceptance rate"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: chrome.surface }}
          connectNulls={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartFrame>
  )
}
