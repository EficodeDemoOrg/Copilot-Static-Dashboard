import { useCallback, useMemo, useState } from 'react'
import { parseFiles, parseNdjsonText, ReportFormatError } from './data/parseNdjson'
import type { Dataset } from './data/types'
import {
  applyFilters,
  byDay,
  byUser,
  dateRange,
  distinctOrgs,
  totals,
  type Filters,
} from './data/metrics'
import { SAMPLE_FILE_NAME, SAMPLE_NDJSON } from './data/sample'
import { fmtCompact, fmtDayLong, fmtNumber, fmtPercent } from './format'
import { UploadPanel } from './components/UploadPanel'
import { FilterBar } from './components/FilterBar'
import { ReportHeader } from './components/ReportHeader'
import { KpiRow, type Kpi } from './components/KpiRow'
import { ChartCard } from './components/ChartCard'
import { DailyUsageChart } from './components/charts/DailyUsageChart'
import { AcceptanceRateChart } from './components/charts/AcceptanceRateChart'
import { RankedBarChart } from './components/charts/RankedBarChart'

const TOP_USERS = 15

/** Stated wherever an "active" count appears — 43% of records fail this test. */
const ACTIVE_RULE = 'A user counts as active on a day with at least one interaction or code generation.'

interface Loaded {
  dataset: Dataset
  generatedAt: Date
}

export function App() {
  const [loaded, setLoaded] = useState<Loaded | undefined>()
  const [filters, setFilters] = useState<Filters>({})
  const [error, setError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)

  const accept = useCallback((dataset: Dataset) => {
    setLoaded({ dataset, generatedAt: new Date() })
    setFilters({})
    setError(undefined)
  }, [])

  const fail = useCallback((e: unknown) => {
    setLoaded(undefined)
    setError(
      e instanceof ReportFormatError
        ? `${e.message}${e.sampleKeys.length ? ` Fields found: ${e.sampleKeys.slice(0, 12).join(', ')}.` : ''}`
        : e instanceof Error
          ? e.message
          : 'Unknown error.',
    )
  }, [])

  const onFiles = useCallback(
    async (files: File[]) => {
      setBusy(true)
      try {
        accept(await parseFiles(files))
      } catch (e) {
        fail(e)
      } finally {
        setBusy(false)
      }
    },
    [accept, fail],
  )

  const onSample = useCallback(() => {
    try {
      accept(parseNdjsonText(SAMPLE_NDJSON, SAMPLE_FILE_NAME))
    } catch (e) {
      fail(e)
    }
  }, [accept, fail])

  const clear = useCallback(() => {
    setLoaded(undefined)
    setFilters({})
    setError(undefined)
  }, [])

  return (
    <div className="app">
      <header className="appbar no-print">
        <div>
          <h1 className="appbar__title">Copilot Usage Dashboard</h1>
          <p className="appbar__sub">
            {loaded
              ? `${loaded.dataset.fileNames.length === 1 ? loaded.dataset.fileNames[0] : `${loaded.dataset.fileNames.length} files`} · ${loaded.dataset.records.length.toLocaleString()} user-days`
              : 'Upload a GitHub Copilot usage metrics export — it never leaves your browser.'}
          </p>
        </div>
        {loaded && (
          <div className="appbar__actions">
            <button className="btn" onClick={clear}>
              Clear data
            </button>
            <button className="btn btn--primary" onClick={() => window.print()}>
              Export PDF
            </button>
          </div>
        )}
      </header>

      {loaded ? (
        <Dashboard
          dataset={loaded.dataset}
          generatedAt={loaded.generatedAt}
          filters={filters}
          onFilters={setFilters}
        />
      ) : (
        <UploadPanel onFiles={onFiles} onSample={onSample} error={error} busy={busy} />
      )}
    </div>
  )
}

interface DashboardProps {
  dataset: Dataset
  generatedAt: Date
  filters: Filters
  onFilters: (f: Filters) => void
}

