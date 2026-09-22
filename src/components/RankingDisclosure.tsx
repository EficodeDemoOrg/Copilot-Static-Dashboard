import { useEffect, useRef } from 'react'
import type { CustomizationRanking } from '../data/metrics'
import { fmtNumber } from '../format'
import { usePrintMode } from '../hooks/usePrintMode'

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

/**
 * A collapsible, complete ranked list — shared by every "All …" disclosure at
 * the end of the report (skills, MCP servers, custom agents, slash commands,
 * plugins). On screen it is a native `<details>`/`<summary>` the reader can
 * fold away. In print it is always forced open: CSS alone cannot reveal a
 * closed `<details>` element's content, so this imperatively flips the DOM
 * `open` property from `usePrintMode()` before print/PDF layout is captured,
 * then restores whatever the reader had set once printing ends.
 */
export function RankingDisclosure({ title, items, emptyMessage, defaultOpen = false }: Props) {
  const printing = usePrintMode()
  const ref = useRef<HTMLDetailsElement>(null)
  const preprintOpen = useRef<boolean | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (printing) {
      preprintOpen.current = el.open
      el.open = true
    } else if (preprintOpen.current !== null) {
      el.open = preprintOpen.current
      preprintOpen.current = null
    }
  }, [printing])

  return (
    <details ref={ref} className="disclosure" open={defaultOpen}>
      <summary className="disclosure__summary">
        <span className="disclosure__title">{title}</span>
        <span className="disclosure__count">{fmtNumber(items.length)}</span>
      </summary>
      <div className="disclosure__body">
        {items.length === 0 ? (
          // Falls back to a grammatical default derived from the title ("All skills" -> "No skills recorded…").
          <p className="empty">{emptyMessage ?? `No ${title.replace(/^all\s+/i, '').toLowerCase()} recorded for this range.`}</p>
        ) : (
          <ol className="disclosure__list">
            {items.map((item, i) => (
              <li className="disclosure__row" key={item.name}>
                <span className="disclosure__rank">{i + 1}</span>
                <span className="disclosure__name">{item.name}</span>
                <span className="disclosure__value">{fmtNumber(item.interactionCount)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  )
}
