import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import type { DayPoint } from '../../data/metrics'
import { chrome, measureColor, tickStyle } from '../../theme/palette'
import { fmtCompact, fmtDayLong, fmtDayShort, fmtNumber } from '../../format'
import { makeTooltip } from './ChartTooltip'
import { ChartFrame } from './ChartFrame'

/** The countable measures on a DayPoint — acceptanceRate has its own chart. */
type Measure = 'activeUsers' | 'interactions' | 'generations' | 'acceptances'

interface Props {
  data: DayPoint[]
  measure: Measure
  label: string
}

const HEIGHT = 240

export function DailyUsageChart({ data, measure, label }: Props) {
  const color = measureColor[measure]
  const Tip = makeTooltip(fmtNumber, fmtDayLong)

  // Thin the ticks once the range gets long, so day labels never collide.
  const tickGap = Math.max(1, Math.ceil(data.length / 12))
  const gradientId = `daily-fill-${measure}`

  return (
    <ChartFrame height={HEIGHT}>
      <AreaChart data={data} margin={{ top: 8, right: 22, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
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
        <YAxis tickFormatter={fmtCompact} tick={tickStyle} tickLine={false} axisLine={false} width={48} />
        <Tooltip content={Tip} cursor={{ stroke: chrome.axis, strokeWidth: 1 }} />
        <Area
          type="monotone"
          dataKey={measure}
          name={label}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: chrome.surface }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartFrame>
  )
}
