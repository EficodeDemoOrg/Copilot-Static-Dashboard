import { describe, expect, it } from 'vitest'
import { fmtDateIntervalLong, fmtDateIntervalShort, fmtMetricLabel } from './format'

describe('fmtMetricLabel', () => {
  it.each([
    ['agent_edit', 'Agent Edit'],
    ['agent_mode', 'Agent Mode'],
    ['chat_inline', 'Editor Inline Chat'],
    ['chat_panel', 'Editor'],
    ['cloud_agent', 'Copilot Coding Agent'],
    ['code_completion', 'Code Completion'],
    ['code_review_active', 'Code Review (Active)'],
    ['code_review_passive', 'Code Review (Passive)'],
    ['copilot_app', 'Copilot App'],
    ['copilot_cli', 'Copilot CLI'],
    ['github_app', 'GitHub App'],
    ['plan_mode', 'Plan Mode'],
    ['custom_mode', 'Custom Mode'],
    ['custom mode', 'Custom Mode'],
    ['used_agent', 'Agent'],
    ['used_chat', 'Chat'],
    ['used_cli', 'Copilot CLI'],
    ['used_vscode_agent', 'VS Code Agent'],
    ['used_copilot_app', 'Copilot App'],
    ['used_copilot_code_review_active', 'Code Review (Active)'],
    ['used_copilot_code_review_passive', 'Code Review (Passive)'],
    ['used_copilot_coding_agent', 'Copilot Cloud / Coding Agent'],
    ['used_copilot_cloud_agent', 'Copilot Cloud / Coding Agent'],
  ])('formats %s as %s', (raw, expected) => {
    expect(fmtMetricLabel(raw)).toBe(expected)
  })

  it('replaces the chat panel prefix and formats a known suffix', () => {
    expect(fmtMetricLabel('chat_panel_agent_mode')).toBe('Editor Agent Mode')
    expect(fmtMetricLabel('chat_panel_future_feature')).toBe('Editor future_feature')
  })

  it('formats future mode identifiers without changing unrelated unknown names', () => {
    expect(fmtMetricLabel('review_assist_mode')).toBe('Review Assist Mode')
  })

  it('preserves an unknown name exactly as received', () => {
    expect(fmtMetricLabel('future_feature_v2')).toBe('future_feature_v2')
  })
})

describe('date interval formatting', () => {
  it('formats both endpoints for a weekly axis label', () => {
    expect(fmtDateIntervalShort('2026-09-20', '2026-09-26')).toBe('20 Sept – 26 Sept')
  })

  it('keeps cross-month tooltip intervals unambiguous', () => {
    expect(fmtDateIntervalLong('2026-09-28', '2026-10-04')).toBe(
      '28 Sept 2026 – 4 Oct 2026',
    )
  })
})
