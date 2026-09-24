/**
 * Chart colors as CSS custom-property references, so light/dark/print swap in one
 * place (src/styles/app.css, src/styles/print.css) and no component carries a hex.
 *
 * Values are the Eficode brand palette: cornflower blue and mango tango are brand
 * hexes, the remaining six are derived in OKLCH because the brand book supplies
 * only three in-band hues. Adjacent-pair CVD and normal-vision floors pass in both
 * modes for all eight slots; charts that put every series on screen at once
 * (scatter, bubble) must cap at the first three.
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
  weekendBand: 'var(--weekend-band)',
} as const

/**
 * Color follows the measure, not the card: people are cornflower blue wherever they
 * appear, interaction volume is mango tango, acceptance quality is violet. Three
 * hues across the dashboard rather than one per chart, so a reader learns the
 * mapping once.
 *
 * These three live on slots 1-3 deliberately. The measures sit on separate cards,
 * but a reader carries the mapping between cards, so they have to be mutually
 * distinguishable rather than merely distinguishable from their neighbours — that
 * is the all-pairs test, and slots 1-3 are the trio that clears it in both modes.
 * Violet is not a style choice: beside brand cornflower and mango it is the only
 * third hue that passes (green ΔE 2.2, brand yellow 2.3, teal and deep blue fail
 * the normal-vision floor).
 *
 * All three clear 3:1 against both the light and dark chart surfaces, so no
 * chart here depends on the relief rule to stay readable.
 */
export const measureColor = {
  activeUsers: series[0],
  interactions: series[1],
  generations: series[1],
  acceptances: series[2],
  acceptanceRate: series[2],
  /**
   * LoC added/deleted borrow the familiar diff convention (green add, red
   * remove) rather than the cornflower/mango/violet trio above: added and
   * deleted are two sides of one measure shown together on every LoC chart, so
   * they need to read as a pair, not slot into the per-person/per-volume
   * mapping. Both clear 3:1 on light and dark chart surfaces (slots 6 and 8).
   */
  locAdded: series[5],
  locDeleted: series[7],
  /**
   * Customization rankings (custom agents, MCP servers, skills, plugins, slash
   * commands) are a distinct measure family from the volume/quality/person
   * trio above, so they get their own slot rather than borrowing one that
   * already carries a meaning elsewhere on the dashboard.
   */
  interactionCount: series[6],
  /**
   * AI credits are a consumption measure, not a person/volume/quality count,
   * so they get their own slot rather than borrowing a hue that already
   * means something else on the dashboard. Slot 4 (series-4) is reserved for
   * contexts with the label "relief" (2.69:1, see app.css) — these charts
   * draw an unlabeled stroke/fill, so slot 5 (magenta, ≥3.41:1 in both
   * modes) is used instead, as it otherwise goes unused.
   */
  aiCredits: series[4],
} as const

export type Measure = keyof typeof measureColor

/** The "Other" bucket is deliberately neutral — it is a remainder, not a category. */
export const otherFill = 'var(--text-muted)'

/** Axis/tick text style shared by every chart. */
export const tickStyle = { fill: ink.muted, fontSize: 12 } as const
