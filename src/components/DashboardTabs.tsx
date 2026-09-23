import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { usePrintMode } from '../hooks/usePrintMode'

export interface DashboardTab {
  id: string
  label: string
  content: ReactNode
}

interface Props {
  tabs: DashboardTab[]
}

export function DashboardTabs({ tabs }: Props) {
  const instanceId = useId()
  const printing = usePrintMode()
  const [selectedId, setSelectedId] = useState(() => tabs[0]?.id)
  const [mountedIds, setMountedIds] = useState<ReadonlySet<string>>(
    () => new Set(tabs[0] ? [tabs[0].id] : []),
  )
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === selectedId)) {
      const nextId = tabs[0]?.id
      setSelectedId(nextId)
      if (nextId) {
        setMountedIds((current) => new Set(current).add(nextId))
      }
    }
  }, [selectedId, tabs])

  const activateTab = (id: string) => {
    setSelectedId(id)
    setMountedIds((current) => (current.has(id) ? current : new Set(current).add(id)))
  }

  const selectTab = (index: number) => {
    const tab = tabs[index]
    if (!tab) return
    activateTab(tab.id)
    tabRefs.current[index]?.focus()
  }

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | undefined
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = tabs.length - 1
    if (nextIndex === undefined) return
    event.preventDefault()
    selectTab(nextIndex)
  }

  return (
    <div className="dashboard-tabs">
      <div className="dashboard-tabs__list no-print" role="tablist" aria-label="Dashboard sections">
        {tabs.map((tab, index) => {
          const selected = tab.id === selectedId
          const tabId = `${instanceId}-tab-${tab.id}`
          const panelId = `${instanceId}-panel-${tab.id}`

          return (
            <button
              className="dashboard-tabs__tab"
              type="button"
              role="tab"
              id={tabId}
              aria-controls={panelId}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              key={tab.id}
              ref={(element) => {
                tabRefs.current[index] = element
              }}
              onClick={() => activateTab(tab.id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="dashboard-tabs__panels">
        {tabs.map((tab) => {
          const selected = tab.id === selectedId
          const tabId = `${instanceId}-tab-${tab.id}`
          const panelId = `${instanceId}-panel-${tab.id}`

          return (
            <section
              className="dashboard-tabs__panel"
              role="tabpanel"
              id={panelId}
              aria-labelledby={tabId}
              tabIndex={0}
              hidden={!selected}
              key={tab.id}
            >
              {(mountedIds.has(tab.id) || printing) && tab.content}
            </section>
          )
        })}
      </div>
    </div>
  )
}
