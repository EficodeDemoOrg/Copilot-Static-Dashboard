import { describe, expect, it } from 'vitest'
import { fmtMetricLabel } from './format'

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
