import type { UserDay } from './types'

export const SURFACE_DEFINITIONS = [
  { key: 'agent', label: 'Agent', isUsed: (record: UserDay) => record.usedAgent },
  { key: 'chat', label: 'Chat', isUsed: (record: UserDay) => record.usedChat },
  { key: 'cli', label: 'Copilot CLI', isUsed: (record: UserDay) => record.usedCli },
  {
    key: 'vscodeAgent',
    label: 'VS Code Agent',
    isUsed: (record: UserDay) => record.usedVscodeAgent,
  },
  {
    key: 'copilotApp',
    label: 'Copilot App',
    isUsed: (record: UserDay) => record.usedCopilotApp,
  },
  {
    key: 'codeReviewActive',
    label: 'Code Review (Active)',
    isUsed: (record: UserDay) => record.usedCopilotCodeReviewActive,
  },
  {
    key: 'codeReviewPassive',
    label: 'Code Review (Passive)',
    isUsed: (record: UserDay) => record.usedCopilotCodeReviewPassive,
  },
  {
    key: 'cloudAgent',
    label: 'Copilot Cloud / Coding Agent',
    isUsed: (record: UserDay) =>
      record.usedCopilotCloudAgent || record.usedCopilotCodingAgent,
  },
] as const

export type SurfaceKey = (typeof SURFACE_DEFINITIONS)[number]['key']
