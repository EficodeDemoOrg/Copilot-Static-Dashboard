# Copilot Usage Dashboard

A static, client-side dashboard for GitHub Copilot usage metrics exports. Upload the export,
read the charts, export a PDF. Nothing is uploaded and nothing is stored.

Deployed to GitHub Pages — see the repository's Pages URL.

## What it does

Drop in a Copilot usage metrics export and get:

- **KPI row** — active users (and how many never were), active user-days, interactions, code
  generations, acceptance rate, lines added and deleted, AI credits, date range
- **Active users per day** — how many people actually used Copilot each day
- **Interactions per day** — user-initiated volume, on its own scale
- **Acceptance rate per day** — accepted suggestions as a share of generated, against the
  period average
- **Top 15 users by interactions** — who drives usage

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

**`tmp_files/` is gitignored** — real exports contain real GitHub usernames and must never be
committed. The bundled sample is synthetic, with invented logins.

## Supported input

GitHub's **Copilot usage metrics export**: newline-delimited JSON (`.ndjson`), one record per
user per day. Only `day` and `user_login` are required; every other field is optional and
missing values degrade to zero rather than `NaN`.

Exports arrive split into several `part-…` files. Select them all at once — they are merged and
de-duplicated on `user_id + day`, and a note reports how many duplicates were dropped. A line
that fails to parse is counted and skipped rather than failing the whole upload.

Download yours from your enterprise or organization Copilot settings. There is a synthetic
sample behind **Try with sample data**.

### Three things the data does that will bite you

Measured across the 790 records of a real 86-user, 28-day export:

1. **`totals_by_feature` and `totals_by_language_feature` reconcile exactly** with the top-level
   counts. **`totals_by_ide` and the model breakdowns do not** — 97–144 records disagree,
   because some activity is unattributed. Only `user_initiated_interaction_count` reconciles for
   `totals_by_model_feature`. Any model or IDE chart must be framed as a share of *attributed*
   activity, not of the total.

2. **`loc_added_sum` can exceed `loc_suggested_to_add_sum`** — on 131 of 790 records, and by 8%
   sample-wide. **There is no LoC acceptance rate.** Lines added is a magnitude, never a
   numerator. The bounded quality metric is
   `code_acceptance_activity_count / code_generation_activity_count`.

3. **43% of records have zero interactions and zero generations** while still carrying AI
   credits. A record is not an active day. This app defines a user-day as active when
   `interactions > 0 || generations > 0`, states that rule wherever the number appears, and
   surfaces the gap between users seen and users active — those are the dormant seats.

The schema is also visibly still growing: `used_cli` appeared on 469/790 records,
`totals_by_skill` on 719, `totals_by_cli` on 122, `totals_by_3rd_party_agent` on exactly one.
Treat every field as optional.

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
  place raw records are read. Note that the nested breakdown arrays (`totals_by_language_feature`
  and friends) are dropped at parse time — at ~3.2 KB of JSON per record, a 1000-user month is
  ~91 MB, and keeping only the scalars is what makes that tractable. Aggregate what you need
  inside `toUserDay()` rather than retaining the raw arrays.
- **A new export format**: write `src/data/adapters/<name>.ts` exporting an `Adapter` and
  register it in `src/data/adapters/index.ts`. `detectAdapter()` matches on the shape of the
  first parsed record.

## Architecture notes

- `src/data/` — types, adapters, NDJSON parsing, aggregation. No React.
- `src/components/charts/` — one component per visualization, all Recharts (SVG, so PDFs are
  vector).
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
