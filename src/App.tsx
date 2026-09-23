import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  mergeValidatedFiles,
  ReportFormatError,
  validateFile,
  validateNdjsonText,
} from './data/parseNdjson'
import { emptyEntityAliases, normalizeEntityAliases } from './data/entityAliases'
import type { Dataset, EntityAliases, FileValidationResult } from './data/types'
import {
  applyFilters,
  dateRange,
  distinctOrganizationGroups,
  type Filters,
} from './data/metrics'
import { SAMPLE_FILE_NAME, SAMPLE_NDJSON } from './data/sample'
import { compareOrganizationGroups } from './data/comparisons'
import { UploadPanel, type UploadFileItem } from './components/UploadPanel'
import { FilterBar } from './components/FilterBar'
import { ReportHeader } from './components/ReportHeader'
import { EficodeLogo } from './components/EficodeLogo'
import { OrganizationComparisonSection } from './components/OrganizationComparisonSection'
import { UsageVisuals } from './components/UsageVisuals'
import { CombinationReportsSection } from './components/CombinationReportsSection'
import { DashboardTabs, type DashboardTab } from './components/DashboardTabs'
import { PrintModeProvider } from './hooks/usePrintMode'

interface Loaded {
  dataset: Dataset
  generatedAt: Date
}

function sortedIds(results: FileValidationResult[], key: 'enterpriseIds' | 'organizationIds') {
  return [...new Set(results.filter((result) => result.valid).flatMap((result) => result[key]))].sort(
    (a, b) => a.localeCompare(b),
  )
}

