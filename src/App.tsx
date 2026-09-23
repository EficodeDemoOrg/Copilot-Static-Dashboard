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
  adoptionPhaseDistribution,
  anonymousAiCreditsPerUser,
  anonymousDailyAiCreditsPerUser,
  applyFilters,
  averageAiCredits,
  averageDailyAiCredits,
  byDay,
  customAgentRanking,
  dailyLocDeviation,
  dateRange,
  distinctOrganizationGroups,
  interactionsByFeaturePerDay,
  locByFeature,
  mcpRanking,
  pluginRanking,
  skillRanking,
  slashCommandRanking,
  topLanguageLoc,
  topModelLoc,
  usersBySurfaceByDay,
  type Filters,
} from './data/metrics'
import { SAMPLE_FILE_NAME, SAMPLE_NDJSON } from './data/sample'
import { compareOrganizationGroups } from './data/comparisons'
import { UploadPanel, type UploadFileItem } from './components/UploadPanel'
import { FilterBar } from './components/FilterBar'
import { ReportHeader } from './components/ReportHeader'
import { EficodeLogo } from './components/EficodeLogo'
import { ChartCard } from './components/ChartCard'
import { RankingDisclosure } from './components/RankingDisclosure'
import { FeatureInteractionsChart } from './components/charts/FeatureInteractionsChart'
import { GenerationsAcceptancesChart } from './components/charts/GenerationsAcceptancesChart'
import { SurfaceUsageChart } from './components/charts/SurfaceUsageChart'
import { AiCreditsChart } from './components/charts/AiCreditsChart'
import { ATTRIBUTED_LOC_NOTE, LocGroupedBarChart } from './components/charts/LocGroupedBarChart'
import { AdoptionPhaseChart } from './components/charts/AdoptionPhaseChart'
import { AverageAiCreditsStat } from './components/charts/AverageAiCreditsStat'
import { AnonymousCreditDotPlot, DAILY_CREDIT_DOT_PLOT_NOTE } from './components/charts/AnonymousCreditDotPlot'
import { LocDeviationChart } from './components/charts/LocDeviationChart'
import { RankedBarChart } from './components/charts/RankedBarChart'
import { OrganizationComparisonSection } from './components/OrganizationComparisonSection'

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

  const daily = useMemo(() => byDay(filtered, dailyBounds), [filtered, dailyBounds])
  const featureInteractions = useMemo(
    () => interactionsByFeaturePerDay(filtered, dailyBounds),
    [filtered, dailyBounds],
  )
  const surfaceDaily = useMemo(() => usersBySurfaceByDay(filtered, dailyBounds), [filtered, dailyBounds])
  const locDeviationDaily = useMemo(() => dailyLocDeviation(filtered, dailyBounds), [filtered, dailyBounds])

  const featureLoc = useMemo(() => locByFeature(filtered), [filtered])
  const adoptionPhases = useMemo(() => adoptionPhaseDistribution(filtered), [filtered])
  const avgCredits = useMemo(() => averageAiCredits(filtered), [filtered])
  const avgDailyCredits = useMemo(() => averageDailyAiCredits(daily), [daily])
  const creditDistribution = useMemo(() => anonymousAiCreditsPerUser(filtered), [filtered])
  const dailyCreditDistribution = useMemo(() => anonymousDailyAiCreditsPerUser(filtered), [filtered])
  const topModels = useMemo(() => topModelLoc(filtered), [filtered])
  const topLanguages = useMemo(() => topLanguageLoc(filtered), [filtered])
  const customAgents = useMemo(() => customAgentRanking(filtered), [filtered])
  const mcps = useMemo(() => mcpRanking(filtered), [filtered])
  const skills = useMemo(() => skillRanking(filtered), [filtered])
  const plugins = useMemo(() => pluginRanking(filtered), [filtered])
  const slashCommands = useMemo(() => slashCommandRanking(filtered), [filtered])
  const comparisons = useMemo(
    () => compareOrganizationGroups(filtered, dataset.aliases),
    [dataset.aliases, filtered],
  )

  if (!bounds) return <p className="empty">No dated records in this export.</p>

  return (
    <>
      <ReportHeader
        fileNames={dataset.fileNames}
        adapterLabel={dataset.adapterLabel}
        reportWindow={reportWindow}
        range={range}
        filters={filters}
        organizationGroups={organizationGroups}
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
        organizationGroups={organizationGroups}
        shownRecords={filtered.length}
        totalRecords={records.length}
      />

      {filtered.length === 0 ? (
        <p className="empty">No records match the current filters.</p>
      ) : (
        <>
          <OrganizationComparisonSection data={comparisons} />

          <ChartCard
            title="Interactions per day, by feature"
            subtitle="Stacked by the top 7 features in this range; every other feature folds into Other."
          >
            <FeatureInteractionsChart data={featureInteractions} />
          </ChartCard>

          <ChartCard
            title="Code generations and acceptances per day"
            subtitle="Independent counts, plotted together — never combined into an acceptance-rate percentage."
          >
            <GenerationsAcceptancesChart data={daily} />
          </ChartCard>

          <ChartCard
            title="Daily users by surface"
            subtitle="Distinct users per day using IDE agent mode, IDE chat, the CLI, and Copilot cloud/coding agent."
          >
            <SurfaceUsageChart data={surfaceDaily} />
          </ChartCard>

          <ChartCard title="Daily AI Credits Consumed">
            <AiCreditsChart data={daily} />
          </ChartCard>

          <ChartCard title="LoC added/deleted per feature">
            <LocGroupedBarChart
              data={featureLoc}
              labelWidth={170}
              emptyMessage="No attributed feature LoC data for this range."
            />
          </ChartCard>

          <ChartCard
            title="AI Adoption per User"
            subtitle="Each user's highest adoption phase reached in the selected range, not their most recent."
          >
            <AdoptionPhaseChart data={adoptionPhases} />
          </ChartCard>

          <div className="grid-compact">
            <AverageAiCreditsStat value={avgCredits} />
            <AverageAiCreditsStat
              value={avgDailyCredits.perUser}
              label="Average daily AI credits used per user"
              note="Each day's AI credits ÷ that day's active users, averaged across days with at least one active user."
            />
            <AverageAiCreditsStat
              value={avgDailyCredits.total}
              label="Average daily AI credits used in total"
              note="Total AI credits across all users, averaged per day over the selected range."
            />
          </div>

          <ChartCard title="AI Credits Consumed per User">
            <AnonymousCreditDotPlot data={creditDistribution} />
          </ChartCard>

          <ChartCard title="Daily AI Credits Consumed per User (Mean)">
            <AnonymousCreditDotPlot
              data={dailyCreditDistribution}
              axisLabel="Daily AI credits (mean)"
              note={DAILY_CREDIT_DOT_PLOT_NOTE}
            />
          </ChartCard>

          <ChartCard
            title="Daily lines of code per user, mean and deviation"
            subtitle="Mean and ±1 population standard deviation across that day's user records, not across daily organization totals."
          >
            <LocDeviationChart data={locDeviationDaily} />
          </ChartCard>

          <div className="grid-2">
            <ChartCard
              title="Top 5 models by LoC changed"
              subtitle="Ranked by combined added + deleted LoC; added and deleted are shown as separate bars."
            >
              <LocGroupedBarChart
                data={topModels}
                labelWidth={130}
                note={ATTRIBUTED_LOC_NOTE}
                emptyMessage="No attributed model LoC data for this range."
              />
            </ChartCard>
            <ChartCard
              title="Top 5 languages by LoC changed"
              subtitle="Ranked by combined added + deleted LoC; added and deleted are shown as separate bars."
            >
              <LocGroupedBarChart
                data={topLanguages}
                labelWidth={130}
                note={ATTRIBUTED_LOC_NOTE}
                emptyMessage="No attributed language LoC data for this range."
              />
            </ChartCard>
          </div>

          <div className="grid-compact">
            <ChartCard title="Top 5 custom agents" subtitle="Ranked by interaction count.">
              <RankedBarChart
                data={customAgents.top}
                measure="interactionCount"
                label="Interactions"
                emptyMessage="No custom agent usage recorded for this range."
              />
            </ChartCard>
            <ChartCard title="Top 5 MCP servers">
              <RankedBarChart
                data={mcps.top}
                measure="interactionCount"
                label="Interactions"
                emptyMessage="No MCP server usage recorded for this range."
              />
            </ChartCard>
            <ChartCard title="Top 5 skills">
              <RankedBarChart
                data={skills.top}
                measure="interactionCount"
                label="Interactions"
                emptyMessage="No skill usage recorded for this range."
              />
            </ChartCard>
            <ChartCard title="Top 5 plugins">
              <RankedBarChart
                data={plugins.top}
                measure="interactionCount"
                label="Interactions"
                emptyMessage="No plugin usage recorded for this range."
              />
            </ChartCard>
            <ChartCard title="Top 5 slash commands">
              <RankedBarChart
                data={slashCommands.top}
                measure="interactionCount"
                label="Interactions"
                emptyMessage="No slash command usage recorded for this range."
              />
            </ChartCard>
          </div>

          <RankingDisclosure title="All skills" items={skills.all} />
          <RankingDisclosure title="All MCP servers" items={mcps.all} />
          <RankingDisclosure title="All agents" items={customAgents.all} />
          <RankingDisclosure title="All slash commands" items={slashCommands.all} />
          <RankingDisclosure title="All plugins" items={plugins.all} />
        </>
      )}
    </>
  )
}
