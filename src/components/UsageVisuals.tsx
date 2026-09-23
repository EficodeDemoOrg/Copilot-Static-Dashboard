import { useMemo } from 'react'
import {
  adoptionPhaseDistribution,
  anonymousAiCreditsPerUser,
  anonymousDailyAiCreditsPerUser,
  averageAiCredits,
  averageDailyAiCredits,
  byDay,
  customAgentRanking,
  dailyLocDeviation,
  interactionsByFeaturePerDay,
  locByFeature,
  mcpRanking,
  pluginRanking,
  skillRanking,
  slashCommandRanking,
  topLanguageLoc,
  topModelLoc,
  usersBySurfaceByDay,
  type DateRange,
} from '../data/metrics'
import type { UserDay } from '../data/types'
import { ChartCard } from './ChartCard'
import { RankingDisclosure } from './RankingDisclosure'
import { AdoptionPhaseChart } from './charts/AdoptionPhaseChart'
import { AiCreditsChart } from './charts/AiCreditsChart'
import { AnonymousCreditDotPlot, DAILY_CREDIT_DOT_PLOT_NOTE } from './charts/AnonymousCreditDotPlot'
import { AverageAiCreditsStat } from './charts/AverageAiCreditsStat'
import { FeatureInteractionsChart } from './charts/FeatureInteractionsChart'
import { GenerationsAcceptancesChart } from './charts/GenerationsAcceptancesChart'
import { LocDeviationChart } from './charts/LocDeviationChart'
import { ATTRIBUTED_LOC_NOTE, LocGroupedBarChart } from './charts/LocGroupedBarChart'
import { RankedBarChart } from './charts/RankedBarChart'
import { SurfaceUsageChart } from './charts/SurfaceUsageChart'

interface Props {
  records: UserDay[]
  dailyBounds?: DateRange
  emptyMessage?: string
}

export function UsageVisuals({
  records,
  dailyBounds,
  emptyMessage = 'No records match the current filters.',
}: Props) {
  const daily = useMemo(() => byDay(records, dailyBounds), [records, dailyBounds])
  const featureInteractions = useMemo(
    () => interactionsByFeaturePerDay(records, dailyBounds),
    [records, dailyBounds],
  )
  const surfaceDaily = useMemo(
    () => usersBySurfaceByDay(records, dailyBounds),
    [records, dailyBounds],
  )
  const locDeviationDaily = useMemo(
    () => dailyLocDeviation(records, dailyBounds),
    [records, dailyBounds],
  )

  const featureLoc = useMemo(() => locByFeature(records), [records])
  const adoptionPhases = useMemo(() => adoptionPhaseDistribution(records), [records])
  const avgCredits = useMemo(() => averageAiCredits(records), [records])
  const avgDailyCredits = useMemo(() => averageDailyAiCredits(daily), [daily])
  const creditDistribution = useMemo(() => anonymousAiCreditsPerUser(records), [records])
  const dailyCreditDistribution = useMemo(
    () => anonymousDailyAiCreditsPerUser(records),
    [records],
  )
  const topModels = useMemo(() => topModelLoc(records), [records])
  const topLanguages = useMemo(() => topLanguageLoc(records), [records])
  const customAgents = useMemo(() => customAgentRanking(records), [records])
  const mcps = useMemo(() => mcpRanking(records), [records])
  const skills = useMemo(() => skillRanking(records), [records])
  const plugins = useMemo(() => pluginRanking(records), [records])
  const slashCommands = useMemo(() => slashCommandRanking(records), [records])

  if (records.length === 0) return <p className="empty">{emptyMessage}</p>

  return (
    <div className="usage-visuals">
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
    </div>
  )
}
