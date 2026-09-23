import { entityDisplayName } from './entityAliases'
import type { EntityAliases, UserDay } from './types'

export interface OrganizationGroup {
  key: string
  label: string
  enterpriseId?: string
  organizationId?: string
}

export function organizationGroupKey(enterpriseId?: string, organizationId?: string): string {
  return JSON.stringify([enterpriseId ?? null, organizationId ?? null])
}

export function organizationGroupLabel(
  enterpriseId?: string,
  organizationId?: string,
  aliases?: EntityAliases,
): string {
  const enterprise = enterpriseId
    ? `Enterprise ${entityDisplayName('enterprise', enterpriseId, aliases)}`
    : 'No enterprise'
  const organization = organizationId
    ? `Organization ${entityDisplayName('organization', organizationId, aliases)}`
    : 'No organization'
  return `${enterprise} / ${organization}`
}

export function organizationGroupFor(record: UserDay, aliases?: EntityAliases): OrganizationGroup {
  return {
    key: organizationGroupKey(record.enterpriseId, record.organizationId),
    label: organizationGroupLabel(record.enterpriseId, record.organizationId, aliases),
    enterpriseId: record.enterpriseId,
    organizationId: record.organizationId,
  }
}

export function distinctOrganizationGroups(
  records: UserDay[],
  aliases?: EntityAliases,
): OrganizationGroup[] {
  const groups = new Map<string, OrganizationGroup>()
  for (const record of records) {
    const group = organizationGroupFor(record, aliases)
    groups.set(group.key, group)
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label))
}

export function partitionRecordsByOrganizationGroup(
  records: UserDay[],
): ReadonlyMap<string, UserDay[]> {
  const groups = new Map<string, UserDay[]>()
  for (const record of records) {
    const key = organizationGroupKey(record.enterpriseId, record.organizationId)
    const group = groups.get(key)
    if (group) group.push(record)
    else groups.set(key, [record])
  }
  return groups
}
