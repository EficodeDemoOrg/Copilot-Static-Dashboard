import type { Filters } from '../data/metrics'
import type { OrganizationGroup } from '../data/organizationGroups'

interface Props {
  filters: Filters
  onChange: (next: Filters) => void
  /** Full extent of the loaded data — used as the input bounds and the reset target. */
  bounds: { start: string; end: string }
  organizationGroups: OrganizationGroup[]
  shownRecords: number
  totalRecords: number
}

export function FilterBar({ filters, onChange, bounds, organizationGroups, shownRecords, totalRecords }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })

  return (
    <div className="filters no-print">
      <label className="field">
        <span className="field__label">From</span>
        <input
          type="date"
          value={filters.start ?? bounds.start}
          min={bounds.start}
          max={filters.end ?? bounds.end}
          onChange={(e) => set({ start: e.target.value || undefined })}
        />
      </label>

      <label className="field">
        <span className="field__label">To</span>
        <input
          type="date"
          value={filters.end ?? bounds.end}
          min={filters.start ?? bounds.start}
          max={bounds.end}
          onChange={(e) => set({ end: e.target.value || undefined })}
        />
      </label>

      {organizationGroups.length > 1 && (
        <label className="field">
          <span className="field__label">Enterprise / organization</span>
          <select
            value={filters.organizationGroup ?? ''}
            onChange={(e) => set({ organizationGroup: e.target.value || undefined })}
          >
            <option value="">All enterprise / organization groups</option>
            {organizationGroups.map((group) => (
              <option key={group.key} value={group.key}>
                {group.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="filters__spacer" />

      <span className="filters__count">
        {shownRecords.toLocaleString()} of {totalRecords.toLocaleString()} user-days
      </span>
      <button className="btn" onClick={() => onChange({})} disabled={shownRecords === totalRecords}>
        Reset filters
      </button>
    </div>
  )
}
