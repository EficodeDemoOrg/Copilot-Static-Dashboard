import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Line, LineChart } from 'recharts'
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

function chartElements(node: ReactNode): ReactElement<{ children?: ReactNode } & Record<string, unknown>>[] {
  const elements = []
  for (const child of Children.toArray(node)) {
    if (isValidElement<{ children?: ReactNode } & Record<string, unknown>>(child)) {
      elements.push(child, ...chartElements(child.props.children))
    }
  }
  return elements
}

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
    expect(markup).toContain('Each dot is an observed exact count')
  })

  it.each(CUSTOMIZATION_DEFINITIONS)('plots $plural as dots connected by straight lines', (definition) => {
    const bins = [{ usages: 0, users: 4 }, { usages: 2, users: 3 }, { usages: 100, users: 1 }]
    const elements = chartElements(CustomizationUsageChart({
      definition,
      data: { bins, reportedUsers: 8, partialUsers: 0, unavailableUsers: 0 },
    }))
    const charts = elements.filter((element) => element.type === LineChart)
    const lines = elements.filter((element) => element.type === Line)
    expect(charts).toHaveLength(1)
    expect(charts[0]!.props.data).toEqual(bins)
    expect(lines).toHaveLength(1)
    expect(lines[0]!.props).toMatchObject({
      type: 'linear',
      dataKey: 'users',
      dot: { r: 4 },
      isAnimationActive: false,
    })
  })

  it('keeps a visible dot when a category has only one observed usage count', () => {
    const elements = chartElements(CustomizationUsageChart({
      definition: CUSTOMIZATION_DEFINITIONS[0]!,
      data: { bins: [{ usages: 0, users: 5 }], reportedUsers: 5, partialUsers: 0, unavailableUsers: 0 },
    }))
    expect(elements.find((element) => element.type === LineChart)!.props.data)
      .toEqual([{ usages: 0, users: 5 }])
    expect(elements.find((element) => element.type === Line)!.props.dot).toMatchObject({ r: 4 })
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
