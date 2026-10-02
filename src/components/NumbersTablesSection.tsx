import { useId, useMemo, useState } from 'react'
import {
  numbersTableMetrics,
  type DateRange,
  type SpendingCapScenario,
} from '../data/metrics'
import type { UserDay } from '../data/types'
import { fmtDayLong, fmtNumber, fmtPercent, fmtUsd } from '../format'
import { ChartCard } from './ChartCard'

const SUBSCRIPTION_PLANS = {
  business: { label: 'Copilot Business', allowanceCredits: 1_900 },
  enterprise: { label: 'Copilot Enterprise', allowanceCredits: 3_900 },
} as const

type SubscriptionPlan = keyof typeof SUBSCRIPTION_PLANS

interface Props {
  records: UserDay[]
  range: DateRange
}

function SummaryStat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="kpi">
      <div className="kpi__label">{label}</div>
      <div className="kpi__value">{value}</div>
      <div className="kpi__hint">{hint}</div>
    </div>
  )
}

function weekdaysToCap(value: number | null): string {
  if (value === null) return '—'
  const rounded = value.toFixed(1)
  return `${rounded} ${rounded === '1.0' ? 'weekday' : 'weekdays'}`
}

function SpendingCapRow({ scenario }: { scenario: SpendingCapScenario }) {
  return (
    <tr>
      <th scope="row">{fmtUsd(scenario.capUsd)}</th>
      <td>{fmtNumber(scenario.capCredits)}</td>
      <td>
        {fmtNumber(scenario.cappedUsers)} ({fmtPercent(scenario.cappedUsersPercentage)})
      </td>
      <td>{fmtUsd(scenario.organizationSavingsUsd)}</td>
      <td>{fmtPercent(scenario.organizationSavingsPercentage)}</td>
      <td>
        {scenario.savingsPerCappedEmployeeUsd === null
          ? '—'
          : fmtUsd(scenario.savingsPerCappedEmployeeUsd)}
      </td>
      <td>{weekdaysToCap(scenario.medianWeekdaysToCap)}</td>
    </tr>
  )
}

export function NumbersTablesSection({ records, range }: Props) {
  const planId = useId()
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('business')
  const plan = SUBSCRIPTION_PLANS[selectedPlan]
  const metrics = useMemo(
    () => numbersTableMetrics(records, range, plan.allowanceCredits),
    [plan.allowanceCredits, range, records],
  )
  const cycleDescription =
    metrics.cycles.length === 1
      ? 'one usage cycle'
      : `${fmtNumber(metrics.cycles.length)} usage cycles`

  return (
    <section className="numbers-section" aria-labelledby="numbers-heading">
      <header className="numbers-section__heading">
        <div>
          <h2 id="numbers-heading">Credits and budgets</h2>
          <p>
            Headline adoption and credit figures for the current filters, evaluated over{' '}
            {cycleDescription}.
          </p>
        </div>
        <label className="field numbers-section__plan" htmlFor={planId}>
          <span className="field__label">Copilot subscription</span>
          <select
            id={planId}
            value={selectedPlan}
            onChange={(event) => setSelectedPlan(event.target.value as SubscriptionPlan)}
          >
            {Object.entries(SUBSCRIPTION_PLANS).map(([id, option]) => (
              <option value={id} key={id}>
                {option.label} — {fmtNumber(option.allowanceCredits)} credits
              </option>
            ))}
          </select>
          <span className="numbers-section__plan-print">
            {plan.label} — {fmtNumber(plan.allowanceCredits)} credits
          </span>
        </label>
      </header>

      <div className="grid-compact">
        <SummaryStat
          label="Total users"
          value={fmtNumber(metrics.totalUsers)}
          hint="Distinct users observed in the selected range."
        />
        <SummaryStat
          label="Inactive users"
          value={`${fmtNumber(metrics.inactiveUsers)} (${fmtPercent(metrics.inactivePercentage)})`}
          hint="No interactions or generations anywhere in the selected range."
        />
        <SummaryStat
          label={`Below ${plan.label} allowance`}
          value={`${fmtNumber(metrics.belowAllowanceUsers)} (${fmtPercent(metrics.belowAllowancePercentage)})`}
          hint={`Below ${fmtNumber(metrics.allowanceCredits)} credits in every cycle where the user appears.`}
        />
      </div>

      <ChartCard
        title="Spending cap scenarios"
        subtitle={`The ${plan.label} allowance is applied first; overage caps then reset every 28 days from ${fmtDayLong(range.start)}. A trailing partial cycle receives the full allowance and cap.`}
      >
        <div className="numbers-table-wrap">
          <table className="numbers-table">
            <caption>Estimated impact of per-employee AI credit overage caps</caption>
            <thead>
              <tr>
                <th scope="col">28-day overage cap</th>
                <th scope="col">Overage cap in credits</th>
                <th scope="col">Users reaching cap</th>
                <th scope="col">Organization savings</th>
                <th scope="col">Savings rate</th>
                <th scope="col">Savings per capped employee</th>
                <th scope="col">Median time to cap</th>
              </tr>
            </thead>
            <tbody>
              {metrics.spendingCaps.map((scenario) => (
                <SpendingCapRow scenario={scenario} key={scenario.capUsd} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="numbers-section__notes">
          <p>
            Each cycle first subtracts the selected plan&apos;s included credits. Cap
            qualification and savings use only the remaining overage at 1 credit = $0.01.
            Savings rate is organization savings divided by current overage spend.
            Per-employee savings are averaged across distinct users who reached that cap.
          </p>
          <p>
            Median time uses only users who reached that cap and is based on each user&apos;s
            mean weekday overage across the full selected range. Weekends are excluded and
            missing weekdays count as zero.
          </p>
          <p>
            <code>ai_credits_used</code> is a consumption-analysis measure, not a billing or
            invoice total.
          </p>
        </div>
      </ChartCard>
    </section>
  )
}
