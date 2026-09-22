import type { TooltipContentProps } from 'recharts'
import { CartesianGrid, ReferenceLine, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'
import type { CreditDistribution } from '../../data/metrics'
import { chrome, ink, measureColor, tickStyle } from '../../theme/palette'
import { fmtCompact, fmtNumber } from '../../format'
import { ChartFrame } from './ChartFrame'

/**
 * Required interpretation copy: the x position is an anonymous ordinal with
 * no meaning of its own (it does not sort by anything a reader could re-key
 * to an identity), so this states plainly what the dashed/shaded reference
 * lines are before a reader tries to read the x-axis as one.
 */
export const CREDIT_DOT_PLOT_NOTE =
  'Each point is one user\u2019s total AI credits for the selected period, placed at an anonymous position that carries no identity. The dashed line is the population mean; the shaded band is \u00B11 population standard deviation.'

interface Props {
  data: CreditDistribution
}

const HEIGHT = 260

function CreditTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const credits = payload[0]?.payload?.credits as number | undefined
  if (credits === undefined) return null

  return (
    <div className="tooltip">
      <div className="tooltip__label">Anonymous user</div>
      <div className="tooltip__row">
        <span className="tooltip__swatch" style={{ background: measureColor.aiCredits }} />
        <span>AI credits</span>
        <span className="tooltip__value">{fmtNumber(credits)}</span>
      </div>
    </div>
  )
}

/**
 * Anonymous per-user AI credit dot plot: one point per user's total credits
 * for the selected period, placed at an anonymous ordinal — never a user id,
 * login, or stable pseudonym. The x-axis carries no ticks or category labels
 * for the same reason: an ordinal that could be read back against an upload
 * order or another chart would stop being anonymous.
 *
 * Mean and \u00b11 population-standard-deviation lines come straight from the
 * aggregation (`CreditDistribution`) rather than being recomputed here, so
 * they can never drift from the number this chart is illustrating.
 */
export function AnonymousCreditDotPlot({ data }: Props) {
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
  const domainTop = Math.max(upper, maxCredits, 1) * 1.1

  return (
    <>
      <ChartFrame height={HEIGHT}>
        <ScatterChart margin={{ top: 8, right: 44, bottom: 8, left: 0 }}>
          <CartesianGrid stroke={chrome.grid} vertical={false} />
          <XAxis
            type="number"
            dataKey="index"
            name="Anonymous user"
            domain={[-1, data.points.length]}
            tick={false}
            tickLine={false}
            axisLine={{ stroke: chrome.axis }}
            label={{ value: 'Users (anonymous)', position: 'insideBottom', offset: -4, fill: ink.muted, fontSize: 12 }}
          />
          <YAxis
            type="number"
            dataKey="credits"
            name="AI credits"
            domain={[0, domainTop]}
            tickFormatter={fmtCompact}
            tick={tickStyle}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip content={CreditTooltip} cursor={{ strokeDasharray: '3 3', stroke: chrome.axis }} />

          {/* Shaded ±1 population-standard-deviation band, drawn as two dashed bounds. */}
          <ReferenceLine y={upper} stroke={color} strokeDasharray="2 2" strokeOpacity={0.6} ifOverflow="extendDomain" />
          <ReferenceLine y={lower} stroke={color} strokeDasharray="2 2" strokeOpacity={0.6} ifOverflow="extendDomain" />
          <ReferenceLine
            y={data.mean}
            stroke={chrome.axis}
            strokeDasharray="4 4"
            label={{ value: 'Mean', position: 'right', fill: ink.muted, fontSize: 11 }}
          />

          <Scatter data={data.points} fill={color} fillOpacity={0.65} isAnimationActive={false} />
        </ScatterChart>
      </ChartFrame>
      <p className="card__note">{CREDIT_DOT_PLOT_NOTE}</p>
    </>
  )
}
