import { hierarchy, pack } from 'd3-hierarchy'
import type { BubbleCloudDatum } from '../../data/metrics'
import { topBubbleCloud } from '../../data/metrics'
import { fmtCompact, fmtNumber } from '../../format'
import { otherFill, series as palette } from '../../theme/palette'

interface Props {
  data: BubbleCloudDatum[]
  ariaLabel: string
  valueNoun: string
  labelFormatter?: (label: string) => string
  emptyMessage?: string
}

interface PackDatum {
  item?: BubbleCloudDatum
  children?: PackDatum[]
}

export interface PackedBubble {
  key: string
  x: number
  y: number
  radius: number
}

const PACK_SIZE = 640
const PACK_PADDING = 6

function valueDescription(value: number, noun: string): string {
  return `${fmtNumber(value)} ${noun}${value === 1 ? '' : 's'}`
}

/**
 * Standard hierarchy circle packing. D3 assigns each leaf a radius proportional
 * to sqrt(value), so rendered circle area is proportional to the represented
 * value; every position comes from the current values rather than fixed slots.
 */
export function packBubbleValues(
  data: BubbleCloudDatum[],
  size = PACK_SIZE,
): PackedBubble[] {
  const root = hierarchy<PackDatum>({
    children: data.map((item) => ({ item })),
  })
    .sum((node) => node.item?.value ?? 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

  return pack<PackDatum>()
    .size([size, size])
    .padding(PACK_PADDING)(root)
    .leaves()
    .map((leaf) => ({
      key: leaf.data.item!.key,
      x: leaf.x,
      y: leaf.y,
      radius: leaf.r,
    }))
}

function truncate(text: string, maximum: number): string {
  return text.length <= maximum ? text : `${text.slice(0, Math.max(1, maximum - 1))}…`
}

function wrapLabel(label: string, radius: number): string[] {
  const maximum = Math.max(7, Math.floor(radius / 3.5))
  const words = label.split(/\s+/).filter(Boolean)
  if (words.length <= 1) return [truncate(label, maximum)]

  const lines: string[] = []
  for (const word of words) {
    const current = lines.at(-1)
    if (current && `${current} ${word}`.length <= maximum) {
      lines[lines.length - 1] = `${current} ${word}`
    } else {
      lines.push(word)
    }
  }

  if (lines.length <= 2) return lines.map((line) => truncate(line, maximum))
  return [lines[0]!, truncate(lines.slice(1).join(' '), maximum)]
}

/**
 * Data-driven packed-bubble chart. Circle area is proportional to value and D3
 * computes a fresh non-overlapping layout whenever filtered values change.
 */
export function BubbleCloudChart({
  data,
  ariaLabel,
  valueNoun,
  labelFormatter = (label) => label,
  emptyMessage,
}: Props) {
  const visible = topBubbleCloud(data)
  const maximum = visible.reduce((highest, item) => Math.max(highest, item.value), 0)

  if (visible.length === 0) {
    return <p className="empty">{emptyMessage ?? 'No bubble cloud data for this range.'}</p>
  }

  const byKey = new Map(visible.map((item) => [item.key, item]))
  const safePalette = palette.filter((_, index) => index !== 3)
  const colorByKey = new Map(
    visible.map((item, index) => [
      item.key,
      item.key === '__others__' ? otherFill : safePalette[index % safePalette.length]!,
    ]),
  )
  const packed = packBubbleValues(visible)

  return (
    <div className="bubble-cloud-chart" role="group" aria-label={ariaLabel}>
      <svg
        className="bubble-cloud"
        viewBox={`0 0 ${PACK_SIZE} ${PACK_SIZE}`}
        aria-hidden="true"
        focusable="false"
      >
        {packed.map((position) => {
          const item = byKey.get(position.key)!
          const displayLabel = labelFormatter(item.label)
          const description = `${displayLabel}: ${valueDescription(item.value, valueNoun)}`
          const ratio = item.value / maximum
          const bubbleColor = colorByKey.get(item.key)!
          const showLabel = position.radius >= 54
          const showValue = position.radius >= 28
          const labelLines = showLabel ? wrapLabel(displayLabel, position.radius) : []
          const labelFontSize = Math.min(11, Math.max(8, position.radius * 0.11))
          const valueFontSize = Math.min(22, Math.max(12, position.radius * 0.22))
          const labelHeight = labelLines.length * (labelFontSize + 2)
          const valueHeight = showValue ? valueFontSize + 4 : 0
          const totalHeight = labelHeight + valueHeight
          const contentTop = -totalHeight / 2
          const firstLineY = contentTop + labelFontSize
          const valueY = contentTop + labelHeight + valueFontSize

          return (
            <g transform={`translate(${position.x} ${position.y})`} key={item.key}>
              <title>{description}</title>
              <circle
                r={position.radius}
                fill={`color-mix(in srgb, ${bubbleColor} ${Math.round(42 + ratio * 58)}%, var(--surface-1))`}
                stroke={bubbleColor}
                className="bubble-cloud__circle"
              />
              {(showLabel || showValue) && (
                <text
                  className={`bubble-cloud__text${ratio >= 0.55 ? ' bubble-cloud__text--strong' : ''}`}
                  textAnchor="middle"
                >
                  {labelLines.map((line, index) => (
                    <tspan
                      className="bubble-cloud__label"
                      x={0}
                      y={firstLineY + index * (labelFontSize + 2)}
                      fontSize={labelFontSize}
                      key={`${line}-${index}`}
                    >
                      {line}
                    </tspan>
                  ))}
                  {showValue && (
                    <tspan
                      className="bubble-cloud__value"
                      x={0}
                      y={valueY}
                      fontSize={valueFontSize}
                    >
                      {fmtCompact(item.value)}
                    </tspan>
                  )}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <ul className="bubble-cloud-legend" aria-label={`${ariaLabel} legend`}>
        {visible.map((item) => {
          const displayLabel = labelFormatter(item.label)
          return (
            <li className="bubble-cloud-legend__item" key={item.key}>
              <span
                className="bubble-cloud-legend__swatch"
                style={{ backgroundColor: colorByKey.get(item.key) }}
                aria-hidden="true"
              />
              <span className="bubble-cloud-legend__label">{displayLabel}</span>
              <strong className="bubble-cloud-legend__value">
                {valueDescription(item.value, valueNoun)}
              </strong>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
