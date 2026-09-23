#!/usr/bin/env node
/**
 * Deterministic, development-only generator for the bundled synthetic sample
 * export at `src/data/sample.ndjson`.
 *
 * Regenerate with:
 *   node scripts/generate-sample-data.mjs > src/data/sample.ndjson
 * or:
 *   npm run generate:sample
 *
 * Every login, id, and number here is invented — nothing is copied from a
 * real GitHub Copilot usage metrics export. A seeded PRNG (mulberry32) makes
 * re-runs byte-for-byte identical, so the fixture only changes when this
 * script changes and diffs stay reviewable.
 *
 * Shape follows GitHub's documented per-user schema:
 * https://docs.github.com/en/copilot/reference/copilot-usage-metrics/example-schema
 *
 * Coverage this script is designed to guarantee (see issue #11):
 *  - 8+ distinct `feature` values, 6+ `model` and `language` values, and 6+
 *    names each for custom agents, MCP servers, skills, plugins, and slash
 *    commands, so top-N-plus-Other and top-five-vs-complete-list behavior is
 *    visible in the app.
 *  - `totals_by_feature` reconciles with each record's top-level
 *    interactions/generations/acceptances/LoC. `totals_by_language_feature`
 *    also reconciles on generations/acceptances/LoC (but carries no
 *    interaction count). `totals_by_model_feature` reconciles only on
 *    interaction count; its generation/acceptance/LoC counts are partially
 *    attributed, reflecting GitHub's documented unattributed model activity.
 *  - Multiple enterprise/organization combinations and a mixture of every
 *    `used_*` signal normalized by the dashboard, with the coding/cloud pair
 *    always matching.
 *  - Adoption phases that step up for some users partway through the window.
 *  - AI credit zeros, typical values, and a handful of outliers.
 *  - Per-user LoC scale variation, for visible daily standard-deviation bands.
 *  - Some records with omitted optional fields (`ai_adoption_phase`) and
 *    explicit empty breakdown arrays.
 */

// ---------------------------------------------------------------------------
// Seeded RNG — mulberry32. Deterministic across Node versions and platforms.
// ---------------------------------------------------------------------------

const SEED = 0xc0ffee42

