import { describe, expect, it } from 'vitest'
import {
  adoptionPhaseByWeek,
  anonymousUserCreditsPerUser,
  correlationStrength,
  creditCycleRanges,
  filterUserCreditOutliers,
  interactionsByFeatureCloud,
  interactionsByModelCloud,
  interactionsByModelPerWeek,
  locChangedByFeaturePerWeek,
  numbersTableMetrics,
  topBubbleCloud,
  usersBySurfaceCloud,
  usersBySurfaceCountCloud,
  usersBySurfacePerWeek,
  userCreditCorrelation,
  userCreditTrendSegment,
  weeklyDateRanges,
  type WeeklyStackedData,
} from './metrics'
import { validateNdjsonText } from './parseNdjson'
import type { UserDay } from './types'

const ndjson = (...records: unknown[]) => records.map((record) => JSON.stringify(record)).join('\n')

function recordsFrom(...records: Record<string, unknown>[]): UserDay[] {
  const result = validateNdjsonText(
    ndjson(
      ...records.map((record, index) => ({
        day: '2026-09-01',
        user_id: index + 1,
        enterprise_id: 'enterprise-1',
        organization_id: 'org-1',
        ...record,
      })),
    ),
    'metrics.ndjson',
  )
  expect(result.valid).toBe(true)
  return result.records
}

function weeklyValue(data: WeeklyStackedData, pointIndex: number, label: string): number {
  const series = data.series.find((candidate) => candidate.label === label)
  expect(series, `Missing weekly series ${label}`).toBeDefined()
  return data.points[pointIndex]?.values[series!.key] ?? 0
}

describe('interaction bubble clouds', () => {
  it('keeps every observed feature and aggregates the filtered range', () => {
    const features = Array.from({ length: 9 }, (_, index) => ({
      feature: `feature-${index + 1}`,
      user_initiated_interaction_count: index + 1,
    }))
    const records = recordsFrom(
      { totals_by_feature: features },
      {
        day: '2026-09-03',
        totals_by_feature: [
          { feature: 'feature-1', user_initiated_interaction_count: 20 },
        ],
      },
    )

    const cloud = interactionsByFeatureCloud(records)

    expect(cloud).toHaveLength(9)
    expect(cloud.map((item) => item.key)).not.toContain('Other')
    expect(cloud[0]).toEqual({
      key: 'feature-1',
      label: 'feature-1',
      value: 21,
    })
  })

  it('uses model interaction counts rather than Lines of Code fields', () => {
    const records = recordsFrom({
      totals_by_model_feature: [
        {
          model: 'many-lines',
          user_initiated_interaction_count: 2,
          loc_added_sum: 10000,
          loc_deleted_sum: 5000,
        },
        {
          model: 'many-interactions',
          user_initiated_interaction_count: 7,
          loc_added_sum: 1,
        },
      ],
    })

    const cloud = interactionsByModelCloud(records)

    expect(cloud.map((item) => item.key)).toEqual([
      'many-interactions',
      'many-lines',
    ])
    expect(cloud.map((item) => item.value)).toEqual([7, 2])
  })

  it('keeps the top seven bubbles and folds every remaining value into Others', () => {
    const cloud = Array.from({ length: 10 }, (_, index) => ({
      key: `item-${index + 1}`,
      label: `Item ${index + 1}`,
      value: 10 - index,
    }))

    expect(topBubbleCloud(cloud)).toEqual([
      ...cloud.slice(0, 7),
      { key: '__others__', label: 'Others', value: 6 },
    ])
  })
})

