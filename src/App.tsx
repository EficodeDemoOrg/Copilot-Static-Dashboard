import { useCallback, useMemo, useState } from 'react'
import { parseFiles, parseNdjsonText, ReportFormatError } from './data/parseNdjson'
import type { Dataset } from './data/types'
import {
  adoptionPhaseDistribution,
  anonymousAiCreditsPerUser,
  applyFilters,
  averageAiCredits,
  byDay,
  customAgentRanking,
  dailyLocDeviation,
  dateRange,
  distinctOrgs,
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
import { UploadPanel } from './components/UploadPanel'
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
import { AnonymousCreditDotPlot } from './components/charts/AnonymousCreditDotPlot'
import { LocDeviationChart } from './components/charts/LocDeviationChart'
import { RankedBarChart } from './components/charts/RankedBarChart'

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
        <div className="appbar__brand">
          <EficodeLogo height={44} />
          <div>
            <h1 className="appbar__title">Copilot Usage Dashboard</h1>
            <p className="appbar__sub">
              {loaded
                ? `${loaded.dataset.fileNames.length === 1 ? loaded.dataset.fileNames[0] : `${loaded.dataset.fileNames.length} files`} · ${loaded.dataset.records.length.toLocaleString()} user-days`
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
  const creditDistribution = useMemo(() => anonymousAiCreditsPerUser(filtered), [filtered])
  const topModels = useMemo(() => topModelLoc(filtered), [filtered])
  const topLanguages = useMemo(() => topLanguageLoc(filtered), [filtered])
  const customAgents = useMemo(() => customAgentRanking(filtered), [filtered])
  const mcps = useMemo(() => mcpRanking(filtered), [filtered])
  const skills = useMemo(() => skillRanking(filtered), [filtered])
  const plugins = useMemo(() => pluginRanking(filtered), [filtered])
  const slashCommands = useMemo(() => slashCommandRanking(filtered), [filtered])

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
          <ChartCard
            title="Interactions per day, by feature"
            subtitle="Stacked by the top 7 features in this range; every other feature folds into Other."
          >
            <FeatureInteractionsChart data={featureInteractions} />
          </ChartCard>

          <ChartCard title="Code generations and acceptances per day">
            <GenerationsAcceptancesChart data={daily} />
          </ChartCard>

          <ChartCard
            title="Daily users by surface"
            subtitle="Distinct users per day using IDE agent mode, IDE chat, the CLI, and Copilot cloud/coding agent."
          >
            <SurfaceUsageChart data={surfaceDaily} />
          </ChartCard>

          <ChartCard title="AI credits per day">
            <AiCreditsChart data={daily} />
          </ChartCard>

          <ChartCard title="LoC added/deleted per feature">
            <LocGroupedBarChart
              data={featureLoc}
              labelWidth={170}
              emptyMessage="No attributed feature LoC data for this range."
            />
          </ChartCard>

          <div className="grid-2">
            <ChartCard title="Highest AI adoption phase per user">
              <AdoptionPhaseChart data={adoptionPhases} />
            </ChartCard>
            <AverageAiCreditsStat value={avgCredits} />
          </div>

          <ChartCard title="Anonymous per-user AI credit distribution">
            <AnonymousCreditDotPlot data={creditDistribution} />
          </ChartCard>

          <ChartCard title="Daily lines of code per user, mean and deviation">
            <LocDeviationChart data={locDeviationDaily} />
          </ChartCard>

          <div className="grid-2">
            <ChartCard title="Top 5 models by LoC changed">
              <LocGroupedBarChart
                data={topModels}
                labelWidth={130}
                note={ATTRIBUTED_LOC_NOTE}
                emptyMessage="No attributed model LoC data for this range."
              />
            </ChartCard>
            <ChartCard title="Top 5 languages by LoC changed">
              <LocGroupedBarChart
                data={topLanguages}
                labelWidth={130}
                note={ATTRIBUTED_LOC_NOTE}
                emptyMessage="No attributed language LoC data for this range."
              />
            </ChartCard>
          </div>

          <div className="grid-compact">
            <ChartCard title="Top 5 custom agents">
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