function mulberry32(seed) {
  let a = seed >>> 0
  return function rng() {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rng = mulberry32(SEED)

const randInt = (min, max) => min + Math.floor(rng() * (max - min + 1))
const randFloat = (min, max, decimals = 2) => {
  const v = min + rng() * (max - min)
  const p = 10 ** decimals
  return Math.round(v * p) / p
}
const chance = (p) => rng() < p

/** Fisher-Yates using the shared RNG, so the shuffled order is reproducible. */
function shuffled(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Random composition of `total` into `parts` non-negative integers that sum exactly to `total`. */
function splitAmong(total, parts) {
  if (parts <= 1) return [total]
  const cuts = []
  for (let i = 0; i < parts - 1; i++) cuts.push(randInt(0, total))
  cuts.sort((a, b) => a - b)
  const out = []
  let prev = 0
  for (const c of cuts) {
    out.push(c - prev)
    prev = c
  }
  out.push(total - prev)
  return out
}

// ---------------------------------------------------------------------------
// Vocabulary — every list exceeds the issue's minimum distinct-name counts.
// ---------------------------------------------------------------------------

const FEATURES = [
  'code_completion',
  'copilot_app',
  'copilot_cli',
  'agent_edit',
  'code_review_active',
  'code_review_passive',
  'cloud_agent',
  'github_app',
  'chat_panel',
]

const MODELS = ['gpt-4.1', 'gpt-4o', 'claude-3.5-sonnet', 'claude-opus-4', 'o3-mini', 'o4-mini', 'gemini-2.0-flash']

const LANGUAGES = [
  'python',
  'typescript',
  'javascript',
  'go',
  'java',
  'ruby',
  'csharp',
  'markdown',
  'unknown',
]

const CUSTOM_AGENTS = [
  'general-purpose',
  'code-reviewer',
  'test-writer',
  'security-auditor',
  'docs-writer',
  'refactor-bot',
  'other',
]

const MCP_SERVERS = [
  'github-mcp-server',
  'filesystem-mcp',
  'postgres-mcp',
  'playwright-mcp',
  'slack-mcp',
  'jira-mcp',
  'other',
]

const SKILLS = ['pdf', 'xlsx', 'web-search', 'terraform', 'compliance', 'create-canvas', 'other']

const PLUGINS = [
  'eslint-plugin',
  'prettier-plugin',
  'jest-plugin',
  'docker-plugin',
  'sentry-plugin',
  'webpack-plugin',
  'other',
]

const SLASH_CMDS = ['/plan', '/explain', '/fix', '/tests', '/docs', '/review', 'custom']

// Invented identities only — computing pioneers' first names, `-dev` suffix.
// No real GitHub login is reused anywhere in this file.
const FIRST_NAMES = [
  'ada',
  'edsger',
  'barbara',
  'margaret',
  'frances',
  'grace',
  'alan',
  'katherine',
  'dennis',
  'ken',
  'radia',
  'tim',
  'linus',
  'guido',
  'donald',
  'edwin',
  'marvin',
  'herbert',
  'alonzo',
  'haskell',
  'stephen',
  'vint',
  'whitfield',
  'adele',
  'hedy',
  'dorothy',
  'joan',
  'evelyn',
  'betty',
  'jean',
  'mary',
  'ida',
  'fred',
  'leslie',
  'niklaus',
  'dana',
]

const REPORT_START_DAY = '2026-08-24'
const REPORT_END_DAY = '2026-09-20'
const ORGANIZATION_GROUPS = [
  { enterpriseId: '4411', organizationId: '135233467' },
  { enterpriseId: '4411', organizationId: '135233468' },
  { enterpriseId: '5820', organizationId: '246810121' },
  { enterpriseId: '5820', organizationId: '246810122' },
]

function daysBetween(start, end) {
  const out = []
  let d = new Date(`${start}T00:00:00Z`)
  const endD = new Date(`${end}T00:00:00Z`)
  while (d <= endD) {
    out.push(d.toISOString().slice(0, 10))
    d = new Date(d.getTime() + 86400000)
  }
  return out
}

const DAYS = daysBetween(REPORT_START_DAY, REPORT_END_DAY)

const ADOPTION_LABELS = ['No Cohort', 'Phase 1', 'Phase 2', 'Phase 3', 'Phase 4']

// ---------------------------------------------------------------------------
// Per-user personas — deterministic, RNG-seeded so no persona is hand-tuned,
// but every dimension the issue asks for (surfaces, favourites, adoption
// trajectory, credit profile, LoC scale) is represented across the roster.
// ---------------------------------------------------------------------------

function buildPersonas() {
  return FIRST_NAMES.map((name, i) => {
    const userId = 1300000 + i * 137
    const organizationGroup = ORGANIZATION_GROUPS[i % ORGANIZATION_GROUPS.length]

    const usesAgent = chance(0.5)
    const usesChat = chance(0.65)
    const usesCli = chance(0.35)
    const usesVscodeAgent = chance(0.42)
    const usesCopilotApp = chance(0.3)
    const usesCodeReviewActive = chance(0.28)
    const usesCodeReviewPassive = chance(0.38)
    const usesCloudAgent = chance(0.22)

    const favFeatures = shuffled(FEATURES).slice(0, randInt(2, 4))
    const favModels = shuffled(MODELS).slice(0, randInt(1, 3))
    const favLanguages = shuffled(LANGUAGES).slice(0, randInt(1, 3))

    // Roughly 40% of the roster drives the customization breakdowns; each is
    // pinned to one name per category, cycled by index, so every vocabulary
    // entry above gets picked by at least one user across the whole roster.
    // The first `CUSTOM_AGENTS.length` users are always customization users
    // (one per name, index-aligned) so every vocabulary entry is guaranteed
    // to appear at least once, regardless of how the later RNG draws land.
    const isCustomizationUser = i < CUSTOM_AGENTS.length || chance(0.45)
    const customization = isCustomizationUser
      ? {
          customAgent: CUSTOM_AGENTS[i % CUSTOM_AGENTS.length],
          mcp: MCP_SERVERS[i % MCP_SERVERS.length],
          skill: SKILLS[i % SKILLS.length],
          plugin: PLUGINS[i % PLUGINS.length],
          slashCmd: SLASH_CMDS[i % SLASH_CMDS.length],
        }
      : undefined

    const creditRoll = rng()
    const creditProfile = creditRoll < 0.15 ? 'zero' : creditRoll < 0.28 ? 'outlier' : 'typical'

    const presenceProb = 0.28 + rng() * 0.42
    const activeGivenPresent = 0.45 + rng() * 0.3
    const locScale = 0.3 + rng() * 3.2

    const initialPhaseNumber = randInt(0, 2)
    const phaseStepsUp = chance(0.4)
    const phaseChangeDayIndex = phaseStepsUp ? randInt(8, DAYS.length - 4) : undefined
    const steppedPhaseNumber = phaseStepsUp ? Math.min(initialPhaseNumber + randInt(1, 2), 4) : initialPhaseNumber

    // A handful of users never carry adoption-phase data at all, exercising
    // the "Unknown" bucket in `adoptionPhaseDistribution`.
    const omitsAdoptionPhase = chance(0.08)
    // Preserve the generator's historical random sequence after making IDs required.
    chance(0.06)

    return {
      userId,
      login: `${name}-dev`,
      organizationGroup,
      usesAgent,
      usesChat,
      usesCli,
      usesVscodeAgent,
      usesCopilotApp,
      usesCodeReviewActive,
      usesCodeReviewPassive,
      usesCloudAgent,
      favFeatures,
      favModels,
      favLanguages,
      customization,
      creditProfile,
      presenceProb,
      activeGivenPresent,
      locScale,
      initialPhaseNumber,
      phaseChangeDayIndex,
      steppedPhaseNumber,
      omitsAdoptionPhase,
    }
  })
}

// ---------------------------------------------------------------------------
// Record generation
// ---------------------------------------------------------------------------

function adoptionPhaseFor(persona, dayIndex) {
  if (persona.omitsAdoptionPhase) return undefined
  const phaseNumber =
    persona.phaseChangeDayIndex !== undefined && dayIndex >= persona.phaseChangeDayIndex
      ? persona.steppedPhaseNumber
      : persona.initialPhaseNumber
  return { phase_number: phaseNumber, phase: ADOPTION_LABELS[phaseNumber], version: 'v1' }
}

function creditsFor(persona, dayIndex, isLastActiveOutlierDay) {
  if (persona.creditProfile === 'zero') return 0
  if (persona.creditProfile === 'outlier' && isLastActiveOutlierDay) return randFloat(2200, 6400, 4)
  return randFloat(0, 420, 6)
}

/** Feature-breakdown array that reconciles exactly with the record's top-level totals. */
function buildFeatureTotals(favFeatures, interactions, generations, acceptances, locAdded, locDeleted) {
  const n = favFeatures.length
  const interactionParts = splitAmong(interactions, n)
  const generationParts = splitAmong(generations, n)
  const acceptanceParts = splitAmong(acceptances, n)
  const locAddedParts = splitAmong(locAdded, n)
  const locDeletedParts = splitAmong(locDeleted, n)
  return favFeatures.map((feature, i) => ({
    feature,
    user_initiated_interaction_count: interactionParts[i],
    code_generation_activity_count: generationParts[i],
    code_acceptance_activity_count: acceptanceParts[i],
    loc_suggested_to_add_sum: locAddedParts[i] + randInt(0, 3),
    loc_suggested_to_delete_sum: locDeletedParts[i] + randInt(0, 2),
    loc_added_sum: locAddedParts[i],
    loc_deleted_sum: locDeletedParts[i],
  }))
}

/**
 * Language breakdown: reconciles exactly with the record's top-level
 * generations/acceptances/LoC, matching this repo's documented measurement of
 * a real export (see README's "Three things the data does that will bite
 * you"). It carries no interaction count — `totals_by_language_feature`
 * doesn't report one upstream, and the adapter's `FeatureTotal.interactions`
 * for these entries is expected to read as 0, not "no activity happened".
 */
function buildLanguageTotals(languages, generations, acceptances, locAdded, locDeleted) {
  const n = languages.length
  const generationParts = splitAmong(generations, n)
  const acceptanceParts = splitAmong(acceptances, n)
  const locAddedParts = splitAmong(locAdded, n)
  const locDeletedParts = splitAmong(locDeleted, n)
  return languages.map((language, i) => ({
    language,
    code_generation_activity_count: generationParts[i],
    code_acceptance_activity_count: acceptanceParts[i],
    loc_added_sum: locAddedParts[i],
    loc_deleted_sum: locDeletedParts[i],
  }))
}

/**
 * Model breakdown: `user_initiated_interaction_count` reconciles exactly with
 * the top-level total, but generations/acceptances/LoC are only partially
 * attributed — this repo's measurement of a real export found only the
 * interaction count reconciles for `totals_by_model_feature`, the rest
 * reflecting GitHub's documented unattributed model activity.
 */
function buildModelTotals(models, interactions, generations, acceptances, locAdded, locDeleted) {
  const n = models.length
  const interactionParts = splitAmong(interactions, n)

  const attributedFraction = 0.45 + rng() * 0.45
  const attributedGenerations = Math.round(generations * attributedFraction)
  const attributedAcceptances = Math.min(acceptances, Math.round(acceptances * attributedFraction))
  const attributedLocAdded = Math.round(locAdded * attributedFraction)
  const attributedLocDeleted = Math.round(locDeleted * attributedFraction)
  const generationParts = splitAmong(attributedGenerations, n)
  const acceptanceParts = splitAmong(attributedAcceptances, n)
  const locAddedParts = splitAmong(attributedLocAdded, n)
  const locDeletedParts = splitAmong(attributedLocDeleted, n)

  return models.map((model, i) => ({
    model,
    user_initiated_interaction_count: interactionParts[i],
    code_generation_activity_count: generationParts[i],
    code_acceptance_activity_count: acceptanceParts[i],
    loc_added_sum: locAddedParts[i],
    loc_deleted_sum: locDeletedParts[i],
  }))
}

function generateRecords() {
  const personas = buildPersonas()
  const records = []

  for (const persona of personas) {
    // Tracks whether this user's single credit outlier day has been used yet,
    // so "outlier" personas get exactly one spike rather than every day.
    let outlierConsumed = false

    DAYS.forEach((day, dayIndex) => {
      if (!chance(persona.presenceProb)) return // no record at all this day

      const isActive = chance(persona.activeGivenPresent)

      let interactions = 0
      let generations = 0
      let acceptances = 0
      let locSuggestedToAdd = 0
      let locSuggestedToDelete = 0
      let locAdded = 0
      let locDeleted = 0

      if (isActive) {
        interactions = randInt(1, 24)
        generations = interactions + randInt(0, 30)
        acceptances = randInt(0, Math.round(generations * 0.85))
        const perGenLoc = randFloat(2, 11, 1) * persona.locScale
        locSuggestedToAdd = Math.max(0, Math.round(generations * perGenLoc))
        locSuggestedToDelete = Math.max(0, Math.round(locSuggestedToAdd * randFloat(0.05, 0.35)))
        // Actual applied LoC can run above or below what was suggested.
        locAdded = Math.max(0, Math.round(locSuggestedToAdd * randFloat(0.4, 1.35)))
        locDeleted = Math.max(0, Math.round(locSuggestedToDelete * randFloat(0.4, 1.35)))
      }

      const usedAgentToday = persona.usesAgent && chance(isActive ? 0.75 : 0.1)
      const usedChatToday = persona.usesChat && chance(isActive ? 0.8 : 0.15)
      const usedCliToday = persona.usesCli && chance(isActive ? 0.6 : 0.05)
      const usedVscodeAgentToday = persona.usesVscodeAgent && chance(isActive ? 0.68 : 0.08)
      const usedCopilotAppToday = persona.usesCopilotApp && chance(isActive ? 0.55 : 0.06)
      const usedCodeReviewActiveToday =
        persona.usesCodeReviewActive && chance(isActive ? 0.45 : 0.04)
      const usedCodeReviewPassiveToday =
        persona.usesCodeReviewPassive && chance(isActive ? 0.58 : 0.08)
      // used_copilot_coding_agent and used_copilot_cloud_agent always carry
      // the same value upstream — one roll drives both.
      const usedCloudAgentToday = persona.usesCloudAgent && chance(isActive ? 0.5 : 0.05)

      const isOutlierDay = persona.creditProfile === 'outlier' && isActive && !outlierConsumed && chance(0.18)
      if (isOutlierDay) outlierConsumed = true
      const aiCredits = creditsFor(persona, dayIndex, isOutlierDay)

      const record = {
        report_start_day: REPORT_START_DAY,
        report_end_day: REPORT_END_DAY,
        day,
        user_id: persona.userId,
        user_login: persona.login,
        user_initiated_interaction_count: interactions,
        code_generation_activity_count: generations,
        code_acceptance_activity_count: acceptances,
        loc_suggested_to_add_sum: locSuggestedToAdd,
        loc_suggested_to_delete_sum: locSuggestedToDelete,
        loc_added_sum: locAdded,
        loc_deleted_sum: locDeleted,
        ai_credits_used: aiCredits,
        used_agent: usedAgentToday,
        used_chat: usedChatToday,
        used_cli: usedCliToday,
        used_vscode_agent: usedVscodeAgentToday,
        used_copilot_app: usedCopilotAppToday,
        used_copilot_code_review_active: usedCodeReviewActiveToday,
        used_copilot_code_review_passive: usedCodeReviewPassiveToday,
        used_copilot_coding_agent: usedCloudAgentToday,
        used_copilot_cloud_agent: usedCloudAgentToday,
      }

      record.organization_id = persona.organizationGroup.organizationId
      record.enterprise_id = persona.organizationGroup.enterpriseId

      const phase = adoptionPhaseFor(persona, dayIndex)
      if (phase) record.ai_adoption_phase = phase

      if (isActive) {
        record.totals_by_feature = buildFeatureTotals(
          persona.favFeatures,
          interactions,
          generations,
          acceptances,
          locAdded,
          locDeleted,
        )
        record.totals_by_model_feature = buildModelTotals(
          persona.favModels,
          interactions,
          generations,
          acceptances,
          locAdded,
          locDeleted,
        )
        record.totals_by_language_feature = buildLanguageTotals(
          persona.favLanguages,
          generations,
          acceptances,
          locAdded,
          locDeleted,
        )
      } else {
        // Zero-activity-but-present days: explicit empty arrays exercise the
        // "legitimately empty optional array" parsing path.
        record.totals_by_feature = []
        record.totals_by_model_feature = []
        record.totals_by_language_feature = []
      }

      if (persona.customization && (usedAgentToday || usedChatToday)) {
        const c = persona.customization
        record.totals_by_custom_agent = [{ custom_agent: c.customAgent, interaction_count: randInt(1, 16) }]
        record.totals_by_mcp = [{ mcp: c.mcp, interaction_count: randInt(1, 20) }]
        record.totals_by_skill = [{ skill: c.skill, interaction_count: randInt(1, 12) }]
        record.totals_by_plugin = [{ plugin: c.plugin, interaction_count: randInt(1, 9) }]
        record.totals_by_slash_cmd = [{ slash_cmd: c.slashCmd, interaction_count: randInt(1, 7) }]
      }
      // Users without a customization profile, or without agent/chat use that
      // day, simply omit these five keys — the other half of the "empty vs.
      // omitted" requirement.

      records.push(record)
    })
  }

  return records
}

function main() {
  const records = generateRecords()
  // Stable output order: chronological, then by user id — deterministic and
  // easy to diff.
  records.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.user_id - b.user_id))
  process.stdout.write(records.map((r) => JSON.stringify(r)).join('\n') + '\n')
}

main()
