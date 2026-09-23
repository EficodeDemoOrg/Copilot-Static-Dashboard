import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  partitionRecordsByOrganizationGroup,
  type OrganizationGroup,
} from '../data/organizationGroups'
import type { DateRange } from '../data/metrics'
import type { UserDay } from '../data/types'
import { fmtDayLong } from '../format'
import { usePrintMode } from '../hooks/usePrintMode'
import { UsageVisuals } from './UsageVisuals'

interface Props {
  groups: OrganizationGroup[]
  records: UserDay[]
  dailyBounds?: DateRange
}

export function CombinationReportsSection({
  groups,
  records,
  dailyBounds,
}: Props) {
  const instanceId = useId()
  const printing = usePrintMode()
  const [selectedKey, setSelectedKey] = useState(() => groups[0]?.key)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const recordsByGroup = useMemo(
    () => partitionRecordsByOrganizationGroup(records),
    [records],
  )

  useEffect(() => {
    if (!groups.some((group) => group.key === selectedKey)) {
      setSelectedKey(groups[0]?.key)
    }
  }, [groups, selectedKey])

  if (groups.length <= 1) return null

  const headingId = `${instanceId}-heading`
  const selectTab = (index: number) => {
    const group = groups[index]
    if (!group) return
    setSelectedKey(group.key)
    tabRefs.current[index]?.focus()
  }
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | undefined
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % groups.length
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + groups.length) % groups.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = groups.length - 1
    if (nextIndex === undefined) return
    event.preventDefault()
    selectTab(nextIndex)
  }

  return (
    <section className="combination-reports" aria-labelledby={headingId}>
      <header className="combination-reports__header">
        <div>
          <h2 id={headingId}>Detailed visuals by enterprise / organization</h2>
          <p>Select an enterprise and organization combination to inspect its usage.</p>
        </div>
        <span className="combination-reports__count">
          {groups.length.toLocaleString()} combinations
        </span>
      </header>

      <div className="combination-reports__content">
        <div className="combination-tabs" role="tablist" aria-label="Enterprise and organization">
          {groups.map((group, index) => {
            const selected = group.key === selectedKey
            const tabId = `${instanceId}-tab-${index}`
            const panelId = `${instanceId}-panel-${index}`
            return (
              <button
                className="combination-tabs__tab"
                type="button"
                role="tab"
                id={tabId}
                aria-controls={panelId}
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                key={group.key}
                ref={(element) => {
                  tabRefs.current[index] = element
                }}
                onClick={() => setSelectedKey(group.key)}
                onKeyDown={(event) => onTabKeyDown(event, index)}
              >
                {group.label}
              </button>
            )
          })}
        </div>

        <div className="combination-reports__panels">
          {groups.map((group, index) => {
            const selected = group.key === selectedKey
            const tabId = `${instanceId}-tab-${index}`
            const panelId = `${instanceId}-panel-${index}`
            const groupRecords = recordsByGroup.get(group.key) ?? []

            return (
              <section
                className="combination-report"
                role="tabpanel"
                id={panelId}
                aria-labelledby={tabId}
                tabIndex={0}
                hidden={!selected}
                key={group.key}
              >
                <header className="combination-report__header">
                  <p className="combination-report__eyebrow">Detailed usage visuals for</p>
                  <h3>{group.label}</h3>
                  {dailyBounds && (
                    <p>
                      Showing {fmtDayLong(dailyBounds.start)} – {fmtDayLong(dailyBounds.end)}
                    </p>
                  )}
                </header>
                {(selected || printing) && (
                  <UsageVisuals
                    records={groupRecords}
                    dailyBounds={dailyBounds}
                    emptyMessage="No records for this combination match the selected dates."
                  />
                )}
              </section>
            )
          })}
        </div>
      </div>
    </section>
  )
}
