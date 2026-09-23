import type { ReactNode } from 'react'
import {
  ADOPTION_BUCKETS,
  CUSTOMIZATION_COLUMNS,
  TOOL_COLUMNS,
  type AdoptionComparisonRow,
  type CreditComparisonRow,
  type CustomizationComparisonRow,
  type FeaturePreferenceRow,
  type LocComparisonRow,
  type OrganizationComparisons,
  type ToolComparisonRow,
} from '../data/comparisons'
import { fmtCompact, fmtNumber, fmtPercent } from '../format'
import { ChartCard } from './ChartCard'

interface Props {
  data: OrganizationComparisons
}

interface ComparisonRow {
  key: string
  label: string
}

interface ComparisonColumn<Row> {
  key: string
  label: string
  render: (row: Row) => ReactNode
}

const PRINT_COLUMNS_PER_TABLE = 3

function chunkColumns<Row>(columns: readonly ComparisonColumn<Row>[]): ComparisonColumn<Row>[][] {
  const chunks: ComparisonColumn<Row>[][] = []
  for (let index = 0; index < columns.length; index += PRINT_COLUMNS_PER_TABLE) {
    chunks.push(columns.slice(index, index + PRINT_COLUMNS_PER_TABLE))
  }
  return chunks
}

function ComparisonTableMarkup<Row extends ComparisonRow>({
  label,
  rows,
  columns,
  caption,
}: {
  label: string
  rows: readonly Row[]
  columns: readonly ComparisonColumn<Row>[]
  caption?: string
}) {
  return (
    <table className="comparison-table" aria-label={label}>
      {caption && <caption>{caption}</caption>}
      <thead>
        <tr>
          <GroupHeader />
          {columns.map((column) => (
            <th key={column.key} scope="col">
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <GroupCell label={row.label} />
            {columns.map((column) => (
              <td key={column.key}>{column.render(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function GroupHeader() {
  return <th scope="col">Enterprise / organization</th>
}

function GroupCell({ label }: { label: string }) {
  return (
    <th scope="row" className="comparison-table__group">
      {label}
    </th>
  )
}

function ComparisonTable<Row extends ComparisonRow>({
  label,
  rows,
  columns,
}: {
  label: string
  rows: readonly Row[]
  columns: readonly ComparisonColumn<Row>[]
}) {
  const printColumnGroups = chunkColumns(columns)

  return (
    <>
      <div className="comparison-table-wrap comparison-table-wrap--screen">
        <ComparisonTableMarkup label={label} rows={rows} columns={columns} />
      </div>
      <div className="comparison-table-print">
        {printColumnGroups.map((group, index) => {
          const firstMetric = index * PRINT_COLUMNS_PER_TABLE + 1
          const lastMetric = firstMetric + group.length - 1
          const caption = printColumnGroups.length > 1
            ? `Metrics ${firstMetric}–${lastMetric} of ${columns.length}`
            : undefined

          return (
            <div
              className="comparison-table-wrap comparison-table-print__segment"
              key={`${index}-${group.map((column) => column.key).join('-')}`}
            >
              <ComparisonTableMarkup
                label={caption ? `${label}, ${caption.toLowerCase()}` : label}
                rows={rows}
                columns={group}
                caption={caption}
              />
            </div>
          )
        })}
      </div>
    </>
  )
}

function CreditTable({
  label,
  rows,
  showDeviation = true,
}: {
  label: string
  rows: CreditComparisonRow[]
  showDeviation?: boolean
}) {
  const columns: ComparisonColumn<CreditComparisonRow>[] = [
    {
      key: 'usage',
      label: 'Usage',
      render: (row) => (row.usage === null ? '—' : fmtCompact(row.usage)),
    },
  ]
  if (showDeviation) {
    columns.push({
      key: 'deviation',
      label: 'Std. deviation',
      render: (row) => (row.deviation === null ? '—' : fmtCompact(row.deviation)),
    })
  }

  return (
    <ComparisonTable label={label} rows={rows} columns={columns} />
  )
}

export function OrganizationComparisonSection({ data }: Props) {
  return (
    <section className="comparison-section" aria-labelledby="comparison-heading">
      <header className="comparison-section__heading">
        <h2 id="comparison-heading">Enterprise / organization comparisons</h2>
        <p>Each row is one exact enterprise and organization ID combination in the current filters.</p>
      </header>

      <ChartCard
        title="AI adoption by enterprise / organization"
        subtitle="Each user's highest phase in range. Rows prioritize Phase 4 share, then each lower cohort in order."
      >
        <ComparisonTable<AdoptionComparisonRow>
          label="AI adoption by enterprise and organization"
          rows={data.adoption}
          columns={ADOPTION_BUCKETS.map((bucket) => ({
            key: bucket,
            label: bucket,
            render: (row) => {
              const phase = row.phases[bucket]
              return `${fmtPercent(phase.percentage)} (${fmtNumber(phase.users)})`
            },
          }))}
        />
      </ChartCard>

      <div className="comparison-credit-cards">
        <ChartCard
          title="Total AI credits by group"
          subtitle="Total reported AI credits in each group."
        >
          <CreditTable
            label="Total AI credits by enterprise and organization"
            rows={data.credits.total}
            showDeviation={false}
          />
        </ChartCard>
        <ChartCard
          title="AI credits per user by group"
          subtitle="Mean and population standard deviation across reporting users' total credits within each group."
        >
          <CreditTable label="AI credits per user by enterprise and organization" rows={data.credits.perUser} />
        </ChartCard>
        <ChartCard
          title="Daily AI credits per user by group"
          subtitle="Mean and population standard deviation of each day's credits per active user within the group."
        >
          <CreditTable
            label="Daily AI credits per active user by enterprise and organization"
            rows={data.credits.dailyPerActiveUser}
          />
        </ChartCard>
      </div>

      <ChartCard
        title="Tool adoption by enterprise / organization"
        subtitle="Percentage of distinct users who used each tool at least once in range."
      >
        <ComparisonTable<ToolComparisonRow>
          label="Tool adoption by enterprise and organization"
          rows={data.tools}
          columns={TOOL_COLUMNS.map((column) => ({
            ...column,
            render: (row) => fmtPercent(row.usage[column.key]),
          }))}
        />
      </ChartCard>

      <ChartCard
        title="Extension and customization usage by enterprise / organization"
        subtitle="Mean interactions per distinct user; total interactions are shown in parentheses."
      >
        <ComparisonTable<CustomizationComparisonRow>
          label="Extension and customization usage by enterprise and organization"
          rows={data.customizations}
          columns={CUSTOMIZATION_COLUMNS.map((column) => ({
            ...column,
            render: (row) => {
              const value = row.usage[column.key]
              return `${fmtCompact(value.mean)} (${fmtNumber(value.total)})`
            },
          }))}
        />
      </ChartCard>

      <ChartCard
        title="Feature preference by enterprise / organization"
        subtitle="Share of each group's attributed feature interactions; the top seven features are selected across all displayed groups."
      >
        {data.featureColumns.length === 0 ? (
          <p className="empty">No attributed feature interactions in this range.</p>
        ) : (
          <ComparisonTable<FeaturePreferenceRow>
            label="Feature preference by enterprise and organization"
            rows={data.featurePreferences}
            columns={data.featureColumns.map((feature) => ({
              key: feature,
              label: feature,
              render: (row) => fmtPercent(row.shares[feature] ?? null),
            }))}
          />
        )}
      </ChartCard>

      <ChartCard
        title="Lines of code by enterprise / organization"
        subtitle="Sorted by combined added + deleted LoC per user, then combined total LoC."
      >
        <ComparisonTable<LocComparisonRow>
          label="Lines of code by enterprise and organization"
          rows={data.loc}
          columns={[
            {
              key: 'total',
              label: 'Added / deleted',
              render: (row) => `${fmtNumber(row.locAdded)} / ${fmtNumber(row.locDeleted)}`,
            },
            {
              key: 'per-user',
              label: 'Added / deleted per user',
              render: (row) => `${fmtCompact(row.locAddedPerUser)} / ${fmtCompact(row.locDeletedPerUser)}`,
            },
          ]}
        />
      </ChartCard>
    </section>
  )
}
