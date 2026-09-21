/**
 * Chart colors as CSS custom-property references, so light/dark/print swap in one
 * place (src/styles/app.css, src/styles/print.css) and no component carries a hex.
 *
 * Values come from the validated reference palette. Adjacent-pair CVD and
 * normal-vision floors pass in both modes for all eight slots; charts that put
 * every series on screen at once (scatter, bubble) must cap at the first three.
 */
export const series = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
  'var(--series-6)',
  'var(--series-7)',
  'var(--series-8)',
] as const

export const ink = {
  primary: 'var(--text-primary)',
  secondary: 'var(--text-secondary)',
  muted: 'var(--text-muted)',
} as const

export const chrome = {
  grid: 'var(--grid)',
  axis: 'var(--axis)',
  surface: 'var(--surface-1)',
} as const

/**
 * Color follows the measure, not the card: people are blue wherever they appear,
 * interaction volume is orange, acceptance quality is violet. Three hues across
 * the dashboard rather than one per chart, so a reader learns the mapping once.
 *
 * All three clear 3:1 against both the light and dark chart surfaces, so no
 * chart here depends on the relief rule to stay readable.
 */
export const measureColor = {
  activeUsers: series[0],
  interactions: series[1],
  generations: series[1],
  acceptances: series[6],
  acceptanceRate: series[6],
} as const

export type Measure = keyof typeof measureColor

/** The "Other" bucket is deliberately neutral — it is a remainder, not a category. */
export const otherFill = 'var(--text-muted)'

/** Axis/tick text style shared by every chart. */
export const tickStyle = { fill: ink.muted, fontSize: 12 } as const
