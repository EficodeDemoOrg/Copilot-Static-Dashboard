import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { CUSTOMIZATION_DEFINITIONS } from '../data/customizations'
import { CUSTOMIZATION_COLUMNS, compareOrganizationGroups } from '../data/comparisons'
import { highestAdoptionPhaseByUser } from '../data/metrics'
import { validateNdjsonText } from '../data/parseNdjson'
import { OrganizationComparisonSection } from './OrganizationComparisonSection'
import { RankingDisclosure } from './RankingDisclosure'
import { UsageVisuals } from './UsageVisuals'
import { CustomizationUsageChart, USAGE_BINS_PER_CHART } from './charts/CustomizationUsageChart'

vi.mock('../hooks/usePrintMode', () => ({
  usePrintMode: () => true,
  PRINT_CHART_WIDTH: 646,
}))

describe('customization report labels', () => {
  it.each(CUSTOMIZATION_DEFINITIONS)('labels $plural badges and event values, including print', (definition) => {
    const markup = renderToStaticMarkup(createElement(RankingDisclosure, {
      title: `All reported ${definition.plural}`,
      items: [{ name: 'example', interactionCount: 7 }],
      definition,
    }))
    expect(markup).toContain('1 reported label')
    expect(markup).toContain(`7 ${definition.unit}`)
    expect(markup).toContain('not unique users')
    expect(markup).toContain('not every item')
    expect(markup).toContain('disclosure__print-content')
  })

  it('uses the correct category units in comparison headings and explains the denominator', () => {
    expect(CUSTOMIZATION_COLUMNS.map((column) => column.label)).toEqual([
      'MCP server connection attempts', 'Custom agent starts', 'Skill invocations',
      'Plugin skill invocations', 'Slash command invocations',
    ])
    const markup = renderToStaticMarkup(createElement(OrganizationComparisonSection, {
      data: compareOrganizationGroups([]),
    }))
    expect(markup).toContain('denominator includes all users seen')
    expect(markup).toContain('MCP counts connection attempts, not tool calls')
    expect(markup).toContain('do not add them together')
  })

  it('renders five distribution cards and five phase legends in the shared aggregate/detail visuals', () => {
    const { records } = validateNdjsonText(JSON.stringify({
      day: '2026-09-01', user_id: 123, enterprise_id: 'synthetic',
      ai_credits_used: 3, ai_adoption_phase: { phase: 'Phase 2', phase_number: 2 },
      totals_by_skill: [], totals_by_custom_agent: [], totals_by_mcp: [],
      totals_by_plugin: [], totals_by_slash_cmd: [],
    }), 'synthetic.ndjson')
    const markup = renderToStaticMarkup(createElement(UsageVisuals, {
      records,
      userPhases: highestAdoptionPhaseByUser(records),
    }))
    expect(markup.match(/class="user-phase-legend"/g)).toHaveLength(5)
    expect(markup.match(/recorded usage per user<\/h3>/g)).toHaveLength(5)
    expect(markup.match(/class="customization-distribution"/g)).toHaveLength(5)
    expect(markup).not.toContain('user_id')
    expect(markup).not.toContain('userId')
  })

  it('renders every exact bin in printable segments without grouping into ranges', () => {
    const definition = CUSTOMIZATION_DEFINITIONS[0]!
    const bins = Array.from({ length: USAGE_BINS_PER_CHART * 2 + 1 }, (_, index) => ({
      usages: index * 100, users: index + 1,
    }))
    const markup = renderToStaticMarkup(createElement(CustomizationUsageChart, {
      definition,
      data: { bins, reportedUsers: 100, partialUsers: 3, unavailableUsers: 2 },
    }))
    expect(markup.match(/class="customization-distribution__segment"/g)).toHaveLength(3)
    expect(markup).toContain('segment 3 of 3')
    expect(markup).toContain('3 have partial reporting')
    expect(markup).toContain('2 without usable reporting are excluded')
    expect(markup).toContain('only the top five')
    expect(markup).toContain('Explicitly reported zeroes')
  })

  it('distinguishes entirely unavailable reporting from zero', () => {
    const markup = renderToStaticMarkup(createElement(CustomizationUsageChart, {
      definition: CUSTOMIZATION_DEFINITIONS[2]!,
      data: { bins: [], reportedUsers: 0, partialUsers: 0, unavailableUsers: 5 },
    }))
    expect(markup).toContain('No usable skills reporting for 5 users')
    expect(markup).toContain('Unavailable data is not zero usage')
  })
})
