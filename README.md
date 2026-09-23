# Copilot Usage Dashboard

A static, client-side dashboard for GitHub Copilot usage metrics exports. Upload and validate
the export, review its scope and IDs, optionally provide display names, then create the charts
and export a PDF. Nothing is uploaded and nothing is stored.

Deployed to GitHub Pages — see the repository's Pages URL.

## What it does

Drop in one or more Copilot usage metrics exports. Each file gets its own validation card so
syntax, scope, record count, and unique enterprise/organization IDs can be reviewed before
opening the dashboard. Additional files can be added, invalid files can be removed or ignored,
and optional display names can be assigned to IDs. The resulting dashboard provides
enterprise/organization comparisons, aggregate daily charts and bubble clouds, a set of
feature/adoption/credit/Lines of Code visualizations, top-five model/language/customization
rankings, and five complete end-of-report disclosures. When multiple files are merged or multiple
enterprise/organization combinations are present, a collapsed appendix repeats every
non-comparison visual for each unique combination behind dynamic tabs.

**Enterprise / organization comparisons**

- **AI adoption** — Phase 4 through Phase 1, No Cohort, and Unknown as percentage and user count
- **AI credits** — separate total, per-user, and daily-per-active-user tables; the two averages
  include their within-group population standard deviation
- **Tool adoption** — percentage of users who used Agent, Chat, CLI, VS Code Agent, Copilot App,
  active/passive code review, or the combined cloud/coding agent
- **Extension and customization usage** — MCP, custom agent, skill, plugin, and slash-command
  interactions as a per-user mean with the total in parentheses
- **Feature preference** — each group's share of attributed interactions across the overall top
  seven features, with the remaining tail folded into Other
- **Lines of code** — added/deleted totals and per-user values

**Daily charts and bubble clouds**

- **Interactions per day, by feature** — the top 7 features stacked, remainder folded into Other
- **Feature interactions bubble cloud** — the top 7 features across the selected range, with
  bubble area proportional to total interactions and the remaining tail summarized under Others
- **Code generations and acceptances per day** — two independent counts plotted together; this
  chart never derives or implies an acceptance-rate percentage
- **Daily users by surface** — IDE agent mode, IDE chat, the CLI, and Copilot cloud/coding agent
  (one combined line — GitHub documents the cloud and coding agent flags as the same signal)
- **Users by surface bubble cloud** — the top 7 logical surfaces by distinct users across the
  selected range, with the remaining surface summarized under Others
- **Users by number of surfaces bubble cloud** — the top 7 non-empty surface-count buckets across
  the selected range, with any remaining bucket summarized under Others
- **Model interactions bubble cloud** — the top 7 models across the selected range, measured by
  interaction count rather than Lines of Code, with the remaining tail summarized under Others
- **AI credits per day**

**Feature, adoption, credit, and Lines of Code visualizations**

- **Lines of Code added/deleted per feature**
- **AI adoption per user** — each user's *highest* numeric adoption phase reached in the selected
  period, not their most recent
- **Average AI credits per distinct user seen**, plus average daily AI credits per user and in
  total
- **Anonymous per-user AI credit distribution** — an unlabeled dot plot: one point per user with
  no ID or stable pseudonym attached, plus mean and population-standard-deviation markers
- **Daily lines of code per user** — mean and population-standard-deviation bands computed across
  that day's user records, not across daily organization totals

**Top-five rankings**

- **Top 5 models and languages by Lines of Code changed** — ranked by combined added + deleted
  Lines of Code, shown as separate added/deleted bars
- **Top 5 custom agents, MCP servers, skills, plugins, and slash commands** — ranked by
  interaction count

**Five complete disclosures**

Each customization ranking is followed by its own complete ranked list (all skills, all MCP
servers, all agents, all slash commands, all plugins) in a collapsible section that is always
expanded in the printed/exported PDF, regardless of its on-screen state.

**Per-combination appendix**

The aggregate report and comparison tables remain unchanged. At the end of the report, the
appendix provides one tab per unique enterprise ID + organization ID pair across all merged
files. It starts collapsed, repeats the charts, KPI cards, top-five rankings, and complete
disclosures for the selected pair, and keeps empty pairs visible when the chosen dates contain
no records for them. Date filters apply to both the aggregate report and every appendix tab.

PDF export ignores the appendix's collapsed and selected-tab state: every combination is
included, each starts on a new page, and each page has a header naming the enterprise and
organization plus the selected date range.

Filter by date range, then hit **Export PDF**.

## Privacy

