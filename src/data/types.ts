/**
 * The normalised shape every adapter emits: one user on one day.
 *
 * This is deliberately lossy and deliberately anonymous. The raw export carries
 * a `user_login`, nested breakdowns by IDE, feature, language, model, skill,
 * MCP server, custom agent and slash command, token usage, and versions —
 * roughly 3.2 KB of JSON per record, which for a 1000-user month across all part
 * files is ~91 MB. No login value is ever read into this shape: `userId` (the
 * numeric, stable `user_id`) is the only identity, used for de-duplication and
 * distinct-user counts. `toUserDay()` in the adapter is the one place to add a
 * field when a new visualisation needs one.
 */
export interface UserDay {
  /** YYYY-MM-DD */
  day: string
  /** Stable numeric identity. Never a login — logins can be renamed or reused. */
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
  /** Distinguishes an explicit zero from a record where `ai_credits_used` was absent or malformed. */
  aiCreditsReported: boolean
  /** ai_adoption_phase.phase, e.g. "Phase 2" or "No Cohort". */
  adoptionPhase?: string
  /** ai_adoption_phase.phase_number. */
  adoptionPhaseNumber?: number
  usedAgent: boolean
  usedChat: boolean
  usedCli: boolean
  usedVscodeAgent: boolean
  usedCopilotApp: boolean
  usedCopilotCodeReviewActive: boolean
  usedCopilotCodeReviewPassive: boolean
  usedCopilotCodingAgent: boolean
  usedCopilotCloudAgent: boolean
  /** Per-feature totals from `totals_by_feature`, keyed on the `feature` name. */
  totalsByFeature: FeatureTotal[]
  /** Per-model totals from `totals_by_model_feature`, keyed on the `model` name. */
  totalsByModelFeature: FeatureTotal[]
  /** Per-language totals from `totals_by_language_feature`, keyed on the `language` name. */
  totalsByLanguageFeature: FeatureTotal[]
  /** Per-custom-agent totals from `totals_by_custom_agent`, keyed on the `custom_agent` name. */
  totalsByCustomAgent: CustomizationTotal[]
  /** Per-MCP-server totals from `totals_by_mcp`, keyed on the `mcp` name. */
  totalsByMcp: CustomizationTotal[]
  /** Per-skill totals from `totals_by_skill`, keyed on the `skill` name. */
  totalsBySkill: CustomizationTotal[]
  /** Per-plugin totals from `totals_by_plugin`, keyed on the `plugin` name. */
  totalsByPlugin: CustomizationTotal[]
  /** Per-slash-command totals from `totals_by_slash_cmd`, keyed on the `slash_cmd` name. */
  totalsBySlashCmd: CustomizationTotal[]
}

/**
 * One entry of `totals_by_feature`, `totals_by_model_feature`, or
 * `totals_by_language_feature`. `totals_by_language_feature` does not carry an
 * interaction count upstream, so `interactions` is 0 there rather than absent —
 * consumers should not read that as "no interactions happened", only "not
 * reported at this breakdown".
 */
export interface FeatureTotal {
  name: string
  interactions: number
  generations: number
  acceptances: number
  locAdded: number
  locDeleted: number
}

/**
 * One entry of the compact customization breakdowns — custom agent, MCP
 * server, skill, plugin, or slash command. Upstream, these only ever carry an
 * `interaction_count`, not the full feature measure set.
 */
export interface CustomizationTotal {
  name: string
  interactionCount: number
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
