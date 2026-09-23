import type { Adapter, CustomizationTotal, FeatureTotal, ReportWindow, UserDay } from '../types'

/**
 * GitHub's Copilot usage metrics NDJSON export. One JSON object per line,
 * one object per user per day.
 *
 * Every field is read defensively. The export's schema is visibly still growing:
 * in a 790-record sample, `used_cli` and friends appeared on 469 records,
 * `totals_by_skill` and friends on 719, `totals_by_cli` on 122, and
 * `totals_by_3rd_party_agent` on exactly one. Nested element shapes drift too.
 * Treating anything as guaranteed is how this breaks on the next export.
 */

type Json = Record<string, unknown>

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Missing, null, or non-finite all collapse to 0 — never NaN into a chart. */
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : 0
}

const str = (v: unknown): string | undefined => {
  if (typeof v === 'string' && v.trim() !== '') return v.trim()
  if (typeof v === 'number') return String(v)
  return undefined
}

/** `day` is a bare YYYY-MM-DD, but tolerate a full ISO timestamp. */
const day = (v: unknown): string | undefined => {
  const s = typeof v === 'string' ? v.trim() : ''
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(s)
  if (!m) return undefined

  const year = Number(m[1])
  const month = Number(m[2])
  const date = Number(m[3])
  const parsed = new Date(Date.UTC(year, month - 1, date))
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== date
  ) {
    return undefined
  }
  return `${m[1]}-${m[2]}-${m[3]}`
}

/**
 * A numeric, finite `user_id` — the only stable identity this app will ever
 * use. Never falls back to 0: a missing or malformed id must make the record
 * unusable (see the `uid === undefined` check in `toUserDay`), not collapse
 * distinct users into a fake shared identity.
 */
const userId = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? n : undefined
}

/** Only the literal `true` counts as used; anything else — missing, null, malformed — is "not used". */
const bool = (v: unknown): boolean => v === true

/** Missing or non-finite collapses to `undefined`, never `NaN`, for optional numeric fields. */
const numOrUndefined = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : undefined
}

/**
 * `totals_by_feature` / `totals_by_model_feature` / `totals_by_language_feature`
 * entries share this shape upstream, differing only in which field carries the
 * name (`feature`, `model`, or `language`). A malformed element — not an
 * object, or missing its name — is dropped rather than invalidating the array.
 */
function toFeatureTotal(nameField: string) {
  return (v: unknown): FeatureTotal | undefined => {
    if (!isObject(v)) return undefined
    const name = str(v[nameField])
    if (!name) return undefined
    return {
      name,
      interactions: num(v['user_initiated_interaction_count']),
      generations: num(v['code_generation_activity_count']),
      acceptances: num(v['code_acceptance_activity_count']),
      locAdded: num(v['loc_added_sum']),
      locDeleted: num(v['loc_deleted_sum']),
    }
  }
}

/**
 * `totals_by_custom_agent` / `totals_by_mcp` / `totals_by_skill` /
 * `totals_by_plugin` / `totals_by_slash_cmd` entries only ever carry a name and
 * an `interaction_count` upstream.
 */
function toCustomizationTotal(nameField: string) {
  return (v: unknown): CustomizationTotal | undefined => {
    if (!isObject(v)) return undefined
    const name = str(v[nameField])
    if (!name) return undefined
    return { name, interactionCount: num(v['interaction_count']) }
  }
}

/** A missing array degrades to empty; malformed elements are dropped individually. */
function mapArray<T>(v: unknown, mapper: (item: unknown) => T | undefined): T[] {
  if (!Array.isArray(v)) return []
  const out: T[] = []
  for (const item of v) {
    const mapped = mapper(item)
    if (mapped) out.push(mapped)
  }
  return out
}

export const usageMetricsAdapter: Adapter = {
  id: 'github-copilot-usage-metrics',
  label: 'GitHub Copilot usage metrics export',
  requiredFields: ['day', 'user_id'],

  matches(sample) {
    if (!isObject(sample)) return false
    // Presence only — never reads the login value itself into anything downstream.
    return day(sample['day']) !== undefined && userId(sample['user_id']) !== undefined
  },

  toUserDay(record) {
    if (!isObject(record)) return undefined

    const d = day(record['day'])
    const uid = userId(record['user_id'])
    // Without a day and a stable user id the record cannot be placed on any chart
    // or de-duplicated safely.
    if (!d || uid === undefined) return undefined

    const phase = record['ai_adoption_phase']
    const aiCredits = numOrUndefined(record['ai_credits_used'])

    return {
      day: d,
      userId: uid,
      organizationId: str(record['organization_id']),
      enterpriseId: str(record['enterprise_id']),
      interactions: num(record['user_initiated_interaction_count']),
      generations: num(record['code_generation_activity_count']),
      acceptances: num(record['code_acceptance_activity_count']),
      locSuggestedToAdd: num(record['loc_suggested_to_add_sum']),
      locSuggestedToDelete: num(record['loc_suggested_to_delete_sum']),
      locAdded: num(record['loc_added_sum']),
      locDeleted: num(record['loc_deleted_sum']),
      aiCredits: aiCredits ?? 0,
      aiCreditsReported: aiCredits !== undefined,
      adoptionPhase: isObject(phase) ? str(phase['phase']) : undefined,
      adoptionPhaseNumber: isObject(phase) ? numOrUndefined(phase['phase_number']) : undefined,
      usedAgent: bool(record['used_agent']),
      usedChat: bool(record['used_chat']),
      usedCli: bool(record['used_cli']),
      usedVscodeAgent: bool(record['used_vscode_agent']),
      usedCopilotApp: bool(record['used_copilot_app']),
      usedCopilotCodeReviewActive: bool(record['used_copilot_code_review_active']),
      usedCopilotCodeReviewPassive: bool(record['used_copilot_code_review_passive']),
      usedCopilotCodingAgent: bool(record['used_copilot_coding_agent']),
      usedCopilotCloudAgent: bool(record['used_copilot_cloud_agent']),
      totalsByFeature: mapArray(record['totals_by_feature'], toFeatureTotal('feature')),
      totalsByModelFeature: mapArray(record['totals_by_model_feature'], toFeatureTotal('model')),
      totalsByLanguageFeature: mapArray(record['totals_by_language_feature'], toFeatureTotal('language')),
      totalsByCustomAgent: mapArray(record['totals_by_custom_agent'], toCustomizationTotal('custom_agent')),
      totalsByMcp: mapArray(record['totals_by_mcp'], toCustomizationTotal('mcp')),
      totalsBySkill: mapArray(record['totals_by_skill'], toCustomizationTotal('skill')),
      totalsByPlugin: mapArray(record['totals_by_plugin'], toCustomizationTotal('plugin')),
      totalsBySlashCmd: mapArray(record['totals_by_slash_cmd'], toCustomizationTotal('slash_cmd')),
    }
  },

  reportWindow(record): ReportWindow | undefined {
    if (!isObject(record)) return undefined
    const start = day(record['report_start_day'])
    const end = day(record['report_end_day'])
    return start && end ? { start, end } : undefined
  },
}

export type { UserDay }
