import type { Adapter, ReportWindow, UserDay } from '../types'

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
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s)
  return m ? m[1] : undefined
}

export const usageMetricsAdapter: Adapter = {
  id: 'github-copilot-usage-metrics',
  label: 'GitHub Copilot usage metrics export',
  requiredFields: ['day', 'user_login'],

  matches(sample) {
    if (!isObject(sample)) return false
    return day(sample['day']) !== undefined && str(sample['user_login']) !== undefined
  },

  toUserDay(record) {
    if (!isObject(record)) return undefined

    const d = day(record['day'])
    const user = str(record['user_login'])
    // Without a day and an actor the record cannot be placed on any chart.
    if (!d || !user) return undefined

    const phase = record['ai_adoption_phase']

    return {
      day: d,
      user,
      userId: num(record['user_id']),
      organizationId: str(record['organization_id']),
      enterpriseId: str(record['enterprise_id']),
      interactions: num(record['user_initiated_interaction_count']),
      generations: num(record['code_generation_activity_count']),
      acceptances: num(record['code_acceptance_activity_count']),
      locSuggestedToAdd: num(record['loc_suggested_to_add_sum']),
      locSuggestedToDelete: num(record['loc_suggested_to_delete_sum']),
      locAdded: num(record['loc_added_sum']),
      locDeleted: num(record['loc_deleted_sum']),
      aiCredits: num(record['ai_credits_used']),
      adoptionPhase: isObject(phase) ? str(phase['phase']) : undefined,
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
