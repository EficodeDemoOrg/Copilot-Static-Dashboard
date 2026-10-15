import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import type { CustomizationDefinition } from '../../data/customizations'
import { CUSTOMIZATION_COVERAGE_NOTE } from '../../data/customizations'
import type { CustomizationUsageDistribution } from '../../data/metrics'
import { fmtNumber } from '../../format'
import { chrome, ink, measureColor, tickStyle } from '../../theme/palette'
import { ChartFrame } from './ChartFrame'
import { makeTooltip } from './ChartTooltip'

export const USAGE_BINS_PER_CHART = 20

interface Props {
  data: CustomizationUsageDistribution
  definition: CustomizationDefinition
}

export function CustomizationUsageChart({ data, definition }: Props) {
  if (data.bins.length === 0) {
    return (
      <p className="empty">
        No usable {definition.plural} reporting for {fmtNumber(data.unavailableUsers)} users in
        this range. Unavailable data is not zero usage.
      </p>
    )
  }

  const segments = []
  for (let offset = 0; offset < data.bins.length; offset += USAGE_BINS_PER_CHART) {
    segments.push(data.bins.slice(offset, offset + USAGE_BINS_PER_CHART))
  }
  const maxUsers = Math.max(...data.bins.map((bin) => bin.users))
  const Tip = makeTooltip(fmtNumber, (usages) =>
    `${fmtNumber(Number(usages))} recorded ${definition.unit} per user`,
  )

  return (
    <div className="customization-distribution">
      {segments.map((bins, index) => (
        <div
          className="customization-distribution__segment"
          role="group"
          aria-label={`${definition.label} recorded usage per user, segment ${index + 1} of ${segments.length}`}
          key={index}
        >
          {segments.length > 1 && (
            <p className="card__note">
              Exact counts {fmtNumber(bins[0]!.usages)} to {fmtNumber(bins[bins.length - 1]!.usages)}
              {' '}(segment {index + 1} of {segments.length})
            </p>
          )}
          <ChartFrame height={280}>
            <BarChart data={bins} margin={{ top: 8, right: 18, bottom: 38, left: 16 }} accessibilityLayer>
              <CartesianGrid stroke={chrome.grid} vertical={false} />
              <XAxis
                dataKey="usages"
                type="category"
                tickFormatter={fmtNumber}
                tick={tickStyle}
                tickLine={false}
                axisLine={{ stroke: chrome.axis }}
                minTickGap={8}
                interval="preserveStartEnd"
                label={{
                  value: `Recorded ${definition.unit} per user`,
                  position: 'insideBottom',
                  offset: -28,
                  fill: ink.muted,
                  fontSize: 11,
                }}
              />
              <YAxis
                allowDecimals={false}
                domain={[0, maxUsers]}
                tickFormatter={fmtNumber}
                tick={tickStyle}
                tickLine={false}
                axisLine={false}
                width={46}
                label={{
                  value: 'Unique users',
                  angle: -90,
                  position: 'insideLeft',
                  fill: ink.muted,
                  fontSize: 12,
                }}
              />
              <Tooltip content={Tip} cursor={{ fill: chrome.surface }} />
              <Bar
                dataKey="users"
                name="Unique users"
                fill={measureColor.activeUsers}
                maxBarSize={52}
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ChartFrame>
        </div>
      ))}
      <p className="card__note">
        {fmtNumber(data.reportedUsers)} unique users with usable reporting;{' '}
        {fmtNumber(data.partialUsers)} have partial reporting;{' '}
        {fmtNumber(data.unavailableUsers)} without usable reporting are excluded.
        Explicitly reported zeroes are included. Each bar is an observed exact count;
        categorical spacing does not imply equal numeric intervals.
      </p>
      <p className="card__note">{CUSTOMIZATION_COVERAGE_NOTE}</p>
    </div>
  )
}
