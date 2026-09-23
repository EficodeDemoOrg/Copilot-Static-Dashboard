import type { Filters } from '../data/metrics'

interface Props {
  filters: Filters
  onChange: (next: Filters) => void
  /** Full extent of the loaded data — used as the input bounds and the reset target. */
  bounds: { start: string; end: string }
  shownRecords: number
  totalRecords: number
}

export function FilterBar({ filters, onChange, bounds, shownRecords, totalRecords }: Props) {
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