describe('surface bubble clouds', () => {
  const records = recordsFrom(
    { user_id: 10, organization_id: 'org-1', used_agent: true },
    { user_id: 10, organization_id: 'org-2', used_chat: true },
    {
      user_id: 20,
      organization_id: 'org-1',
      used_copilot_cloud_agent: true,
      used_copilot_coding_agent: true,
    },
    { user_id: 30, organization_id: 'org-1' },
    {
      day: '2026-09-02',
      user_id: 10,
      organization_id: 'org-1',
      used_agent: true,
      used_chat: true,
      used_cli: true,
    },
  )
  it('counts distinct users across all eight logical surfaces and collapses cloud aliases', () => {
    const cloud = usersBySurfaceCloud(records)
    const bubble = (key: string) => cloud.find((candidate) => candidate.key === key)

    expect(cloud).toHaveLength(8)
    expect(bubble('agent')?.value).toBe(1)
    expect(bubble('chat')?.value).toBe(1)
    expect(bubble('cli')?.value).toBe(1)
    expect(bubble('cloudAgent')?.value).toBe(1)
  })

  it('unions each user across records and dates before assigning one surface-count bucket', () => {
    const cloud = usersBySurfaceCountCloud(records)
    const bubble = (count: number) =>
      cloud.find((candidate) => candidate.key === String(count))

    expect(cloud).toHaveLength(8)
    expect(bubble(1)?.value).toBe(1)
    expect(bubble(2)?.value).toBe(0)
    expect(bubble(3)?.value).toBe(1)
    expect(cloud.reduce((sum, candidate) => sum + candidate.value, 0)).toBe(2)
  })
})

describe('user activity versus AI credits', () => {
  it('returns anonymous request and code-change totals with credit coverage', () => {
    const records = recordsFrom(
      {
        day: '2026-09-01',
        user_id: 10,
        user_initiated_interaction_count: 3,
        loc_added_sum: 10,
        loc_deleted_sum: 2,
        ai_credits_used: 5,
      },
      {
        day: '2026-09-02',
        user_id: 10,
        user_initiated_interaction_count: 4,
        loc_added_sum: 3,
        loc_deleted_sum: 4,
      },
      {
        user_id: 20,
        user_initiated_interaction_count: 9,
        loc_added_sum: 100,
        loc_deleted_sum: 50,
      },
      {
        user_id: 30,
        user_initiated_interaction_count: 2,
        loc_added_sum: 1,
        loc_deleted_sum: 2,
        ai_credits_used: 0,
      },
    )

    const points = anonymousUserCreditsPerUser(records)

    expect(points).toEqual([
      {
        index: 0,
        requests: 7,
        codeChanges: 19,
        credits: 5,
        reportedCreditRecords: 1,
        totalRecords: 2,
      },
      {
        index: 1,
        requests: 2,
        codeChanges: 3,
        credits: 0,
        reportedCreditRecords: 1,
        totalRecords: 1,
      },
    ])
    expect(points.every((point) => !('userId' in point))).toBe(true)
  })

  it('excludes points outside the 1.5×IQR fence on either scatter axis', () => {
    const point = (
      index: number,
      credits: number,
      codeChanges: number,
    ) => ({
      index,
      credits,
      codeChanges,
      requests: index + 1,
      reportedCreditRecords: 1,
      totalRecords: 1,
    })
    const points = [
      point(0, 10, 100),
      point(1, 11, 110),
      point(2, 12, 120),
      point(3, 13, 130),
      point(4, 14, 140),
      point(5, 15, 150),
      point(6, 1000, 160),
      point(7, 16, 10000),
    ]

    expect(filterUserCreditOutliers(points, 'codeChanges')).toEqual({
      points: points.slice(0, 6),
      excludedCount: 2,
    })
  })

  it('does not classify outliers in groups smaller than four users', () => {
    const points = [
      {
        index: 0,
        credits: 1,
        codeChanges: 1,
        requests: 1,
        reportedCreditRecords: 1,
        totalRecords: 1,
      },
      {
        index: 1,
        credits: 1000,
        codeChanges: 1000,
        requests: 1000,
        reportedCreditRecords: 1,
        totalRecords: 1,
      },
    ]

    expect(filterUserCreditOutliers(points, 'codeChanges')).toEqual({
      points,
      excludedCount: 0,
    })
  })

  it('calculates a least-squares trend segment across the displayed credit range', () => {
    const points = [1, 2, 3].map((credits, index) => ({
      index,
      credits,
      requests: credits * 2 + 1,
      codeChanges: credits * 10 + 5,
      reportedCreditRecords: 1,
      totalRecords: 1,
    }))

    expect(userCreditTrendSegment(points, 'codeChanges')).toEqual([
      { x: 1, y: 15 },
      { x: 3, y: 35 },
    ])
  })

  it('omits the trend when reported credits have no variation', () => {
    const points = [10, 20].map((codeChanges, index) => ({
      index,
      credits: 5,
      requests: index + 1,
      codeChanges,
      reportedCreditRecords: 1,
      totalRecords: 1,
    }))

    expect(userCreditTrendSegment(points, 'codeChanges')).toBeUndefined()
  })

  it('clips the trend to the observed activity range', () => {
    const points = [
      { credits: 1, codeChanges: 100 },
      { credits: 2, codeChanges: 100 },
      { credits: 3, codeChanges: 1000 },
    ].map((point, index) => ({
      index,
      ...point,
      requests: index + 1,
      reportedCreditRecords: 1,
      totalRecords: 1,
    }))

    const trend = userCreditTrendSegment(points, 'codeChanges')

    expect(trend?.[0].y).toBeCloseTo(100)
    expect(trend?.[1]).toEqual({ x: 3, y: 850 })
  })

  it('classifies correlation strength by absolute Pearson coefficient', () => {
    expect(correlationStrength(0.19)).toBe('very weak')
    expect(correlationStrength(-0.2)).toBe('weak')
    expect(correlationStrength(0.4)).toBe('moderate')
    expect(correlationStrength(-0.6)).toBe('strong')
    expect(correlationStrength(0.8)).toBe('very strong')
  })

  it('reports correlation strength and direction for displayed users', () => {
    const points = [1, 2, 3, 4].map((credits, index) => ({
      index,
      credits,
      requests: 10 - credits * 2,
      codeChanges: credits * 10,
      reportedCreditRecords: 1,
      totalRecords: 1,
    }))

    expect(userCreditCorrelation(points, 'codeChanges')).toEqual({
      coefficient: 1,
      direction: 'positive',
      strength: 'very strong',
    })
    expect(userCreditCorrelation(points, 'requests')).toEqual({
      coefficient: -1,
      direction: 'negative',
      strength: 'very strong',
    })
  })

  it('uses the displayed coefficient for threshold classification', () => {
    const activity = [0, 0, 1, 20]
    const points = [1, 2, 3, 4].map((credits, index) => ({
      index,
      credits,
      requests: index + 1,
      codeChanges: activity[index]!,
      reportedCreditRecords: 1,
      totalRecords: 1,
    }))

    expect(userCreditCorrelation(points, 'codeChanges')).toEqual({
      coefficient: 0.8,
      direction: 'positive',
      strength: 'very strong',
    })
  })

  it('omits correlation without enough users or variation on both axes', () => {
    const points = [1, 2, 3].map((codeChanges, index) => ({
      index,
      credits: 5,
      requests: index + 1,
      codeChanges,
      reportedCreditRecords: 1,
      totalRecords: 1,
    }))

    expect(userCreditCorrelation(points, 'codeChanges')).toBeUndefined()
    expect(userCreditCorrelation(points.slice(0, 2), 'codeChanges')).toBeUndefined()
  })
})

