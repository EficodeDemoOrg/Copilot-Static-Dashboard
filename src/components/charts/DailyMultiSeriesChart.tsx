import { Area, AreaChart, CartesianGrid, ComposedChart, Legend, Line, Tooltip, XAxis, YAxis } from 'recharts'
import { chrome, ink, tickStyle } from '../../theme/palette'
import { fmtCompact, fmtDayLong, fmtDayShort, fmtNumber } from '../../format'
import { makeTooltip } from './ChartTooltip'
import { ChartFrame } from './ChartFrame'

/** One plotted series: a data key, its legend/tooltip label, and its stroke/fill color. */
export interface DailySeries {
  key: string
  name: string
  color: string
}

/**
 * A daily row: the calendar day plus one numeric value per series key.
 * Deliberately has no index signature — callers pass their own concrete
 * `DayPoint`/`SurfaceDayPoint`/feature-row shapes, and Recharts resolves each
 * series' `dataKey` against the row at runtime rather than through this type.
 */
export type DailyMultiSeriesRow = { date: string }

interface Props {
  data: readonly DailyMultiSeriesRow[]
  series: readonly DailySeries[]
  /** `area` stacks every series into one readable total (e.g. feature composition); `line` draws independent series for direct comparison (e.g. two counts on a shared axis). */
  variant: 'area' | 'line'
  height?: number
  valueFormatter?: (n: number) => string
  /** Shown instead of the chart when there is nothing to plot. */
  emptyMessage?: string
}

const DEFAULT_HEIGHT = 260

/**
 * Shared daily multi-series chart primitive behind every "per day, broken
 * down by X" card: feature interactions, generations/acceptances, and
 * surface usage all plug their own series and variant into this one
 * component rather than duplicating axes, ticks, tooltip, and legend wiring.
 * Animations stay off throughout for stable PDF output, and the x-axis tick
 * interval thins itself once the range gets long so day labels never overlap.
 */
export function DailyMultiSeriesChart({
  data,
  series,
  variant,
  height = DEFAULT_HEIGHT,
  valueFormatter = fmtNumber,
  emptyMessage,
}: Props) {
  if (data.length === 0 || series.length === 0) {
    return <p className="empty">{emptyMessage ?? 'No dated records in this range.'}</p>
  }

  const Tip = makeTooltip(valueFormatter, fmtDayLong)
  const tickGap = Math.max(1, Math.ceil(data.length / 12))

  const axes = (
    <>
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
      <Tooltip
        content={Tip}
        cursor={variant === 'area' ? { stroke: chrome.axis, strokeWidth: 1 } : { fill: 'var(--surface-2)' }}
      />
      {/* Series are declared in caller-provided order, so the legend (e.g. ranked features, then "Other") stays ordered too. */}
      <Legend wrapperStyle={{ color: ink.secondary, fontSize: 12 }} />
    </>
  )

  return (
    <ChartFrame height={height}>
      {variant === 'area' ? (
        <AreaChart data={data} margin={{ top: 8, right: 22, bottom: 0, left: 0 }}>
          {axes}
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stackId="daily"
              stroke={s.color}
              fill={s.color}
              fillOpacity={0.55}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      ) : (
        <ComposedChart data={data} margin={{ top: 8, right: 22, bottom: 0, left: 0 }}>
          {axes}
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: chrome.surface }}
              isAnimationActive={false}
            />
          ))}
        </ComposedChart>
      )}
    </ChartFrame>
  )
}
