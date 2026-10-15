import type { CustomizationKey, CustomizationTotal, UserDay } from './types'

export interface CustomizationDefinition {
  key: CustomizationKey
  label: string
  plural: string
  unit: string
  description: string
  totals: (record: UserDay) => CustomizationTotal[]
}

export const CUSTOMIZATION_DEFINITIONS: readonly CustomizationDefinition[] = [
  {
    key: 'mcp',
    label: 'MCP server',
    plural: 'MCP servers',
    unit: 'connection attempts',
    description:
      'Successful or failed MCP server connection and reconnection attempts in Copilot CLI, not tool calls through an existing connection.',
    totals: (record) => record.totalsByMcp,
  },
  {
    key: 'customAgent',
    label: 'Custom agent',
    plural: 'custom agents',
    unit: 'starts',
    description: 'Custom agent starts in Copilot CLI.',
    totals: (record) => record.totalsByCustomAgent,
  },
  {
    key: 'skill',
    label: 'Skill',
    plural: 'skills',
    unit: 'invocations',
    description: 'Skill invocations in Copilot CLI, including plugin-associated skills.',
    totals: (record) => record.totalsBySkill,
  },
  {
    key: 'plugin',
    label: 'Plugin',
    plural: 'plugins',
    unit: 'skill invocations',
    description:
      'Plugin-associated skill invocations in Copilot CLI. These are already included in skill counts; do not add the two together.',
    totals: (record) => record.totalsByPlugin,
  },
  {
    key: 'slashCommand',
    label: 'Slash command',
    plural: 'slash commands',
    unit: 'invocations',
    description: 'Slash command invocations in Copilot CLI.',
    totals: (record) => record.totalsBySlashCmd,
  },
]

export const CUSTOMIZATION_COVERAGE_NOTE =
  'GitHub reports only the top five items per user record. Counts sum recorded events, not unique users or distinct items, and may omit activity outside those entries.'

export const CUSTOMIZATION_LABEL_NOTE =
  'Reported labels are not distinct underlying items: customer-defined items can be grouped under other, or custom for slash commands.'

export const CUSTOMIZATION_DOCS_URL =
  'https://docs.github.com/en/copilot/reference/copilot-usage-metrics/copilot-usage-metrics#copilot-cli-customization-fields-api-only'
