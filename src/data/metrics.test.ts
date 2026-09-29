import { describe, expect, it } from 'vitest'
import {
  adoptionPhaseByWeek,
  interactionsByFeatureCloud,
  interactionsByModelCloud,
  interactionsByModelPerWeek,
  locChangedByFeaturePerWeek,
  topBubbleCloud,
  usersBySurfaceCloud,
  usersBySurfaceCountCloud,
  usersBySurfacePerWeek,
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
