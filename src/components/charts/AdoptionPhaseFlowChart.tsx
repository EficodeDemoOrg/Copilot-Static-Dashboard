import {
  Sankey,
  Tooltip,
  type SankeyLinkProps,
  type SankeyNodeProps,
  type TooltipContentProps,
} from 'recharts'
import type {
  AdoptionFlowNode,
  AdoptionPhaseFlowData,
} from '../../data/metrics'
import {
  fmtDateIntervalLong,
  fmtDateIntervalShort,
  fmtNumber,
  fmtPercent,
} from '../../format'
import { PRINT_CHART_WIDTH, usePrintMode } from '../../hooks/usePrintMode'
import { chrome, otherFill, series as palette } from '../../theme/palette'
import { ChartFrame } from './ChartFrame'

interface Props {
  data: AdoptionPhaseFlowData
}

interface ComputedFlowNode extends AdoptionFlowNode {
  depth: number
  dx: number
  dy: number
  value: number
  x: number
  y: number
}

interface ComputedFlowLink {
  source: ComputedFlowNode
  target: ComputedFlowNode
  value: number
}

const computedNode = (node: SankeyNodeProps['payload']) =>
  node as unknown as ComputedFlowNode

const HEIGHT = 420
const MIN_SCREEN_WIDTH = 760
const PERIOD_WIDTH = 210
const NODE_WIDTH = 14

function flowColor(node: Pick<AdoptionFlowNode, 'kind' | 'phaseNumber'>): string {
  if (node.kind === 'inactive') return 'var(--border)'
  if (node.kind === 'unknown') return otherFill
  if (node.phaseNumber === 0) return chrome.axis
  const index = Math.max(0, (node.phaseNumber ?? 1) - 1) % palette.length
  return palette[index]!
}

function stateOrder(a: AdoptionFlowNode, b: AdoptionFlowNode): number {
  if (a.kind === 'phase' && b.kind === 'phase') {
    return (
      (b.phaseNumber ?? Number.NEGATIVE_INFINITY) -
        (a.phaseNumber ?? Number.NEGATIVE_INFINITY) ||
      a.label.localeCompare(b.label)
    )
  }
  if (a.kind === 'phase') return -1
  if (b.kind === 'phase') return 1
  if (a.kind === b.kind) return a.label.localeCompare(b.label)
  return a.kind === 'unknown' ? -1 : 1
}

function FlowTooltip({
  active,
  payload,
  cohortUsers,
}: TooltipContentProps & { cohortUsers: number }) {
  if (!active || !payload?.length) return null
  const tooltipDatum = payload[0]?.payload as
    | { payload?: ComputedFlowNode | ComputedFlowLink }
    | undefined
  const item = tooltipDatum?.payload
  if (!item) return null

  if ('source' in item && 'target' in item) {
    const users = item.value
    const color = flowColor(item.source)
    return (
      <div className="tooltip">
        <div className="tooltip__label">
          {item.source.label} → {item.target.label}
        </div>
        <div className="tooltip__row">
          <span className="tooltip__swatch" style={{ background: color }} />
          <span>Users</span>
          <span className="tooltip__value">
            {fmtNumber(users)} ({fmtPercent((users / cohortUsers) * 100)})
          </span>
        </div>
        <div className="tooltip__note">
          {fmtDateIntervalLong(item.source.weekStart, item.source.weekEnd)} →{' '}
          {fmtDateIntervalLong(item.target.weekStart, item.target.weekEnd)}
        </div>
      </div>
    )
  }

  const users = item.users
  return (
    <div className="tooltip">
      <div className="tooltip__label">{item.label}</div>
      <div className="tooltip__row">
        <span
          className="tooltip__swatch"
          style={{ background: flowColor(item) }}
        />
        <span>Users</span>
        <span className="tooltip__value">
          {fmtNumber(users)} ({fmtPercent((users / cohortUsers) * 100)})
        </span>
      </div>
      <div className="tooltip__note">
        {fmtDateIntervalLong(item.weekStart, item.weekEnd)}
      </div>
    </div>
  )
}

