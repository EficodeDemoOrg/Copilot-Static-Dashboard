import type { TooltipContentProps } from 'recharts'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Tooltip, XAxis, YAxis } from 'recharts'
import type { AdoptionPhaseTotal } from '../../data/metrics'
import { chrome, ink, measureColor, otherFill, tickStyle } from '../../theme/palette'
import { fmtNumber, fmtPercent } from '../../format'
import { ChartFrame } from './ChartFrame'

interface Props {
  data: AdoptionPhaseTotal[]
}

interface Row extends AdoptionPhaseTotal {
  share: number
}

const HEIGHT = 240

function PhaseTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload as Row | undefined
  if (!row) return null
  const color = row.phaseNumber === undefined ? otherFill : measureColor.activeUsers

  return (
    <div className="tooltip">
      <div className="tooltip__label">{row.label}</div>
      <div className="tooltip__row">
        <span className="tooltip__swatch" style={{ background: color }} />
        <span>Users</span>
        <span className="tooltip__value">
          {fmtNumber(row.users)} ({fmtPercent(row.share)})
        </span>
      </div>
    </div>
  )
}

/**
 * Adoption-phase distribution: one bar per phase, in numeric phase order (not
 * alphabetic label order), with the explicit `Unknown` bucket — present only
 * when the aggregation reports users without usable phase data — rendered
 * last and in the neutral "remainder" color rather than the person hue.
 */
export function AdoptionPhaseChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="empty">No adoption phase data in this range.</p>
  }

  const total = data.reduce((a, d) => a + d.users, 0)
  const rows: Row[] = data.map((d) => ({ ...d, share: total > 0 ? (d.users / total) * 100 : 0 }))

  return (
    <ChartFrame height={HEIGHT}>
      <BarChart data={rows} margin={{ top: 20, right: 16, bottom: 0, left: 0 }} barCategoryGap={16}>
        <CartesianGrid stroke={chrome.grid} vertical={false} />
        <XAxis dataKey="label" tick={tickStyle} tickLine={false} axisLine={{ stroke: chrome.axis }} interval={0} />
        <YAxis
          tickFormatter={fmtNumber}
          tick={tickStyle}
          tickLine={false}
          axisLine={false}
          width={40}
          allowDecimals={false}
        />
        <Tooltip content={PhaseTooltip} cursor={{ fill: 'var(--surface-2)' }} />
        <Bar dataKey="users" name="Users" radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {rows.map((r) => (
            <Cell key={r.label} fill={r.phaseNumber === undefined ? otherFill : measureColor.activeUsers} />
          ))}
          <LabelList
            dataKey="users"
            position="top"
            formatter={(value) => fmtNumber(Number(value))}
            style={{ fill: ink.secondary, fontSize: 12 }}
          />
        </Bar>
      </BarChart>
    </ChartFrame>
  )
}