describe('weekly date ranges', () => {
  it('uses Monday-Sunday buckets and clips the first and last intervals', () => {
    expect(weeklyDateRanges({ start: '2026-09-02', end: '2026-09-15' })).toEqual([
      { start: '2026-09-02', end: '2026-09-06' },
      { start: '2026-09-07', end: '2026-09-13' },
      { start: '2026-09-14', end: '2026-09-15' },
    ])
  })
})

describe('weekly stacked aggregations', () => {
  it('keeps the top seven models stable, folds the tail, and fills empty weeks', () => {
    const models = Array.from({ length: 9 }, (_, index) => ({
      model: `model-${index + 1}`,
      user_initiated_interaction_count: 10 - index,
    }))
    const records = recordsFrom({
      day: '2026-09-02',
      totals_by_model_feature: models,
    })

    const data = interactionsByModelPerWeek(records, {
      start: '2026-09-02',
      end: '2026-09-15',
    })

    expect(data.series.map((series) => series.label)).toEqual([
      'model-1',
      'model-2',
      'model-3',
      'model-4',
      'model-5',
      'model-6',
      'model-7',
      'Other',
    ])
    expect(weeklyValue(data, 0, 'model-1')).toBe(10)
    expect(weeklyValue(data, 0, 'Other')).toBe(5)
    expect(weeklyValue(data, 1, 'model-1')).toBe(0)
    expect(weeklyValue(data, 2, 'Other')).toBe(0)
  })

  it('counts distinct users independently for all eight surfaces each week', () => {
    const records = recordsFrom(
      { day: '2026-09-01', user_id: 10, used_agent: true },
      { day: '2026-09-02', user_id: 10, used_agent: true, used_chat: true },
      { day: '2026-09-03', user_id: 20, used_agent: true },
      {
        day: '2026-09-04',
        user_id: 20,
        used_copilot_cloud_agent: true,
        used_copilot_coding_agent: true,
      },
      { day: '2026-09-08', user_id: 10, used_chat: true },
    )

    const data = usersBySurfacePerWeek(records, {
      start: '2026-09-01',
      end: '2026-09-13',
    })

    expect(data.series).toHaveLength(8)
    expect(weeklyValue(data, 0, 'Agent')).toBe(2)
    expect(weeklyValue(data, 0, 'Chat')).toBe(1)
    expect(weeklyValue(data, 0, 'Copilot Cloud / Coding Agent')).toBe(1)
    expect(weeklyValue(data, 1, 'Chat')).toBe(1)
  })

  it('assigns each user to their highest phase in each week and preserves Unknown', () => {
    const records = recordsFrom(
      {
        day: '2026-09-01',
        user_id: 10,
        ai_adoption_phase: { phase: 'Phase 1', phase_number: 1 },
      },
      {
        day: '2026-09-03',
        user_id: 10,
        ai_adoption_phase: { phase: 'Phase 3', phase_number: 3 },
      },
      { day: '2026-09-04', user_id: 20 },
      {
        day: '2026-09-08',
        user_id: 10,
        ai_adoption_phase: { phase: 'Phase 2', phase_number: 2 },
      },
    )

    const data = adoptionPhaseByWeek(records, {
      start: '2026-09-01',
      end: '2026-09-13',
    })

    expect(data.series.map((series) => series.label)).toEqual(['Phase 2', 'Phase 3', 'Unknown'])
    expect(weeklyValue(data, 0, 'Phase 3')).toBe(1)
    expect(weeklyValue(data, 0, 'Phase 2')).toBe(0)
    expect(weeklyValue(data, 0, 'Unknown')).toBe(1)
    expect(weeklyValue(data, 1, 'Phase 2')).toBe(1)
  })

  it('combines added and deleted LoC and folds features below the top seven', () => {
    const features = Array.from({ length: 8 }, (_, index) => ({
      feature: `feature-${index + 1}`,
      loc_added_sum: 10 - index,
      loc_deleted_sum: 1,
    }))
    const records = recordsFrom({
      day: '2026-09-02',
      totals_by_feature: features,
    })

    const data = locChangedByFeaturePerWeek(records, {
      start: '2026-09-02',
      end: '2026-09-13',
    })

    expect(data.series.map((series) => series.label)).toEqual([
      'feature-1',
      'feature-2',
      'feature-3',
      'feature-4',
      'feature-5',
      'feature-6',
      'feature-7',
      'Other',
    ])
    expect(weeklyValue(data, 0, 'feature-1')).toBe(11)
    expect(weeklyValue(data, 0, 'Other')).toBe(4)
    expect(weeklyValue(data, 1, 'feature-1')).toBe(0)
  })
})

