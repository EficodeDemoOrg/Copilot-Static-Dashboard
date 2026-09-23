import { describe, expect, it } from 'vitest'
import {
  interactionsByFeatureCloud,
  interactionsByModelCloud,
  topBubbleCloud,
  usersBySurfaceCloud,
  usersBySurfaceCountCloud,
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
