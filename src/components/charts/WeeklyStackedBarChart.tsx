import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from 'recharts'
import type { WeeklyStackedData } from '../../data/metrics'
import { fmtCompact, fmtDateIntervalLong, fmtDateIntervalShort, fmtNumber } from '../../format'
import { chrome, ink, otherFill, series as palette, tickStyle } from '../../theme/palette'
import { ChartFrame } from './ChartFrame'
import { makeTooltip } from './ChartTooltip'

interface Props {
  data: WeeklyStackedData
  emptyMessage: string
  labelFormatter?: (label: string) => string
  height?: number
}

const DEFAULT_HEIGHT = 300

export function WeeklyStackedBarChart({
  data,
  emptyMessage,
  labelFormatter = (label) => label,
  height = DEFAULT_HEIGHT,
}: Props) {
  const hasValues = data.points.some((point) =>
    data.series.some((item) => (point.values[item.key] ?? 0) > 0),
  )
  if (data.series.length === 0 || data.points.length === 0 || !hasValues) {
    return <p className="empty">{emptyMessage}</p>
  }

  const rows = data.points.map((point) => ({
    weekStart: point.weekStart,
    weekEnd: point.weekEnd,
    ...point.values,
  }))
  const endByStart = new Map(data.points.map((point) => [point.weekStart, point.weekEnd]))
  const Tip = makeTooltip(fmtNumber, (start) =>
    fmtDateIntervalLong(start, endByStart.get(start) ?? start),
  )
  let colorIndex = 0
  const renderedSeries = data.series.map((item) => ({
    ...item,
    name: labelFormatter(item.label),
    color: item.neutral ? otherFill : palette[colorIndex++ % palette.length]!,
  }))

  return (
    <ChartFrame height={height}>
      <BarChart data={rows} margin={{ top: 8, right: 22, bottom: 0, left: 0 }} barCategoryGap="20%">
        <CartesianGrid stroke={chrome.grid} vertical={false} />
        <XAxis
          dataKey="weekStart"
          tickFormatter={(start) =>
            fmtDateIntervalShort(String(start), endByStart.get(String(start)) ?? String(start))
          }
          interval={0}
          tick={tickStyle}
          tickLine={false}
          axisLine={{ stroke: chrome.axis }}
          minTickGap={6}
        />
        <YAxis
          tickFormatter={fmtCompact}
          tick={tickStyle}
          tickLine={false}
          axisLine={false}
          width={48}
          allowDecimals={false}
        />
        <Tooltip content={Tip} cursor={{ fill: 'var(--surface-2)' }} />
        <Legend wrapperStyle={{ color: ink.secondary, fontSize: 12 }} />
        {renderedSeries.map((item) => (
          <Bar
            key={item.key}
            dataKey={item.key}
            name={item.name}
            stackId="weekly"
            fill={item.color}
            stroke={chrome.surface}
            strokeWidth={0.5}
            maxBarSize={72}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ChartFrame>
  )
}
