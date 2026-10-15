# Project Guidelines

This is a client-side GitHub Copilot usage dashboard built with React, TypeScript, Vite, and Recharts. See [README.md](../README.md) for setup, supported input formats, and privacy guarantees.

## Data and Privacy

- Keep uploaded usage data in browser memory only. Do not add network transmission or persistent storage for uploaded data.
- Preserve the production Content Security Policy; development-only allowances must not reach production.
- Do not read or display `user_login`. Use numeric `user_id` only for internal aggregation and deduplication; never expose it or stable user pseudonyms in charts, tables, tooltips, or exports.
- Treat `tmp_files/` as private local input. Do not commit its contents or copy real usage records into fixtures, documentation, or generated samples. Use synthetic data for tests and examples.

## Implementation

- Keep input validation in `src/data/parseNdjson.ts`, schema normalization in `src/data/adapters/usageMetrics.ts`, and usage aggregation in `src/data/metrics.ts`; do not duplicate these responsibilities in components.
- Preserve deduplication by enterprise, organization, user, and day. Keep enterprise and organization export validation distinct.
- Handle evolving export fields defensively. Preserve existing missing-value behavior and prevent malformed optional metrics from producing `NaN`; do not weaken required-field validation.
- Follow nearby typed functional components and colocated `*.test.ts` files. Reuse existing test factories and helpers.
- Preserve Eficode branding, accessible chart colors, responsive layouts, and print output. Reuse CSS variables in `src/styles/app.css` and chart colors in `src/theme/palette.ts`; check `src/styles/print.css` when changing report layouts.

## Verification

- For behavior changes, add or update focused Vitest tests alongside the affected module. Run them with `npm test -- <test-file>`.
- Run `npm run typecheck` and `npm test` for code changes; run `npm run build` for production bundling or configuration changes.
- For visual changes, check the affected view at desktop and mobile sizes, and check print output when report layout changes.
- Report checks that could not be run and any remaining validation gaps.