describe('numbers and tables metrics', () => {
  it('includes every configured spending cap scenario in ascending order', () => {
    const metrics = numbersTableMetrics(
      [],
      { start: '2026-09-01', end: '2026-09-28' },
      1_900,
    )

    expect(metrics.spendingCaps.map(({ capUsd }) => capUsd)).toEqual([
      10,
      50,
      100,
      200,
      300,
      400,
      500,
      600,
      700,
      800,
      1_000,
    ])
  })

  it('anchors consecutive 28-day cycles to the selected start and clips the trailing cycle', () => {
    expect(creditCycleRanges({ start: '2026-09-20', end: '2026-10-10' })).toEqual([
      { index: 0, start: '2026-09-20', end: '2026-10-10' },
    ])
    expect(creditCycleRanges({ start: '2026-09-15', end: '2026-11-12' })).toEqual([
      { index: 0, start: '2026-09-15', end: '2026-10-12' },
      { index: 1, start: '2026-10-13', end: '2026-11-09' },
      { index: 2, start: '2026-11-10', end: '2026-11-12' },
    ])
  })

  it('counts inactive users and requires every observed cycle to stay strictly below the allowance', () => {
    const records = recordsFrom(
      {
        day: '2026-09-01',
        user_id: 10,
        user_initiated_interaction_count: 1,
        ai_credits_used: 1_899,
      },
      {
        day: '2026-09-02',
        user_id: 20,
        code_generation_activity_count: 1,
        ai_credits_used: 1_900,
      },
      { day: '2026-09-03', user_id: 30, ai_credits_used: 0 },
      { day: '2026-09-29', user_id: 10, ai_credits_used: 1_901 },
      { day: '2026-09-29', user_id: 30, ai_credits_used: 100 },
    )

    const metrics = numbersTableMetrics(
      records,
      { start: '2026-09-01', end: '2026-10-26' },
      1_900,
    )

    expect(metrics.totalUsers).toBe(3)
    expect(metrics.inactiveUsers).toBe(1)
    expect(metrics.inactivePercentage).toBeCloseTo(100 / 3)
    expect(metrics.belowAllowanceUsers).toBe(1)
    expect(metrics.belowAllowancePercentage).toBeCloseTo(100 / 3)
  })

  it('resets caps each cycle, counts distinct capped users, and sums savings across cycles', () => {
    const records = recordsFrom(
      { day: '2026-09-01', user_id: 10, ai_credits_used: 3_200 },
      { day: '2026-09-29', user_id: 10, ai_credits_used: 2_600 },
      { day: '2026-09-02', user_id: 20, ai_credits_used: 2_900 },
      { day: '2026-09-30', user_id: 20, ai_credits_used: 3_500 },
      { day: '2026-09-03', user_id: 30, ai_credits_used: 2_400 },
      { day: '2026-10-01', user_id: 30, ai_credits_used: 2_500 },
    )

    const metrics = numbersTableMetrics(
      records,
      { start: '2026-09-01', end: '2026-10-26' },
      1_900,
      [10, 20],
    )

    expect(metrics.spendingCaps[0]).toMatchObject({
      capUsd: 10,
      capCredits: 1_000,
      cappedUsers: 2,
      organizationSavingsUsd: 9,
      savingsPerCappedEmployeeUsd: 4.5,
    })
    expect(metrics.spendingCaps[0]?.organizationSavingsPercentage).toBeCloseTo(
      (900 / 5_700) * 100,
    )
    expect(metrics.spendingCaps[1]).toMatchObject({
      capUsd: 20,
      capCredits: 2_000,
      cappedUsers: 0,
      organizationSavingsUsd: 0,
      organizationSavingsPercentage: 0,
      savingsPerCappedEmployeeUsd: null,
    })
  })

  it('does not prorate the cap for a trailing partial cycle', () => {
    const records = recordsFrom(
      { day: '2026-09-29', user_id: 10, ai_credits_used: 2_800 },
    )

    const metrics = numbersTableMetrics(
      records,
      { start: '2026-09-01', end: '2026-09-29' },
      1_900,
      [10],
    )

    expect(metrics.cycles).toHaveLength(2)
    expect(metrics.spendingCaps[0]?.cappedUsers).toBe(0)
    expect(metrics.spendingCaps[0]?.organizationSavingsUsd).toBe(0)
  })

  it('uses only capped users and credits above the allowance for median reach time', () => {
    const records = recordsFrom(
      { day: '2026-09-07', user_id: 10, ai_credits_used: 600 },
      { day: '2026-09-12', user_id: 10, ai_credits_used: 1_000 },
      { day: '2026-09-08', user_id: 20, ai_credits_used: 350 },
      { day: '2026-09-09', user_id: 30, ai_credits_used: 150 },
    )

    const metrics = numbersTableMetrics(
      records,
      { start: '2026-09-07', end: '2026-09-13' },
      100,
      [1],
    )

    expect(metrics.spendingCaps[0]).toMatchObject({
      capUsd: 1,
      capCredits: 100,
      cappedUsers: 2,
      medianWeekdaysToCap: 1.5,
    })
  })

  it('returns null percentages and reach estimates when there is no usable population', () => {
    const metrics = numbersTableMetrics(
      [],
      { start: '2026-09-12', end: '2026-09-13' },
      1_900,
      [10],
    )

    expect(metrics.totalUsers).toBe(0)
    expect(metrics.inactivePercentage).toBeNull()
    expect(metrics.belowAllowancePercentage).toBeNull()
    expect(metrics.spendingCaps[0]?.organizationSavingsPercentage).toBeNull()
    expect(metrics.spendingCaps[0]?.medianWeekdaysToCap).toBeNull()
  })
})
