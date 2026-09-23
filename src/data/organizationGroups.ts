import type { UserDay } from './types'

export interface OrganizationGroup {
  key: string
  label: string
  enterpriseId?: string
  organizationId?: string
}

export function organizationGroupKey(enterpriseId?: string, organizationId?: string): string {
  return JSON.stringify([enterpriseId ?? null, organizationId ?? null])
}

export function organizationGroupLabel(enterpriseId?: string, organizationId?: string): string {
  const enterprise = enterpriseId ? `Enterprise ${enterpriseId}` : 'No enterprise'
  const organization = organizationId ? `Organization ${organizationId}` : 'No organization'
  return `${enterprise} / ${organization}`
}

export function organizationGroupFor(record: UserDay): OrganizationGroup {
  return {
    key: organizationGroupKey(record.enterpriseId, record.organizationId),
    label: organizationGroupLabel(record.enterpriseId, record.organizationId),
    enterpriseId: record.enterpriseId,
    organizationId: record.organizationId,
  }
}

export function distinctOrganizationGroups(records: UserDay[]): OrganizationGroup[] {
  const groups = new Map<string, OrganizationGroup>()
  for (const record of records) {
    const group = organizationGroupFor(record)
    groups.set(group.key, group)
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label))
}
