import { describe, expect, it } from 'vitest'
import { applyFilters } from './metrics'
import {
  distinctOrganizationGroups,
  organizationGroupKey,
  organizationGroupLabel,
  partitionRecordsByOrganizationGroup,
} from './organizationGroups'
import { validateNdjsonText } from './parseNdjson'
import type { UserDay } from './types'

const ndjson = (...records: unknown[]) => records.map((record) => JSON.stringify(record)).join('\n')

function recordsFrom(fileName: string, ...records: unknown[]): UserDay[] {
  const result = validateNdjsonText(ndjson(...records), fileName)
  expect(result.valid).toBe(true)
  return result.records
}

describe('organization group report data', () => {
  it('uses concise labels for enterprise and organization scopes', () => {
    expect(organizationGroupLabel('4411')).toBe('Enterprise: 4411')
    expect(organizationGroupLabel('4411', '262558645')).toBe(
      'Organization: 4411/262558645',
    )
    expect(organizationGroupLabel(undefined, '262558645')).toBe('Organization: 262558645')
    expect(organizationGroupLabel()).toBe('No enterprise or organization')
  })

  it('applies inclusive date filters without filtering enterprise/organization groups', () => {
    const records = recordsFrom(
      'organization.ndjson',
      {
        day: '2026-09-01',
        user_id: 101,
        enterprise_id: 'enterprise-1',
        organization_id: 'org-1',
      },
      {
        day: '2026-09-02',
        user_id: 102,
        enterprise_id: 'enterprise-1',
        organization_id: 'org-2',
      },
      {
        day: '2026-09-03',
        user_id: 103,
        enterprise_id: 'enterprise-1',
        organization_id: 'org-1',
      },
    )

    expect(applyFilters(records, { start: '2026-09-02', end: '2026-09-02' })).toEqual([
      records[1],
    ])
  })

  it('keeps the complete group list when the selected dates leave groups empty', () => {
    const organizationRecords = recordsFrom(
      'organization.ndjson',
      {
        day: '2026-09-01',
        user_id: 101,
        enterprise_id: 'enterprise-1',
        organization_id: 'org-1',
      },
      {
        day: '2026-09-03',
        user_id: 102,
        enterprise_id: 'enterprise-1',
        organization_id: 'org-1',
      },
    )
    const enterpriseRecords = recordsFrom(
      'enterprise.ndjson',
      {
        day: '2026-09-01',
        user_id: 201,
        enterprise_id: 'enterprise-2',
      },
    )
    const allRecords = [...organizationRecords, ...enterpriseRecords]
    const allGroups = distinctOrganizationGroups(allRecords)
    const filtered = applyFilters(allRecords, { start: '2026-09-03', end: '2026-09-03' })
    const partitioned = partitionRecordsByOrganizationGroup(filtered)

    expect(allGroups).toHaveLength(2)
    expect(allGroups.map((group) => group.key)).toContain(
      organizationGroupKey('enterprise-2', undefined),
    )
    expect(partitioned.get(organizationGroupKey('enterprise-1', 'org-1'))).toEqual([
      organizationRecords[1],
    ])
    expect(partitioned.has(organizationGroupKey('enterprise-2', undefined))).toBe(false)
  })
})
