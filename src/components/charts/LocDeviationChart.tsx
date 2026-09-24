import type { TooltipContentProps } from 'recharts'
import { Area, CartesianGrid, ComposedChart, Legend, Line, Tooltip, XAxis, YAxis } from 'recharts'
import type { LocDeviationDayPoint } from '../../data/metrics'
import { chrome, ink, measureColor, tickStyle } from '../../theme/palette'
import { fmtCompact, fmtDayLong, fmtDayShort, fmtNumber } from '../../format'
import { ChartFrame } from './ChartFrame'
import { WeekendBands } from './WeekendBands'

/**
 * Required interpretation copy: the band is a spread between users on one day,
 * not between daily organization totals — those are very different claims and
 * easy to conflate on a chart that looks like a normal time series.
 */
export const LOC_DEVIATION_NOTE =
  "Bands show the mean ±1 population standard deviation across that day's user records — variation between users on a given day, not variation between daily organization totals. Lower bounds are floored at 0 rather than shown as negative lines of code."

interface Props {
  data: LocDeviationDayPoint[]
}

interface ChartRow extends LocDeviationDayPoint {
  addedBand: number
  deletedBand: number
}

const HEIGHT = 260

function LocDeviationTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload as ChartRow | undefined
  if (!row) return null

  return (
    <div className="tooltip">
      <div className="tooltip__label">{fmtDayLong(String(label))}</div>
      <div className="tooltip__row">
        <span className="tooltip__swatch" style={{ background: measureColor.locAdded }} />
        <span>Added</span>
        <span className="tooltip__value">
          {fmtNumber(row.locAddedMean)} (±{fmtNumber(row.locAddedUpper - row.locAddedMean)})
        </span>
      </div>
      <div className="tooltip__row">
        <span className="tooltip__swatch" style={{ background: measureColor.locDeleted }} />
        <span>Deleted</span>
        <span className="tooltip__value">
          {fmtNumber(row.locDeletedMean)} (±{fmtNumber(row.locDeletedUpper - row.locDeletedMean)})
        </span>
      </div>
    </div>
  )
}

/**
 * Dedicated daily LoC deviation chart: mean added/deleted lines with ±1
 * population-standard-deviation bands, one pair per day. The band is drawn
 * with the standard stacked-area trick — a transparent area up to the lower
 * bound, then a filled area for the remaining `upper - lower` span — so each
 * band floats at the right height without ever implying a value below 0.
 */
export function LocDeviationChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="empty">No dated records in this range.</p>
  }

  const chartData: ChartRow[] = data.map((d) => ({
    ...d,
    addedBand: Math.max(0, d.locAddedUpper - d.locAddedLower),
    deletedBand: Math.max(0, d.locDeletedUpper - d.locDeletedLower),
  }))

  const tickGap = Math.max(1, Math.ceil(data.length / 12))

  return (
    <>
      <ChartFrame height={HEIGHT}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 22, bottom: 0, left: 0 }}>
          <WeekendBands dates={chartData.map((point) => point.date)} />
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
          <Tooltip content={LocDeviationTooltip} cursor={{ stroke: chrome.axis, strokeWidth: 1 }} />
          <Legend wrapperStyle={{ color: ink.secondary, fontSize: 12 }} />

          {/* Added: transparent filler up to the lower bound, then the visible ±1 SD band. */}
          <Area
            dataKey="locAddedLower"
            stackId="added"
            stroke="none"
            fill="transparent"
            isAnimationActive={false}
            legendType="none"
            name="Added lower bound"
          />
          <Area
            dataKey="addedBand"
            stackId="added"
            stroke="none"
            fill={measureColor.locAdded}
            fillOpacity={0.18}
            isAnimationActive={false}
            legendType="none"
            name="Added ±1 SD"
          />
          <Line
            dataKey="locAddedMean"
            name="Added (mean)"
            stroke={measureColor.locAdded}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: chrome.surface }}
            isAnimationActive={false}
          />

          {/* Deleted: same band construction, independent stack so the two bands never combine. */}
          <Area
            dataKey="locDeletedLower"
            stackId="deleted"
            stroke="none"
            fill="transparent"
            isAnimationActive={false}
            legendType="none"
            name="Deleted lower bound"
          />
          <Area
            dataKey="deletedBand"
            stackId="deleted"
            stroke="none"
            fill={measureColor.locDeleted}
            fillOpacity={0.18}
            isAnimationActive={false}
            legendType="none"
            name="Deleted ±1 SD"
          />
          <Line
            dataKey="locDeletedMean"
            name="Deleted (mean)"
            stroke={measureColor.locDeleted}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: chrome.surface }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ChartFrame>
      <p className="card__note">{LOC_DEVIATION_NOTE}</p>
    </>
  )
}
