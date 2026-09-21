/**
 * The normalised shape every adapter emits: one user on one day.
 *
 * This is deliberately lossy. The raw export carries nested breakdowns by IDE,
 * feature, language, model, skill, MCP server, custom agent and slash command —
 * roughly 3.2 KB of JSON per record, which for a 1000-user month across all part
 * files is ~91 MB. Keeping only the scalars the charts use is what makes that
 * tractable. `toUserDay()` in the adapter is the one place to add a field when a
 * new visualisation needs one.
 */
export interface UserDay {
  /** YYYY-MM-DD */
  day: string
  /** user_login */
  user: string
  userId: number
  organizationId?: string
  enterpriseId?: string
  interactions: number
  generations: number
  acceptances: number
  locSuggestedToAdd: number
  locSuggestedToDelete: number
  locAdded: number
  locDeleted: number
  aiCredits: number
  /** ai_adoption_phase.phase, e.g. "Phase 2" or "No Cohort". */
  adoptionPhase?: string
}

/** The window GitHub reported on, as opposed to the days that saw activity. */
export interface ReportWindow {
  start: string
  end: string
}

export interface Adapter {
  id: string
  label: string
  /** Human-readable field list, used in the "unrecognised format" error. */
  requiredFields: string[]
  /** Shape-based detection against the first parsed record of a file. */
  matches(sample: unknown): boolean
  toUserDay(record: unknown): UserDay | undefined
  /** Report window, when the format carries one. */
  reportWindow(record: unknown): ReportWindow | undefined
}

export interface Dataset {
  records: UserDay[]
  fileNames: string[]
  adapterId: string
  adapterLabel: string
  /** Union of the report windows seen across the uploaded files, when present. */
  reportWindow?: ReportWindow
  warnings: string[]
}