This is the point of the tool, so it is enforced rather than promised:

- The export is read with the File API and lives only in React state. Reload the page and it is
  gone.
- No `localStorage`, `sessionStorage`, `IndexedDB`, or cookies — anywhere.
- No network requests after the initial page load. `index.html` ships a `connect-src 'none'`
  Content-Security-Policy, so the browser blocks them even if a future change tried. The sample
  dataset is bundled into the JS rather than fetched, and parsing runs on the main thread rather
  than in a blob worker, precisely so that policy can stay this strict.
- No analytics, no fonts or scripts from a CDN.
- **The app never displays GitHub usernames.** The normalized data model never carries a
  `user_login` — `user_id` (numeric, stable) is the only identity used, for de-duplication and
  distinct-user counts — see `UserDay` in `src/data/types.ts`.
- The anonymous per-user AI credit dot plots render every user as an unlabeled point: no user ID,
  login, or stable pseudonym is attached to a point, and the point's position on the anonymous
  axis carries no re-identifiable meaning.

**`tmp_files/` is gitignored** — real exports contain real GitHub usernames and must never be
committed. The bundled sample is synthetic, with invented logins.

## Supported input

GitHub's **Copilot usage metrics export**: newline-delimited JSON (`.ndjson`), one record per
user per day. Every non-empty line is parsed and validated; the extension alone is not trusted.
Every record must have a valid `day`, numeric `user_id`, and non-empty `enterprise_id`.

- An **organization export** has a non-empty `organization_id` on every record.
- An **enterprise export** has no `organization_id` on any record.
- Mixed `organization_id` presence, malformed JSON, an unrecognized record, or a missing
  required value marks that file invalid. The file card identifies the problem and relevant
  line numbers without displaying raw record values.

Exports arrive split into several `part-…` files. New selections append to the review, and each
part stays in its own validation card. The user explicitly continues when review is complete.
Valid files are merged and invalid files are ignored, so one bad part does not prevent using the
remaining valid parts. The merge de-duplicates on
`enterprise_id + organization_id + user_id + day`, so one user can remain represented in
multiple organizations on the same day. A dashboard note reports how many duplicate records
were dropped. Per-combination tabs are derived after this merge, so repeated parts for the same
enterprise/organization pair contribute to one tab rather than creating file-specific tabs.

The review also provides a shared translation list for every unique enterprise and organization
ID in the valid files. A non-empty value becomes that ID's display name throughout filters,
comparisons, and printed reports. Empty or whitespace-only values keep the original ID. These
aliases never alter the raw grouping or de-duplication keys, and two IDs given the same display
name remain separate groups.

Download yours from your enterprise or organization Copilot settings. There is a synthetic
sample behind **Add sample data**.

