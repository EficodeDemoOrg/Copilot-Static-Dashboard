import type { EntityAliases } from './types'

export function emptyEntityAliases(): EntityAliases {
  return {
    enterprises: new Map(),
    organizations: new Map(),
  }
}

function normalizeMap(
  source: ReadonlyMap<string, string>,
  allowedIds?: ReadonlySet<string>,
): ReadonlyMap<string, string> {
  const normalized = new Map<string, string>()
  for (const [id, value] of source) {
    if (allowedIds && !allowedIds.has(id)) continue
    const alias = value.trim()
    if (alias !== '') normalized.set(id, alias)
  }
  return normalized
}

export function normalizeEntityAliases(
  aliases: EntityAliases,
  enterpriseIds?: ReadonlySet<string>,
  organizationIds?: ReadonlySet<string>,
): EntityAliases {
  return {
    enterprises: normalizeMap(aliases.enterprises, enterpriseIds),
    organizations: normalizeMap(aliases.organizations, organizationIds),
  }
}

export function entityDisplayName(
  type: 'enterprise' | 'organization',
  id: string,
  aliases?: EntityAliases,
): string {
  const alias =
    type === 'enterprise' ? aliases?.enterprises.get(id) : aliases?.organizations.get(id)
  return alias?.trim() || id
}