export function App() {
  const [loaded, setLoaded] = useState<Loaded | undefined>()
  const [reviewFiles, setReviewFiles] = useState<UploadFileItem[]>([])
  const [aliases, setAliases] = useState<EntityAliases>(() => emptyEntityAliases())
  const [filters, setFilters] = useState<Filters>({})
  const [error, setError] = useState<string | undefined>()
  const nextFileId = useRef(0)

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

  const validatedResults = useMemo(
    () =>
      reviewFiles.flatMap((item) =>
        item.status === 'validated' && item.result ? [item.result] : [],
      ),
    [reviewFiles],
  )
  const enterpriseIds = useMemo(
    () => sortedIds(validatedResults, 'enterpriseIds'),
    [validatedResults],
  )
  const organizationIds = useMemo(
    () => sortedIds(validatedResults, 'organizationIds'),
    [validatedResults],
  )
  const busy = reviewFiles.some((item) => item.status === 'validating')

  useEffect(() => {
    setAliases((current) =>
      normalizeEntityAliases(current, new Set(enterpriseIds), new Set(organizationIds)),
    )
  }, [enterpriseIds, organizationIds])

  const onFiles = useCallback(async (files: File[]) => {
    setError(undefined)
    const pending = files.map((file) => {
      const item: UploadFileItem = {
        id: `upload-${++nextFileId.current}`,
        fileName: file.name,
        status: 'validating',
      }
      return { file, item }
    })
    setReviewFiles((current) => [...current, ...pending.map(({ item }) => item)])

    for (const { file, item } of pending) {
      const result = await validateFile(file)
      setReviewFiles((current) =>
        current.map((existing) =>
          existing.id === item.id ? { ...existing, status: 'validated', result } : existing,
        ),
      )
    }
  }, [])

  const onSample = useCallback(() => {
    setError(undefined)
    const result = validateNdjsonText(SAMPLE_NDJSON, SAMPLE_FILE_NAME)
    setReviewFiles((current) => [
      ...current,
      {
        id: `upload-${++nextFileId.current}`,
        fileName: SAMPLE_FILE_NAME,
        status: 'validated',
        result,
      },
    ])
  }, [])

  const removeReviewFile = useCallback((id: string) => {
    setError(undefined)
    setReviewFiles((current) => current.filter((item) => item.id !== id))
  }, [])

  const changeAlias = useCallback(
    (type: 'enterprise' | 'organization', id: string, value: string) => {
      setAliases((current) => {
        const enterprises = new Map(current.enterprises)
        const organizations = new Map(current.organizations)
        const target = type === 'enterprise' ? enterprises : organizations
        target.set(id, value)
        return { enterprises, organizations }
      })
    },
    [],
  )

  const continueToDashboard = useCallback(() => {
    try {
      accept(mergeValidatedFiles(validatedResults, aliases))
    } catch (e) {
      fail(e)
    }
  }, [accept, aliases, fail, validatedResults])

  const clear = useCallback(() => {
    setLoaded(undefined)
    setReviewFiles([])
    setAliases(emptyEntityAliases())
    setFilters({})
    setError(undefined)
  }, [])

  return (
    <PrintModeProvider>
      <div className="app">
        <header className="appbar no-print">
          <div className="appbar__brand">
            <EficodeLogo height={44} />
            <div>
              <h1 className="appbar__title">Copilot Usage Dashboard</h1>
              <p className="appbar__sub">
                {loaded
                  ? `${loaded.dataset.fileNames.length === 1 ? loaded.dataset.fileNames[0] : `${loaded.dataset.fileNames.length} files`} · ${loaded.dataset.records.length.toLocaleString()} user-days`
                  : reviewFiles.length > 0
                    ? `${reviewFiles.length.toLocaleString()} ${reviewFiles.length === 1 ? 'file' : 'files'} in upload review`
                    : 'Upload a GitHub Copilot usage metrics export — it never leaves your browser.'}
              </p>
            </div>
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
          <UploadPanel
            onFiles={onFiles}
            onSample={onSample}
            onRemove={removeReviewFile}
            onAliasChange={changeAlias}
            onContinue={continueToDashboard}
            files={reviewFiles}
            aliases={aliases}
            enterpriseIds={enterpriseIds}
            organizationIds={organizationIds}
            error={error}
            busy={busy}
          />
        )}
      </div>
    </PrintModeProvider>
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
  const organizationGroups = useMemo(
    () => distinctOrganizationGroups(records, dataset.aliases),
    [dataset.aliases, records],
  )

  const filtered = useMemo(() => applyFilters(records, filters), [records, filters])

  const range = useMemo(() => dateRange(filtered), [filtered])

  // Shared basis for every zero-filled daily series, so the daily/deviation
  // charts never silently disagree on span: the report window, narrowed by
  // whichever date filter is tighter.
  const dailyBounds = useMemo(() => {
    const lo = filters.start && filters.start > (bounds?.start ?? '') ? filters.start : bounds?.start
    const hi = filters.end && filters.end < (bounds?.end ?? '') ? filters.end : bounds?.end
    return lo && hi ? { start: lo, end: hi } : undefined
  }, [filters.start, filters.end, bounds])

  const comparisons = useMemo(
    () => compareOrganizationGroups(filtered, dataset.aliases),
    [dataset.aliases, filtered],
  )

  if (!bounds) return <p className="empty">No dated records in this export.</p>

  const tabs: DashboardTab[] = [
    {
      id: 'comparisons',
      label: 'Comparisons',
      content: <OrganizationComparisonSection data={comparisons} />,
    },
    {
      id: 'aggregate',
      label: 'Aggregate',
      content: <UsageVisuals records={filtered} dailyBounds={dailyBounds} />,
    },
  ]

  if (organizationGroups.length > 1) {
    tabs.push({
      id: 'organizations',
      label: 'Organizations',
      content: (
        <CombinationReportsSection
          groups={organizationGroups}
          records={filtered}
          dailyBounds={dailyBounds}
        />
      ),
    })
  }

  return (
    <>
      <ReportHeader
        fileNames={dataset.fileNames}
        adapterLabel={dataset.adapterLabel}
        reportWindow={reportWindow}
        range={range}
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
        shownRecords={filtered.length}
        totalRecords={records.length}
      />

      {filtered.length === 0 ? (
        <p className="empty">No records match the current filters.</p>
      ) : (
        <DashboardTabs tabs={tabs} />
      )}
    </>
  )
}