function FlowNode({
  x,
  y,
  width,
  height,
  payload,
  showPeriod,
}: SankeyNodeProps & { showPeriod: boolean }) {
  const node = computedNode(payload)
  const color = flowColor(node)
  const visibleHeight = Math.max(height, 2)
  const centerY = y + height / 2
  const description = `${node.label}: ${fmtNumber(node.users)} ${
    node.users === 1 ? 'user' : 'users'
  }, ${fmtDateIntervalLong(node.weekStart, node.weekEnd)}`

  return (
    <g className="adoption-flow__node">
      <title>{description}</title>
      {showPeriod && (
        <text
          className="adoption-flow__period"
          x={x + width / 2}
          y={20}
          textAnchor="middle"
        >
          {fmtDateIntervalShort(node.weekStart, node.weekEnd)}
        </text>
      )}
      <rect
        x={x}
        y={y}
        width={width}
        height={visibleHeight}
        rx={2}
        fill={color}
      />
      <text
        className="adoption-flow__node-label"
        x={x + width + 7}
        y={centerY}
        dominantBaseline="middle"
      >
        {node.label} · {fmtNumber(node.users)}
      </text>
    </g>
  )
}

function FlowLink({
  sourceX,
  sourceY,
  sourceControlX,
  targetX,
  targetY,
  targetControlX,
  linkWidth,
  payload,
}: SankeyLinkProps) {
  const link = payload as unknown as ComputedFlowLink
  const description = `${link.source.label} to ${link.target.label}: ${fmtNumber(link.value)} ${
    link.value === 1 ? 'user' : 'users'
  }`

  return (
    <path
      className="adoption-flow__link"
      d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none"
      stroke={flowColor(link.source)}
      strokeWidth={Math.max(linkWidth, 1)}
    >
      <title>{description}</title>
    </path>
  )
}

export function AdoptionPhaseFlowChart({ data }: Props) {
  const printing = usePrintMode()
  const hasPhaseData = data.nodes.some((node) => node.kind === 'phase')

  if (data.cohortUsers === 0 || !hasPhaseData) {
    return <p className="empty">No adoption phase data in this range.</p>
  }
  if (data.periods.length < 2) {
    return <p className="empty">Select at least two weeks to show phase movement.</p>
  }

  const nodeIndex = new Map(data.nodes.map((node, index) => [node.id, index]))
  const sankeyData = {
    nodes: data.nodes.map((node) => ({ ...node, name: node.label })),
    links: data.links.map((link) => ({
      source: nodeIndex.get(link.source)!,
      target: nodeIndex.get(link.target)!,
      value: link.users,
    })),
  }
  const firstNodeByPeriod = new Map<number, string>()
  for (const node of data.nodes) {
    if (!firstNodeByPeriod.has(node.periodIndex)) {
      firstNodeByPeriod.set(node.periodIndex, node.id)
    }
  }
  const legend = [...new Map(data.nodes.map((node) => [node.stateKey, node])).values()].sort(
    stateOrder,
  )
  const screenWidth = Math.max(
    MIN_SCREEN_WIDTH,
    (data.periods.length - 1) * PERIOD_WIDTH + 280,
  )
  const chartWidth = printing ? PRINT_CHART_WIDTH : screenWidth
  const renderTooltip = (props: TooltipContentProps) => (
    <FlowTooltip {...props} cohortUsers={data.cohortUsers} />
  )

  return (
    <div
      className="adoption-flow"
      role="group"
      aria-label={`AI adoption phase movement for ${fmtNumber(data.cohortUsers)} anonymous users across ${fmtNumber(data.periods.length)} weeks`}
    >
      <div
        className="adoption-flow__scroll"
        tabIndex={0}
        aria-label="Scrollable weekly adoption phase flow"
      >
        <div className="adoption-flow__timeline" style={{ width: chartWidth }}>
          <ChartFrame height={HEIGHT}>
            <Sankey
              data={sankeyData}
              dataKey="value"
              nameKey="name"
              node={(props) => (
                <FlowNode
                  {...props}
                  showPeriod={
                    firstNodeByPeriod.get(
                      computedNode(props.payload).periodIndex,
                    ) === computedNode(props.payload).id
                  }
                />
              )}
              link={FlowLink}
              nodeWidth={NODE_WIDTH}
              nodePadding={12}
              linkCurvature={0.55}
              iterations={32}
              sort={false}
              verticalAlign="top"
              margin={{ top: 46, right: 118, bottom: 8, left: 12 }}
              title="AI adoption phase flow over time"
              desc="Bands show how the same anonymous users move between their highest recorded adoption phase in adjacent weeks. Unknown means a record had no usable phase; Not active means the user had no record that week."
            >
              <Tooltip content={renderTooltip} />
            </Sankey>
          </ChartFrame>
        </div>
      </div>
      <ul className="adoption-flow__legend" aria-label="Adoption phase flow legend">
        {legend.map((node) => (
          <li key={node.stateKey}>
            <span
              className="adoption-flow__legend-swatch"
              style={{ background: flowColor(node) }}
              aria-hidden="true"
            />
            <span>{node.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
