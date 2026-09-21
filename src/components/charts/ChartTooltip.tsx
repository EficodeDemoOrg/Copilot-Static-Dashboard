import type { TooltipProps } from 'recharts'

type Formatter = (value: number) => string

/**
 * Shared tooltip. Values wear text tokens; the series color appears only as a
 * swatch beside the label, so identity is never carried by colored text.
 */
export function makeTooltip(formatValue: Formatter, labelFor: (label: string) => string) {
  return function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
    if (!active || !payload?.length) return null
    return (
      <div className="tooltip">
        <div className="tooltip__label">{labelFor(String(label))}</div>
        {payload.map((p) => (
          <div className="tooltip__row" key={p.name}>
            <span className="tooltip__swatch" style={{ background: p.color }} />
            <span>{p.name}</span>
            <span className="tooltip__value">{formatValue(Number(p.value ?? 0))}</span>
          </div>
        ))}
      </div>
    )
  }
}
