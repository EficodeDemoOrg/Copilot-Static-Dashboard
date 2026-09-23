/** Display formatting. Kept out of metrics.ts so aggregations stay pure numbers. */

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const plain = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
export const fmtNumber = (n: number): string => plain.format(n)
export const fmtCompact = (n: number): string => compact.format(n)

const DISPLAY_LABELS: Readonly<Record<string, string>> = {
  agent_edit: 'Agent Edit',
  chat_inline: 'Editor Inline Chat',
  cloud_agent: 'Copilot Coding Agent',
  code_completion: 'Code Completion',
  code_review_active: 'Code Review (Active)',
  code_review_passive: 'Code Review (Passive)',
  copilot_app: 'Copilot App',
  copilot_cli: 'Copilot CLI',
  github_app: 'GitHub App',
  used_agent: 'Agent',
  used_chat: 'Chat',
  used_cli: 'Copilot CLI',
  used_vscode_agent: 'VS Code Agent',
  used_copilot_app: 'Copilot App',
  used_copilot_code_review_active: 'Code Review (Active)',
  used_copilot_code_review_passive: 'Code Review (Passive)',
  used_copilot_coding_agent: 'Copilot Cloud / Coding Agent',
  used_copilot_cloud_agent: 'Copilot Cloud / Coding Agent',
}

/**
 * Curated presentation names for known export identifiers. Unknown names stay
 * byte-for-byte unchanged so display formatting never invents a meaning.
 */
export function fmtMetricLabel(name: string): string {
  const curated = DISPLAY_LABELS[name]
  if (curated) return curated
  if (name === 'chat_panel') return 'Editor'
  if (name.startsWith('chat_panel_')) {
    return `Editor ${fmtMetricLabel(name.slice('chat_panel_'.length))}`
  }
  if (name === 'custom mode') return 'Custom Mode'
  if (name.endsWith('_mode')) {
    const words = name.slice(0, -'_mode'.length).split('_').filter(Boolean)
    if (words.length > 0) {
      const prefix = words
        .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
        .join(' ')
      return `${prefix} Mode`
    }
  }
  return name
}

/** Null means "no denominator" — an em dash, never "0%". */
export const fmtPercent = (n: number | null): string => (n === null ? '—' : `${n.toFixed(1)}%`)

/** "2026-05-01" -> "1 May" for axis ticks. Dates are treated as UTC calendar days. */
export function fmtDayShort(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** "2026-05-01" -> "1 May 2026" for headers and tooltips. */
export function fmtDayLong(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
