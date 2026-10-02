import type { TooltipContentProps } from 'recharts'
import {
  CartesianGrid,
  ReferenceLine,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { userCreditCorrelation, userCreditTrendSegment } from '../../data/metrics'
import type {
  AnonymousUserCreditPoint,
  UserCreditScatterMeasure,
} from '../../data/metrics'
import { fmtCompact, fmtNumber } from '../../format'
import { chrome, ink, measureColor, tickStyle } from '../../theme/palette'
import { ChartFrame } from './ChartFrame'

interface MeasureConfig {
  axisLabel: string
  ariaLabel: string
  note: string
  tooltipLabel: string
  tooltipSwatch: string
}

const MEASURE_CONFIG: Record<UserCreditScatterMeasure, MeasureConfig> = {
  requests: {
    axisLabel: 'Requests',
    ariaLabel: 'Requests versus AI credits consumed per anonymous user',
    note:
      'Each point is one anonymous user. Requests include all user-initiated interactions in the selected records; AI credits include only records where ai_credits_used was reported. Users with no reported credit values are excluded, and tooltips identify partial credit coverage. AI credits are a usage signal, not an invoice total.',
    tooltipLabel: 'Requests',
    tooltipSwatch: measureColor.interactions,
  },
  codeChanges: {
    axisLabel: 'Lines of Code changed',
    ariaLabel: 'Lines of Code changed versus AI credits consumed per anonymous user',
    note:
      'Each point is one anonymous user. Lines of Code changed is lines added + lines deleted across the selected records; AI credits include only records where ai_credits_used was reported. Users with no reported credit values are excluded, and tooltips identify partial credit coverage. AI credits are a usage signal, not an invoice total.',
    tooltipLabel: 'Lines changed',
    tooltipSwatch: `linear-gradient(90deg, ${measureColor.locAdded} 50%, ${measureColor.locDeleted} 50%)`,
  },
}

interface Props {
  data: AnonymousUserCreditPoint[]
  measure: UserCreditScatterMeasure
  ariaLabelSuffix?: string
  emptyMessage?: string
  noteSuffix?: string
}

const HEIGHT = 320

function isUserCreditPoint(value: unknown): value is AnonymousUserCreditPoint {
  if (typeof value !== 'object' || value === null) return false
  const point = value as Record<string, unknown>
  return (
    typeof point['requests'] === 'number' &&
    typeof point['codeChanges'] === 'number' &&
    typeof point['credits'] === 'number' &&
    typeof point['reportedCreditRecords'] === 'number' &&
    typeof point['totalRecords'] === 'number'
  )
}

function makeUserCreditTooltip(measure: UserCreditScatterMeasure, config: MeasureConfig) {
  return function UserCreditTooltip({ active, payload }: TooltipContentProps) {
    if (!active || !payload?.length) return null
    const point = payload[0]?.payload
    if (!isUserCreditPoint(point)) return null

    const partial = point.reportedCreditRecords < point.totalRecords

    return (
      <div className="tooltip">
        <div className="tooltip__label">Anonymous user</div>
        <div className="tooltip__row">
          <span className="tooltip__swatch" style={{ background: measureColor.aiCredits }} />
          <span>Reported AI credits</span>
          <span className="tooltip__value">{fmtNumber(point.credits)}</span>
        </div>
        <div className="tooltip__row">
          <span className="tooltip__swatch" style={{ background: config.tooltipSwatch }} />
          <span>{config.tooltipLabel}</span>
          <span className="tooltip__value">{fmtNumber(point[measure])}</span>
        </div>
        {partial && (
          <div className="tooltip__note">
            Credits reported for {fmtNumber(point.reportedCreditRecords)} of{' '}
            {fmtNumber(point.totalRecords)} selected records
          </div>
        )}
      </div>
    )
  }
}

export function UserCreditScatterChart({
  data,
  measure,
  ariaLabelSuffix,
  emptyMessage,
  noteSuffix,
}: Props) {
  if (data.length === 0) {
    return (
      <p className="empty">
        {emptyMessage ?? 'No users with reported AI credit data in this range.'}
      </p>
    )
  }

  const config = MEASURE_CONFIG[measure]
  const UserCreditTooltip = makeUserCreditTooltip(measure, config)
  const trendSegment = userCreditTrendSegment(data, measure)
  const correlation = userCreditCorrelation(data, measure)
  const correlationLabel = correlation
    ? `${correlation.strength.charAt(0).toUpperCase()}${correlation.strength.slice(1)}${
        correlation.direction === 'none' ? '' : ` ${correlation.direction}`
      }`
    : 'Unavailable'

  return (
    <>
      <div
        role="group"
        aria-label={`${config.ariaLabel}${ariaLabelSuffix ? ` ${ariaLabelSuffix}` : ''}`}
      >
        <div className="credit-correlation">
          <span className="credit-correlation__label">Pearson correlation</span>
          <strong className="credit-correlation__strength">{correlationLabel}</strong>
          <span className="credit-correlation__detail">
            {correlation
              ? `r = ${correlation.coefficient.toFixed(2)} · ${data.length.toLocaleString()} displayed users`
              : 'Requires at least 3 users and variation on both axes'}
          </span>
        </div>
        <ChartFrame height={HEIGHT}>
          <ScatterChart
            margin={{ top: 12, right: 20, bottom: 34, left: 12 }}
            accessibilityLayer
          >
            <CartesianGrid stroke={chrome.grid} />
            <XAxis
              type="number"
              dataKey="credits"
              name="AI credits consumed"
              domain={[0, (maximum: number) => Math.max(1, maximum * 1.05)]}
              tickFormatter={fmtCompact}
              tick={tickStyle}
              tickLine={false}
              axisLine={{ stroke: chrome.axis }}
              label={{
                value: 'Total reported AI credits',
                position: 'insideBottom',
                offset: -22,
                fill: ink.muted,
                fontSize: 12,
              }}
            />
            <YAxis
              type="number"
              dataKey={measure}
              name={config.axisLabel}
              domain={[0, (maximum: number) => Math.max(1, maximum * 1.05)]}
              allowDecimals={false}
              tickFormatter={fmtCompact}
              tick={tickStyle}
              tickLine={false}
              axisLine={false}
              width={58}
              label={{
                value: config.axisLabel,
                angle: -90,
                position: 'insideLeft',
                fill: ink.muted,
                fontSize: 12,
              }}
            />
            <Tooltip
              content={UserCreditTooltip}
              cursor={{ stroke: chrome.axis, strokeDasharray: '3 3' }}
            />
            {trendSegment && (
              <ReferenceLine
                segment={trendSegment}
                stroke={ink.primary}
                strokeWidth={2}
                strokeDasharray="7 5"
                ifOverflow="hidden"
              />
            )}
            <Scatter
              data={data}
              name="Anonymous users"
              fill={measureColor.aiCredits}
              fillOpacity={0.68}
              stroke={measureColor.aiCredits}
              isAnimationActive={false}
            />
          </ScatterChart>
        </ChartFrame>
      </div>
      <p className="card__note">
        {config.note}
        {trendSegment
          ? ' The dashed line is the ordinary least-squares linear trend for the displayed users; it describes association, not causation.'
          : ' A linear trend is not shown because the displayed data has insufficient variation in reported credits.'}
        {noteSuffix ? ` ${noteSuffix}` : ''}
      </p>
    </>
  )
}