Optional schema fields (breakdown arrays, `ai_adoption_phase`, the `used_*` flags, …) can be
absent or empty on any record. Rather than a blank or a thrown error, each visualization that
depends on one shows its own targeted empty state (e.g. "No attributed feature Lines of Code data
for this range.") explaining what specifically is missing.

Known feature and surface identifiers receive curated display labels, including `copilot_app` as
`Copilot App`, `copilot_cli` as `Copilot CLI`, `chat_inline` as `Editor Inline Chat`, and
`chat_panel` / `chat_panel_…` as `Editor` / `Editor …`. Identifiers ending in `_mode` are expanded
to title-cased labels such as `agent_mode` → `Agent Mode`; other identifiers without a curated
label are displayed exactly as supplied.

The bundled synthetic sample contains several invented enterprise/organization combinations, so
the complete validation, naming, and comparison workflow can be evaluated without loading a real
export.

## Metric definitions

Formulas and choices that are not obvious from a chart title alone:

- **Feature interactions** show the top 7 features by interaction count over the selected range,
  plus a complete `Other` tail — no feature's activity is ever dropped, only folded.
- **Bubble clouds rank positive categories by value**, show the top seven, and sum the complete
  remaining tail into one `Others` bubble. Circle area is proportional to value; exact values
  remain in a persistent color legend and native tooltips when a small circle cannot fit text.
  The top seven use distinct category colors and `Others` stays neutral.
- **The feature interactions bubble cloud sizes bubble area by total interactions** across the
  selected range.
- **Generations and acceptances are independent counts**, plotted on the same axis. Neither this
  app nor the export defines a Lines of Code acceptance rate — see Interpretation limits below.
- **Copilot cloud/coding agent appears once**, not twice: GitHub documents
  `used_copilot_coding_agent` and `used_copilot_cloud_agent` as backward-compatible names for the
  same signal, so the two are folded with a logical OR into one line.
- **The surface bubble cloud evaluates all eight logical usage surfaces**, while the existing
  daily line chart retains its four broader series. Each named bubble counts distinct users
  across the selected range, not records or user-days; the eighth-ranked surface is folded into
  `Others`.
- **The surface-count bubble cloud buckets each user once per selected range** after unioning all
  logical surface flags for that user. Bubbles cover 1 through 8 surfaces when those buckets have
  users; records with no reported surface are excluded rather than placed in a zero-surface
  usage bucket.
- **The model bubble cloud measures interactions** from `totals_by_model_feature`, not Lines of
  Code.
- **Adoption distribution** uses each user's *highest* numeric adoption phase seen in the selected
  period, not their most recent or an average — a user who ever reached Phase 3 in range counts
  as Phase 3, even if most of their days were Phase 1.
- **Adoption comparisons** use the same highest-phase rule within each enterprise/organization
  group. Rows sort by Phase 4 share descending, then Phase 3, Phase 2, Phase 1, No Cohort, and
  Unknown. Every cell shows `percentage (distinct users)`.
- **Average AI credits per distinct user** = total AI credits ÷ distinct users seen in the
  selected range.
- **Total AI-credit comparisons** show no deviation because dispersion is not meaningful for one
  group total.
- **AI credits per user** show the mean and population standard deviation across reporting users'
  period totals within each group.
- **Daily AI credits per user** are calculated per group as each day's credits divided by that
  day's active users. The table shows the mean and population standard deviation of those daily
  values, skipping days without active users.
- **Missing AI-credit data is not zero.** A group where `ai_credits_used` was never reported shows
  an em dash; an explicitly reported zero remains `0`.
- **Tool adoption percentages** count distinct users who had the relevant `used_*` flag on at
  least one day in range. `used_copilot_coding_agent` and `used_copilot_cloud_agent` are combined
  with a logical OR.
- **Customization comparison means** divide each group's total MCP, custom-agent, skill, plugin,
  or slash-command interactions by its distinct users seen.
- **Feature preference** is the percentage of a group's attributed `totals_by_feature`
  interactions in each displayed feature. Feature columns are the top seven across all displayed
  groups plus Other when a tail exists.
- **Lines of Code comparison rows** sort by combined added + deleted Lines of Code per user, then
  by combined total Lines of Code.
- **Credit and Lines of Code deviations use population standard deviation**
  (`sqrt(sum((x - mean)²) / N)`),
  never the sample (`N - 1`) form — the filtered export *is* the full population being reported,
  not a sample drawn from a larger one.
- **Daily Lines of Code deviation is computed across that day's user records**, not across daily
  organization-wide totals — the mean and spread describe how individual users' Lines of Code
  varied on that day, not day-to-day variance in an org total.
- **Top models and languages rank by combined Lines of Code added + deleted**, but the two
  measures are always displayed as separate bars — they are never netted into one "changed
  lines" number.
- **Customization rankings** (custom agents, MCP servers, skills, plugins, slash commands) rank by
  interaction count.

## Interpretation limits

- **AI credits are a consumption analysis, not an invoice total.** This export and this app do
  not reproduce GitHub's billing calculation; treat credit figures as a usage signal, not a bill.
- **AI credits are not attributed by feature, model, or surface** in this export. There is no
  chart (and no way) to say "these credits were spent on chat" — only a per-day, per-user, or
  per-organization total.
- **Model and language Lines of Code breakdowns cover attributed rows only.** GitHub's
  `totals_by_model_feature` and `totals_by_language_feature` can omit unattributed activity, so
  those totals may not reconcile with the top-level lines-added/deleted figures — see
  `ATTRIBUTED_LOC_NOTE` in `src/components/charts/LocGroupedBarChart.tsx`, which every
  model/language chart in the app displays alongside its numbers.
- **Lines of Code added is a magnitude, not an acceptance rate.** `loc_added_sum` can exceed
  `loc_suggested_to_add_sum` in real exports, so lines added must never be read as a numerator
  over suggested lines — there is no Lines of Code acceptance rate anywhere in this app.
- **Optional schema fields can be absent or empty** and produce a targeted empty state rather than
  a broken chart — see "Supported input" above.

The schema is also still growing across real exports: fields such as `used_cli`,
`totals_by_skill`, `totals_by_cli`, and `totals_by_3rd_party_agent` do not appear on every record,
and some appear on very few. Treat every field as optional.

## Development

Requires Node.js 24 LTS and npm 11 or later.

```bash
npm install
npm run dev        # http://localhost:5173/
npm run build      # -> dist/
npm run preview    # serve dist/ with the production CSP
npm run typecheck
```

The dev server relaxes the CSP so Vite's HMR websocket works; the shipped `index.html` is never
rewritten. See `devCsp()` in `vite.config.ts`.

## Deployment

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`.
Enable Pages with source **GitHub Actions** in repository settings.

The workflow reads the deployment base path from `actions/configure-pages` and passes it to Vite.
This produces the correct asset URLs for a Pages root URL, project subpath, custom domain, or
access-controlled Pages URL. Before publishing, the workflow verifies that the HTML entry point
exists and every referenced script and stylesheet is present at that base path.

## Adding a field or a new format

The parse layer is adapter-based, so new charts do not touch the parser and new formats do not
touch the charts:

- **A new field from the same export**: add it to `UserDay` in `src/data/types.ts` and map it in
  `toUserDay()` in `src/data/adapters/usageMetrics.ts`. That function is deliberately the only
  place raw records are read. The nested breakdown arrays (`totals_by_feature`,
  `totals_by_language_feature`, and friends) are normalized down to compact `{ name, ...measures }`
  arrays at parse time rather than retained whole — at ~3.2 KB of raw JSON per record, a 1000-user
  month is ~91 MB, and keeping only the names and chartable measures is what makes that tractable.
  No login value is ever read into `UserDay` — `userId` (numeric, stable) is the only identity.
- **A new export format**: write `src/data/adapters/<name>.ts` exporting an `Adapter` and
  register it in `src/data/adapters/index.ts`. `detectAdapter()` matches on the shape of the
  first parsed record.

## Architecture notes

- `src/data/` — types, adapters, strict per-file NDJSON validation, display aliases, and
  aggregation. No React.
- `src/components/charts/` — one component per visualization, all Recharts (SVG, so PDFs are
  vector). `UsageVisuals` composes the complete non-comparison stack for both the aggregate
  report and each per-combination tab.
- `src/styles/app.css` — the Eficode brand tokens, in three sets (light, dark, and print over in
  `print.css`). Brand yellow `#ffd100` is the **UI accent only** — buttons, active states, the
  printed report rule. It cannot carry data: it sits above the categorical lightness band, and
  darkened into band it is indistinguishable from mango tango under deuteranopia (ΔE 2.3, floor
  6). Focus rings get their own `--focus` token for the same reason — a yellow ring on white is
  1.46:1.
- `src/theme/palette.ts` — chart colors as CSS custom-property references. Color follows the
  *measure*, not the card: people are cornflower blue, interaction volume mango tango, acceptance
  quality violet. Those three sit on series slots 1–3, the trio that clears the colour-vision
  *all-pairs* test in both modes; the slot order of the full eight is a validated artefact, not a
  preference, so re-ordering it needs a re-run rather than an opinion. All three clear 3:1
  against both light and dark surfaces.
- `src/styles/fonts.css` + `src/assets/fonts/` — Inter and JetBrains Mono, self-hosted as woff2
  subsets so the CSP and the no-network guarantee both hold. They live under `src/assets/` rather
  than `public/` because Vite's `base` may change by deployment target, which an absolute `/fonts/…`
  URL would not survive.
- `src/components/EficodeLogo.tsx` — the Eficode mark, in the app header and the printed report
  header. It is the official two-path artwork with the fills bound to theme tokens (`--text-primary`
  for the badge, `--surface-1` for the knocked-out wordmark), so one asset inverts correctly in
  dark mode and prints solid. `public/favicon.svg` is the same mark with static fills — a favicon
  cannot follow the page theme.
- `src/hooks/usePrintMode.ts` — Recharts' `ResponsiveContainer` measures via `ResizeObserver`,
  which does not fire during print layout, so charts would render at 0×0 in the PDF.
  `ChartFrame` swaps in explicit pixel dimensions while printing.
- `src/styles/print.css` — forces the light palette, hides interactive chrome, keeps cards off
  page boundaries, and shows a self-describing report header (files, report window, filters,
  timestamp).
- If large multi-part uploads ever freeze the UI, the CSP-compatible fix is a module worker
  (`new Worker(new URL('./parse.worker.ts', import.meta.url), { type: 'module' })`) — Vite emits
  it as a real same-origin file, which `default-src 'self'` permits. Blob workers do not work
  here, which is why Papa Parse's worker mode was never used.