function Dashboard({ dataset, generatedAt, filters, onFilters }: DashboardProps) {
  const { records, reportWindow } = dataset

  // The report window is the honest bound: it is the period GitHub reported on,
  // not merely the days that happened to see activity.
  const observed = useMemo(() => dateRange(records), [records])
  const bounds = reportWindow ?? observed
  const organizations = useMemo(() => distinctOrgs(records), [records])

  const filtered = useMemo(() => applyFilters(records, filters), [records, filters])

  const t = useMemo(() => totals(filtered), [filtered])
  const range = useMemo(() => dateRange(filtered), [filtered])
  const daily = useMemo(() => {
    const lo = filters.start && filters.start > (bounds?.start ?? '') ? filters.start : bounds?.start
    const hi = filters.end && filters.end < (bounds?.end ?? '') ? filters.end : bounds?.end
    return byDay(filtered, lo && hi ? { start: lo, end: hi } : undefined)
  }, [filtered, filters.start, filters.end, bounds])
  const users = useMemo(() => byUser(filtered), [filtered])
  const topUsers = useMemo(() => users.slice(0, TOP_USERS), [users])

  const kpis: Kpi[] = [
    {
      label: 'Active users',
      value: fmtNumber(t.activeUsers),
      hint:
        t.usersSeen > t.activeUsers
          ? `of ${fmtNumber(t.usersSeen)} in the export — ${fmtNumber(t.usersSeen - t.activeUsers)} never active`
          : 'with at least one active day',
    },
    {
      label: 'Active user-days',
      value: fmtNumber(t.activeUserDays),
      hint: `of ${fmtNumber(t.records)} recorded`,
    },
    { label: 'Interactions', value: fmtNumber(t.interactions), hint: 'user-initiated' },
    { label: 'Code generations', value: fmtNumber(t.generations) },
    {
      label: 'Acceptance rate',
      value: fmtPercent(t.acceptanceRate),
      hint: `${fmtCompact(t.acceptances)} accepted`,
    },
    { label: 'Lines added', value: fmtCompact(t.locAdded), hint: `${fmtCompact(t.locDeleted)} deleted` },
    { label: 'AI credits', value: fmtCompact(t.aiCredits) },
    {
      label: 'Date range',
      value: range ? fmtDayLong(range.start) : '—',
      hint: range ? `to ${fmtDayLong(range.end)}` : undefined,
    },
  ]

  if (!bounds) return <p className="empty">No dated records in this export.</p>

  return (
    <>
      <ReportHeader
        fileNames={dataset.fileNames}
        adapterLabel={dataset.adapterLabel}
        reportWindow={reportWindow}
        range={range}
        filters={filters}
        generatedAt={generatedAt}
      />

      {dataset.warnings.length > 0 && (
        <div className="alert alert--warn no-print">
          <strong>Note.</strong> {dataset.warnings.join(' ')}
        </div>
      )}

      <FilterBar
        filters={filters}
        onChange={onFilters}
        bounds={bounds}
        organizations={organizations}
        shownRecords={filtered.length}
        totalRecords={records.length}
      />

      {filtered.length === 0 ? (
        <p className="empty">No records match the current filters.</p>
      ) : (
        <>
          <KpiRow items={kpis} />

          <ChartCard
            title="Active users per day"
            subtitle={`How many people used Copilot each day. ${ACTIVE_RULE}`}
          >
            <DailyUsageChart data={daily} measure="activeUsers" label="Active users" />
          </ChartCard>

          <ChartCard
            title="Interactions per day"
            subtitle="User-initiated interactions — chats, agent turns, and commands. Shown on its own scale rather than sharing an axis with the user count above."
          >
            <DailyUsageChart data={daily} measure="interactions" label="Interactions" />
          </ChartCard>

          <ChartCard
            title="Acceptance rate per day"
            subtitle={`Accepted code suggestions as a share of those generated${
              t.acceptanceRate !== null ? `; the dashed line is the period average, ${fmtPercent(t.acceptanceRate)}` : ''
            }. Days with no generations are left as a gap, not plotted as zero.`}
          >
            <AcceptanceRateChart data={daily} average={t.acceptanceRate} />
          </ChartCard>

          <ChartCard
            title={`Top ${TOP_USERS} users by interactions`}
            subtitle="Who drives usage."
            note={
              users.length > TOP_USERS
                ? `${users.length - TOP_USERS} further user${users.length - TOP_USERS === 1 ? '' : 's'} not shown.`
                : undefined
            }
          >
            <RankedBarChart data={topUsers} measure="interactions" label="Interactions" labelWidth={130} />
          </ChartCard>
        </>
      )}
    </>
  )
}
