import { useState } from 'react'
import type { CustomizationRanking } from '../data/metrics'
import { fmtNumber } from '../format'
import { usePrintMode } from '../hooks/usePrintMode'
import {
  CUSTOMIZATION_LABEL_NOTE,
  type CustomizationDefinition,
} from '../data/customizations'

interface Props {
  /** Disclosure header, e.g. "All skills". */
  title: string
  /** Complete descending ranked list — never truncated, never folded into "Other". */
  items: CustomizationRanking[]
  definition: CustomizationDefinition
  /** Shown in place of the list when `items` is empty — the caller knows why (export omits the array, nothing recorded, …). */
  emptyMessage?: string
  /** Whether the disclosure starts open on screen. Print always renders it expanded regardless of this. */
  defaultOpen?: boolean
}

const PRINT_EDGE_ROWS = 3

function DisclosureHeading({ title, count }: { title: string; count: number }) {
  return (
    <>
      <span className="disclosure__title">{title}</span>
      <span className="disclosure__count">
        {fmtNumber(count)} reported {count === 1 ? 'label' : 'labels'}
      </span>
    </>
  )
}

function RankingList({
  items,
  start = 1,
  className = '',
  unit,
}: {
  items: CustomizationRanking[]
  start?: number
  className?: string
  unit: string
}) {
  return (
    <ol className={`disclosure__list ${className}`.trim()} start={start}>
      {items.map((item, index) => (
        <li className="disclosure__row" key={item.name}>
          <span className="disclosure__rank">{start + index}</span>
          <span className="disclosure__name">{item.name}</span>
          <span className="disclosure__value">{fmtNumber(item.interactionCount)} {unit}</span>
        </li>
      ))}
    </ol>
  )
}

/**
 * A collapsible, complete ranked list — shared by every "All …" disclosure at
 * the end of the report (skills, MCP servers, custom agents, slash commands,
 * plugins). On screen it is a native `<details>`/`<summary>` the reader can fold
 * away. Shared print mode controls the `open` property because CSS cannot reveal
 * a closed `<details>` element.
 */
export function RankingDisclosure({ title, items, definition, emptyMessage, defaultOpen = false }: Props) {
  const printing = usePrintMode()
  const [screenOpen, setScreenOpen] = useState(defaultOpen)

  const emptyText = emptyMessage ?? `No ${title.replace(/^all\s+/i, '').toLowerCase()} recorded for this range.`
  const keepWhole = items.length <= PRINT_EDGE_ROWS * 2
  const leadItems = keepWhole ? items : items.slice(0, PRINT_EDGE_ROWS)
  const middleItems = keepWhole ? [] : items.slice(PRINT_EDGE_ROWS, -PRINT_EDGE_ROWS)
  const tailItems = keepWhole ? [] : items.slice(-PRINT_EDGE_ROWS)
  const explanation = (
    <p className="card__note">
      Values are recorded {definition.unit}, not unique users. {definition.description}{' '}
      This list contains all labels present in the uploaded top-five breakdowns, not every item
      actually used. {CUSTOMIZATION_LABEL_NOTE}
    </p>
  )

  return (
    <details
      className="disclosure"
      open={printing || screenOpen}
      onToggle={(event) => {
        if (!printing) setScreenOpen(event.currentTarget.open)
      }}
    >
      <summary className="disclosure__summary">
        <DisclosureHeading title={title} count={items.length} />
      </summary>
      <div className="disclosure__body">
        <div className="disclosure__screen-content">
          {explanation}
          {items.length === 0
            ? <p className="empty">{emptyText}</p>
            : <RankingList items={items} unit={definition.unit} />}
        </div>
        {explanation}
        <div className="disclosure__print-content">
          <div className="disclosure__print-lead">
            <div className="disclosure__print-summary">
              <DisclosureHeading title={title} count={items.length} />
            </div>
            {items.length === 0
              ? <p className="empty">{emptyText}</p>
              : <RankingList items={leadItems} unit={definition.unit} />}
          </div>
          {middleItems.length > 0 && (
            <RankingList items={middleItems} start={PRINT_EDGE_ROWS + 1} unit={definition.unit} />
          )}
          {tailItems.length > 0 && (
            <RankingList
              items={tailItems}
              start={items.length - PRINT_EDGE_ROWS + 1}
              className="disclosure__list--tail"
              unit={definition.unit}
            />
          )}
        </div>
      </div>
    </details>
  )
}
