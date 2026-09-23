import { useEffect, useRef } from 'react'
import type { CustomizationRanking } from '../data/metrics'
import { fmtNumber } from '../format'

interface Props {
  /** Disclosure header, e.g. "All skills". */
  title: string
  /** Complete descending ranked list — never truncated, never folded into "Other". */
  items: CustomizationRanking[]
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
      <span className="disclosure__count">{fmtNumber(count)}</span>
    </>
  )
}

function RankingList({
  items,
  start = 1,
  className = '',
}: {
  items: CustomizationRanking[]
  start?: number
  className?: string
}) {
  return (
    <ol className={`disclosure__list ${className}`.trim()} start={start}>
      {items.map((item, index) => (
        <li className="disclosure__row" key={item.name}>
          <span className="disclosure__rank">{start + index}</span>
          <span className="disclosure__name">{item.name}</span>
          <span className="disclosure__value">{fmtNumber(item.interactionCount)}</span>
        </li>
      ))}
    </ol>
  )
}

/**
 * A collapsible, complete ranked list — shared by every "All …" disclosure at
 * the end of the report (skills, MCP servers, custom agents, slash commands,
 * plugins). On screen it is a native `<details>`/`<summary>` the reader can fold
 * away. Print uses synchronous browser events because CSS cannot reveal a closed
 * `<details>` element and a React state update may miss the print-layout capture.
 */
export function RankingDisclosure({ title, items, emptyMessage, defaultOpen = false }: Props) {
  const ref = useRef<HTMLDetailsElement>(null)
  const preprintOpen = useRef<boolean | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const media = window.matchMedia('print')
    const openForPrint = () => {
      if (preprintOpen.current === null) preprintOpen.current = el.open
      el.open = true
    }
    const restoreAfterPrint = () => {
      if (preprintOpen.current === null) return
      el.open = preprintOpen.current
      preprintOpen.current = null
    }
    const onMediaChange = (event: MediaQueryListEvent) => {
      if (event.matches) openForPrint()
      else restoreAfterPrint()
    }

    window.addEventListener('beforeprint', openForPrint)
    window.addEventListener('afterprint', restoreAfterPrint)
    media.addEventListener('change', onMediaChange)
    if (media.matches) openForPrint()

    return () => {
      window.removeEventListener('beforeprint', openForPrint)
      window.removeEventListener('afterprint', restoreAfterPrint)
      media.removeEventListener('change', onMediaChange)
      restoreAfterPrint()
    }
  }, [])

  const emptyText = emptyMessage ?? `No ${title.replace(/^all\s+/i, '').toLowerCase()} recorded for this range.`
  const keepWhole = items.length <= PRINT_EDGE_ROWS * 2
  const leadItems = keepWhole ? items : items.slice(0, PRINT_EDGE_ROWS)
  const middleItems = keepWhole ? [] : items.slice(PRINT_EDGE_ROWS, -PRINT_EDGE_ROWS)
  const tailItems = keepWhole ? [] : items.slice(-PRINT_EDGE_ROWS)

  return (
    <details ref={ref} className="disclosure" open={defaultOpen}>
      <summary className="disclosure__summary">
        <DisclosureHeading title={title} count={items.length} />
      </summary>
      <div className="disclosure__body">
        <div className="disclosure__screen-content">
          {items.length === 0
            ? <p className="empty">{emptyText}</p>
            : <RankingList items={items} />}
        </div>
        <div className="disclosure__print-content">
          <div className="disclosure__print-lead">
            <div className="disclosure__print-summary">
              <DisclosureHeading title={title} count={items.length} />
            </div>
            {items.length === 0
              ? <p className="empty">{emptyText}</p>
              : <RankingList items={leadItems} />}
          </div>
          {middleItems.length > 0 && (
            <RankingList items={middleItems} start={PRINT_EDGE_ROWS + 1} />
          )}
          {tailItems.length > 0 && (
            <RankingList
              items={tailItems}
              start={items.length - PRINT_EDGE_ROWS + 1}
              className="disclosure__list--tail"
            />
          )}
        </div>
      </div>
    </details>
  )
}
