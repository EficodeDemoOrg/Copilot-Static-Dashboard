import { describe, expect, it } from 'vitest'
import { entityDisplayName } from './entityAliases'
import { organizationGroupLabel } from './organizationGroups'
import { mergeValidatedFiles, validateNdjsonText } from './parseNdjson'
import { SAMPLE_FILE_NAME, SAMPLE_NDJSON } from './sample'
import type { EntityAliases } from './types'

const usageRecord = (overrides: Record<string, unknown> = {}) => ({
  day: '2026-09-01',
  user_id: 101,
  enterprise_id: 'enterprise-1',
  ...overrides,
})

const ndjson = (...records: unknown[]) => records.map((record) => JSON.stringify(record)).join('\n')

describe('validateNdjsonText', () => {
  it('recognizes an enterprise-scoped file and lists its enterprise IDs', () => {
    const result = validateNdjsonText(
      ndjson(usageRecord(), usageRecord({ user_id: 102, enterprise_id: 'enterprise-2' })),
      'enterprise.ndjson',
    )

    expect(result.valid).toBe(true)
    expect(result.scope).toBe('enterprise')
    expect(result.recordCount).toBe(2)
    expect(result.enterpriseIds).toEqual(['enterprise-1', 'enterprise-2'])
    expect(result.organizationIds).toEqual([])
  })

  it('recognizes an organization-scoped file and lists all IDs', () => {
    const result = validateNdjsonText(
      ndjson(
        usageRecord({ organization_id: 'org-2' }),
        usageRecord({ user_id: 102, organization_id: 'org-1' }),
      ),
      'organization.ndjson',
    )

    expect(result.valid).toBe(true)
    expect(result.scope).toBe('organization')
    expect(result.enterpriseIds).toEqual(['enterprise-1'])
    expect(result.organizationIds).toEqual(['org-1', 'org-2'])
  })

  it('fails the whole file when one line is malformed JSON', () => {
    const result = validateNdjsonText(`${ndjson(usageRecord())}\n{"day":`, 'malformed.ndjson')

    expect(result.valid).toBe(false)
    expect(result.issues).toContain('Invalid JSON on line 2.')
  })

  it('rejects content that is not a usage metrics export', () => {
    const result = validateNdjsonText(ndjson({ hello: 'world' }), 'other.json')

    expect(result.valid).toBe(false)
    expect(result.issues.join(' ')).toContain('Unrecognised content')
  })

  it('requires an enterprise ID on every record', () => {
    const result = validateNdjsonText(ndjson(usageRecord({ enterprise_id: undefined })), 'missing.ndjson')

    expect(result.valid).toBe(false)
    expect(result.issues).toContain('Missing enterprise_id on line 1.')
  })

  it('rejects mixed organization-ID presence', () => {
    const result = validateNdjsonText(
      ndjson(
        usageRecord({ organization_id: 'org-1' }),
        usageRecord({ user_id: 102 }),
      ),
      'mixed.ndjson',
    )

    expect(result.valid).toBe(false)
    expect(result.scope).toBeUndefined()
    expect(result.issues.join(' ')).toContain('Mixed export scope')
  })

  it('rejects a present but empty organization ID', () => {
    const result = validateNdjsonText(
      ndjson(usageRecord({ organization_id: '   ' })),
      'empty-organization.ndjson',
    )

    expect(result.valid).toBe(false)
    expect(result.scope).toBeUndefined()
    expect(result.issues.join(' ')).toContain('Invalid organization_id')
  })

  it('checks every record rather than only the first sample', () => {
    const result = validateNdjsonText(
      ndjson(usageRecord(), usageRecord({ day: '2026-02-30', user_id: 102 })),
      'invalid-day.ndjson',
    )

    expect(result.valid).toBe(false)
    expect(result.issues.join(' ')).toContain('line 2')
  })

  it('keeps the bundled sample valid under the production rules', () => {
    const result = validateNdjsonText(SAMPLE_NDJSON, SAMPLE_FILE_NAME)

    expect(result.valid).toBe(true)
    expect(result.scope).toBe('organization')
    expect(result.recordCount).toBeGreaterThan(0)
  })
})

describe('mergeValidatedFiles', () => {
  it('uses valid files and ignores invalid files', () => {
    const valid = validateNdjsonText(ndjson(usageRecord()), 'valid.ndjson')
    const invalid = validateNdjsonText('not-json', 'invalid.ndjson')

    const dataset = mergeValidatedFiles([valid, invalid])

    expect(dataset.fileNames).toEqual(['valid.ndjson'])
    expect(dataset.records).toHaveLength(1)
  })

  it('de-duplicates matching group, user, and day records across files', () => {
    const first = validateNdjsonText(ndjson(usageRecord()), 'first.ndjson')
    const second = validateNdjsonText(ndjson(usageRecord()), 'second.ndjson')

    const dataset = mergeValidatedFiles([first, second])

    expect(dataset.records).toHaveLength(1)
    expect(dataset.warnings).toEqual([
      '1 duplicate record dropped (same enterprise, organization, user, and day seen more than once).',
    ])
  })

  it('trims aliases and leaves blank aliases as the original ID', () => {
    const result = validateNdjsonText(
      ndjson(usageRecord({ organization_id: 'org-1' })),
      'organization.ndjson',
    )
    const aliases: EntityAliases = {
      enterprises: new Map([['enterprise-1', '  Acme  ']]),
      organizations: new Map([['org-1', '   ']]),
    }

    const dataset = mergeValidatedFiles([result], aliases)

    expect(entityDisplayName('enterprise', 'enterprise-1', dataset.aliases)).toBe('Acme')
    expect(entityDisplayName('organization', 'org-1', dataset.aliases)).toBe('org-1')
    expect(organizationGroupLabel('enterprise-1', 'org-1', dataset.aliases)).toBe(
      'Enterprise Acme / Organization org-1',
    )
  })
})
