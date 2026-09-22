import type { ReactElement } from 'react'
import { ink } from '../../theme/palette'

// One canvas 2D context, reused for every measurement rather than created per tick.
const measureCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null

// Matches --font-sans in app.css; approximate is enough since this only decides
// where to cut, not how the text ultimately renders.
const TICK_FONT = '12px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

function measureWidth(text: string): number {
  if (!measureCtx) return text.length * 6.5 // char-count fallback if canvas 2D is unavailable
  measureCtx.font = TICK_FONT
  return measureCtx.measureText(text).width
}

/** Shortens `text` with a trailing ellipsis so it fits within `maxWidth` px, if it doesn't already. */
function truncate(text: string, maxWidth: number): string {
  if (maxWidth <= 0 || measureWidth(text) <= maxWidth) return text
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (measureWidth(text.slice(0, mid) + '…') <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return lo === 0 ? '…' : text.slice(0, lo) + '…'
}

interface TickProps {
  x?: number | string
  y?: number | string
  payload?: { value: string }
}

/**
 * Category-axis tick for the horizontal ranked/LoC bar charts.
 *
 * Recharts' default tick renderer never wraps or truncates: a name longer than
 * the reserved label column (a real possibility — feature, model, language,
 * agent, MCP, skill, plugin and slash-command names are arbitrary upstream
 * strings) renders past the axis width, overlapping the bars or the next card.
 * This measures the label against the axis's own reserved width and truncates
 * with an ellipsis, keeping the full name available as a native title hover.
 */
export function categoryAxisTick(labelWidth: number) {
  // Leave a few px of breathing room before the plot area / tick line.
  const maxWidth = Math.max(0, labelWidth - 8)

  return function CategoryAxisTick({ x = 0, y = 0, payload }: TickProps): ReactElement {
    const value = String(payload?.value ?? '')
    const label = truncate(value, maxWidth)
    return (
      <text x={x} y={y} dy={4} textAnchor="end" fontSize={12} fill={ink.muted}>
        {label}
        {label !== value && <title>{value}</title>}
      </text>
    )
  }
}
