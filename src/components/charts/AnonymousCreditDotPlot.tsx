import type { TooltipContentProps } from 'recharts'
import { CartesianGrid, ReferenceArea, ReferenceLine, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'
import type { CreditDistribution } from '../../data/metrics'
import { chrome, ink, measureColor, tickStyle } from '../../theme/palette'
import { fmtCompact, fmtNumber } from '../../format'
import { ChartFrame } from './ChartFrame'

/**
 * Required interpretation copy: the y position is an anonymous ordinal with
 * no meaning of its own (it does not sort by anything a reader could re-key
 * to an identity), so this states plainly what the shaded band and mean line
 * are before a reader tries to read the y-axis as one.
 */
export const CREDIT_DOT_PLOT_NOTE =
  'Each point is one user\u2019s total AI credits for the selected period, placed at an anonymous position that carries no identity. The solid line is the population mean; the shaded band is \u00B11 population standard deviation.'

/** Same interpretation as {@link CREDIT_DOT_PLOT_NOTE}, but for each user's mean daily consumption rather than their period total. */
export const DAILY_CREDIT_DOT_PLOT_NOTE =
  'Each point is one user\u2019s mean daily AI credits over the selected period, placed at an anonymous position that carries no identity. The solid line is the population mean; the shaded band is \u00B11 population standard deviation.'

interface Props {
  data: CreditDistribution
  /** Axis, series, and tooltip label for the measure being plotted. Defaults to the period-total wording. */
  axisLabel?: string
  note?: string
}

const HEIGHT = 260

function makeCreditTooltip(axisLabel: string) {
  return function CreditTooltip({ active, payload }: TooltipContentProps) {
    if (!active || !payload?.length) return null
    const credits = payload[0]?.payload?.credits as number | undefined
    if (credits === undefined) return null

    return (
      <div className="tooltip">
        <div className="tooltip__label">Anonymous user</div>
        <div className="tooltip__row">
          <span className="tooltip__swatch" style={{ background: measureColor.aiCredits }} />
          <span>{axisLabel}</span>
          <span className="tooltip__value">{fmtNumber(credits)}</span>
        </div>
      </div>
    )
  }
}

/**
 * Anonymous per-user AI credit dot plot: one point per user for whichever
 * credit measure is passed in (period total by default, or a per-user daily
 * mean), placed at an anonymous ordinal — never a user id, login, or stable
 * pseudonym. The y-axis ticks show that ordinal's numeric position (0..N),
 * not an identity — it is just a rank/count scale, so it stays anonymous
 * while giving a sense of how many users are plotted.
 *
 * Mean and \u00b11 population-standard-deviation markers come straight from
 * the aggregation (`CreditDistribution`) rather than being recomputed here,
 * so they can never drift from the number this chart is illustrating. They
 * are drawn as a shaded band plus a bold mean line — deliberately higher
 * contrast than a typical reference line, since they carry the chart's main
 * point rather than being incidental gridlines.
 */
export function AnonymousCreditDotPlot({ data, axisLabel = 'AI credits', note = CREDIT_DOT_PLOT_NOTE }: Props) {
  if (data.points.length === 0) {
    return <p className="empty">No users in this range.</p>
  }

  const color = measureColor.aiCredits
  const upper = data.mean + data.stdDev
  // Credits are never negative; a 1-SD band that dipped below 0 would imply a
  // value that cannot occur, the same convention as the LoC deviation bands.
  const lower = Math.max(0, data.mean - data.stdDev)
  const maxCredits = Math.max(...data.points.map((p) => p.credits))
  // An all-zero population (or a single point) would otherwise leave the axis
  // with a zero-height domain; give it a minimal, still-legible span instead.
  const domainRight = Math.max(upper, maxCredits, 1) * 1.1
  const CreditTooltip = makeCreditTooltip(axisLabel)

  return (
    <>
      <ChartFrame height={HEIGHT}>
        <ScatterChart margin={{ top: 28, right: 16, bottom: 28, left: 8 }}>
          <CartesianGrid stroke={chrome.grid} horizontal={false} />
          <XAxis
            type="number"
            dataKey="credits"
            name={axisLabel}
            domain={[0, domainRight]}
            tickFormatter={fmtCompact}
            tick={tickStyle}
            tickLine={false}
            axisLine={{ stroke: chrome.axis }}
          />
          <YAxis
            type="number"
            dataKey="index"
            name="Anonymous user"
            domain={[-1, data.points.length]}
            allowDecimals={false}
            tickFormatter={(value) => (value < 0 || value > data.points.length - 1 ? '' : fmtNumber(value))}
            tick={tickStyle}
            tickLine={false}
            axisLine={false}
            width={40}
            label={{
              value: 'Users',
              angle: -90,
              position: 'insideLeft',
              fill: ink.muted,
              fontSize: 12,
            }}
          />
          <Tooltip content={CreditTooltip} cursor={{ strokeDasharray: '3 3', stroke: chrome.axis }} />

          {/* Shaded ±1 population-standard-deviation band — a filled area, not just thin lines, so the spread reads at a glance. */}
          <ReferenceArea x1={lower} x2={upper} fill={color} fillOpacity={0.16} stroke="none" ifOverflow="extendDomain" />
          <ReferenceLine
            x={upper}
            stroke={color}
            strokeWidth={2}
            strokeDasharray="5 3"
            ifOverflow="extendDomain"
            label={{ value: '+1 SD', position: 'top', fill: color, fontSize: 11, fontWeight: 600 }}
          />
          <ReferenceLine
            x={lower}
            stroke={color}
            strokeWidth={2}
            strokeDasharray="5 3"
            ifOverflow="extendDomain"
            label={{ value: '\u22121 SD', position: 'top', fill: color, fontSize: 11, fontWeight: 600 }}
          />
          <ReferenceLine
            x={data.mean}
            stroke={ink.primary}
            strokeWidth={2.5}
            label={{
              value: `Mean: ${fmtCompact(data.mean)}`,
              position: 'insideBottomRight',
              fill: ink.primary,
              fontSize: 12,
              fontWeight: 700,
            }}
          />

          <Scatter data={data.points} fill={color} fillOpacity={0.65} isAnimationActive={false} />
        </ScatterChart>
      </ChartFrame>
      <p className="card__note">{note}</p>
    </>
  )
}
