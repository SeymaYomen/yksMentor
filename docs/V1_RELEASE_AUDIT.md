# V1 release readiness audit

Base: `16c3d99`, branch `chore/v1-release-readiness`. Scope: release safety and verification only. No staging project exists (confirmed by owner); no production database writes, deploys, real AI calls or secret rotations were performed.

## Findings and disposition

| Priority | Finding | Disposition |
| --- | --- | --- |
| Blocker | README recommended destructive legacy schema; ordered migrations lacked base tables for a fresh DB. | New additive `202608300001_base_tables.sql`, canonical migration preparation and fresh/incremental runbook. Historical migrations unchanged. Live replay still required. |
| Blocker | No staging target or live evidence for RLS, migrations, Edge and quota concurrency. | Explicitly gated staging script/checklist prepared; production remains NO-GO. |
| Important | `.env` tracked, env ignore coverage incomplete. | Untracked while preserving local file; all env variants ignored except empty public template. |
| Important | Legacy probe scripts registered users against arbitrary configured targets and logged profiles. | Retired with a fail-closed pointer to staging procedure. |
| Important | Monolithic eager route bundle. | Lazy Student/Teacher dashboards, meetings and activation route; Suspense and global error boundary. |
| Important | Loading button could be re-enabled by spread props; task query errors looked like empty/completed tasks and null data could crash. | Fixed disabled precedence, safe task alert/retry/null fallback, obsolete-response guard and regression tests. |
| Important | Missing label associations, keyboard-hidden registration radios, bottom-nav overlap risk. | Existing labels linked; select/count fields named; radios remain keyboard accessible; flex child min-width and mobile bottom spacing corrected. |
| Important | Raw caught errors/debug data reached browser console. | Source logging reduced to fixed messages. AI logs retain only normalized code. No external observability added. |
| Important | Dependency vulnerabilities. | Compatible patch/minor updates only. 9 findings reduced to 4; remaining majors documented below. |
| Nice-to-have | Vite CJS notice, react-hot-toast module directive warning, further chart splitting and full WCAG/visual audit. | Deferred; no redesign or toolchain major migration. |

## Verification results

- Existing 108 regression tests preserved; **118/118 pass** including ten release tests (migration preparation/order, env, route contract, Button/error boundary rendering, task failure/null/overlapping-request behavior and staging gates).
- `npx tsc --noEmit`: pass. No tsconfig change.
- `npm run build`: pass; no >500 kB chunk warning. Nonblocking CJS and react-hot-toast directive notices remain.
- `npm run prepare:migrations`: six canonical files prepared; no DB connection. New bootstrap uses CREATE IF NOT EXISTS and RLS, no DROP/DELETE/reset. Historical migration definitions are unchanged. No conflicting signatures were found within the reviewed chain; live drift, unknown policies/overloads and legacy data constraints require staging/schema comparison.
- Supabase CLI, Deno, Docker and psql were not found on PATH. Native Edge typecheck, fresh/incremental PostgreSQL application and real privilege tests were not run.
- `npm run check:secrets -- --bundle`: pass. Tracked-file and historical-patch scans found no recognized OpenAI/private-key/service-role/GitHub token patterns. This is a pattern-based audit, not proof against every possible credential format.
- The removed `.env` contained a Supabase URL and a **public publishable key**, not an identified privileged key. No privileged-secret rotation was indicated by this evidence. Public values remain in old Git history; untracking does not erase history. If the owner identifies any separately exposed privileged credential, rotate it manually.
- Local preview on 127.0.0.1:4173: **nine paths returned HTTP 200 SPA shell**, and all built assets returned 200. Includes login/register, both dashboards, both meeting paths, activation, root and unknown path. This proves HTTP serving/deep-link fallback only, not JavaScript rendering, redirects or authenticated data access.
- Computer-use returned **No browser is available**. No visual/mobile browser pass or authenticated preview smoke is claimed. Main screens were reviewed at source level.
- Staging/RLS E2E: **not run**. Edge remote smoke/deploy: **not run**. Quota concurrency: **not run**; 3 accepted / 1 denied remains an expected staging assertion, not an observed result. Paid OpenAI smoke: **not run**. Existing Edge/provider mock tests still pass.

## Bundle comparison

Vite-reported decimal kB:

| Metric | Base | Release readiness |
| --- | ---: | ---: |
| Initial JS | 929.66 | 415.74 |
| Initial JS gzip | 261.68 | 121.13 |
| Largest deferred shared chunk | none | 395.83 (109.74 gzip) |
| Total JS across all chunks | 929.66 | about 934.10 |
| CSS | 43.64 | 44.82 |

Initial JS is approximately 55% smaller; total application code is not smaller. Charts remain in a shared deferred chunk, with no library removal or redesign. Retaining old hashed assets during deploy and HTML revalidation are documented to prevent stale lazy-chunk failures.

## Dependency audit

`npm install --ignore-scripts` followed by targeted `npm update ... --ignore-scripts` updated 12 packages within existing semver ranges. No `--force` or major upgrades. Examples: react-router-dom 6.30.6, postcss 8.5.28, and patched browserslist/nanoid/parser transitives. Package lock records exact versions. Duplicate-version review found glob-parent, picomatch and react-is transitives; no duplicate React/ReactDOM installations were found and no forced deduplication was applied.

- Before: 9 total (4 high, 4 moderate, 1 low), no critical.
- After: 4 total (1 high, 3 moderate), no critical.
- Runtime-only `npm audit --omit=dev`: 2 moderate (react-router and react-router-dom), no high/critical.
- Remaining high: Vite dev-server Windows file-access issue; Vite/esbuild are development dependencies. Deploy only static `dist`, keep dev/preview localhost-only. Major toolchain work is deferred, not treated as a clean audit. [Vite advisory](https://github.com/advisories/GHSA-fx2h-pf6j-xcff).
- React Router residuals include backslash/open redirect and SSR hydration advisories. This app uses BrowserRouter, no SSR hydration, and reviewed navigation targets are application-defined paths. This reduces observed exposure but does not remove the dependency findings; a router major upgrade or explicit risk acceptance remains an owner decision. [Redirect advisory](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6), [SSR advisory](https://github.com/advisories/GHSA-337j-9hxr-rhxg).

## Release decision

**NO-GO for production today.** Local release preparation is complete, but real staging was unavailable. Follow [V1_RELEASE_CHECKLIST.md](V1_RELEASE_CHECKLIST.md): confirm target, restore-test backup, dry-run/apply/replay migrations, run real role/RLS fixtures, Edge smoke, 4-request concurrency and one authorized AI request; complete visual/authenticated browser checks and dependency risk acceptance. Only then evaluate GO. No automatic production release is configured.
