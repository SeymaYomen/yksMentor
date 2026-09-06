# YKS Mentor V1 release checklist

Status: **NO-GO for production until real staging evidence is recorded.** No staging project was available during this audit. Local tests and source contracts do not prove live RLS, migration compatibility or concurrency.

## Pre-deploy

- [ ] Record release commit, owner, target project ref and rollback build.
- [ ] `npm ci` (Node 22+ recommended); `npm test`; `npm run typecheck`.
- [ ] `npm run build`; `npm run check:secrets -- --bundle`.
- [ ] `npm audit` and `npm audit --omit=dev`; review remaining risk acceptance.
- [ ] Copy `.env.example` to ignored `.env.local`; set only public Supabase URL and anon/publishable key. Confirm key type before building. Never put service-role/provider secrets into VITE variables.
- [ ] Configure HTTPS hosting, SPA fallback to `/index.html`, Supabase Auth Site URL and allowed redirect URLs. Deploy only `dist`, never source/env files or the Vite development server.
- [ ] Preserve old hashed assets through a rollout window; serve index.html with revalidation and hashed assets with immutable caching. A missing lazy chunk is recoverable via the global reload fallback.

## Migration order and compatibility

Canonical source is `sql/migrations`. `npm run prepare:migrations` copies it byte-for-byte into ignored `supabase/migrations`; unexpected files cause a stop. Do not edit generated copies.

| Order | Migration | Dependency / effect |
| --- | --- | --- |
| 1 | 202608300001_base_tables | New additive bootstrap; creates missing profiles/tasks/performance/meetings, enables RLS. No data deletion or role changes. |
| 2 | 202608310001_role_auth_foundation | Base tables; secure signup, teacher invite, pairing, role helpers, grants and RLS. |
| 3 | 202608310002_meeting_briefing_followup | Meeting columns, role helpers; outcomes/action items and RPCs. |
| 4 | 202608310003_goal_progress_roadmap | Profiles and role helpers; goal history and RPC. |
| 5 | 202609020001_topic_competency_map | Profiles/performance/tasks and role helpers; catalog, evidence, academic RPCs. |
| 6 | 202609020002_ai_mentor_usage | Teacher profiles; service-only quota/telemetry RPCs. |

- [ ] Fresh DB: apply all six in order. Bootstrap fills the previously missing prerequisite. Fresh execution is not yet verified on PostgreSQL.
- [ ] Existing DB: export schema/policies/grants/function signatures and take a restorable backup first. Compare actual applied versions, base column types, status values, policy names, auth triggers and RPC signatures. CREATE IF NOT EXISTS does not repair drift; CREATE OR REPLACE cannot change existing return types/signatures arbitrarily.
- [ ] Existing reviewed RPC definitions have compatible signatures; new feature names are distinct. Unknown live overloads and permissive policies are not automatically removed. Stop on conflicts and author a new corrective migration; do not rewrite old migration history.
- [ ] The new bootstrap sorts before previously deployed migrations. For an existing project, review `--include-all --dry-run`; apply it only when the sole older pending migration is this reviewed additive bootstrap. Never blindly replay migrations already manually applied. Reconcile the migration ledger from schema evidence with the operator; do not automatically run migration repair.
- [ ] Never run legacy `sql/schema.sql` (contains DROP TABLE), `sql/auth_triggers.sql`, `sql/rls_policies.sql`, `sql/advanced_join_system.sql`, `sql/alter_meetings.sql`, `sql/weekly_goals.sql` or `sql/seed.sql` as part of V1 deployment. They are historical scripts, not this release chain. Reapplying legacy auth SQL can weaken the teacher-role boundary. Legacy weekly_goals is unused by the V1 client and excluded.

## Staging commands (PowerShell)

Install Supabase CLI using its official instructions. No project is linked by this repository's local config. Docker is required for a local Supabase stack. Secrets belong in an ignored file outside the repository, not shell history.

```powershell
supabase --version
npm run prepare:migrations
# Set this to an explicitly confirmed NON-PRODUCTION project ref.
$stagingRef = '<confirmed-staging-project-ref>'
supabase login
supabase projects list
supabase link --project-ref $stagingRef
# Verify supabase/.temp/project-ref matches $stagingRef before any write.
supabase migration list --linked
supabase db push --linked --dry-run --include-all
# STOP: review target, pending versions, backup and schema drift first.
supabase db push --linked --include-all
supabase secrets set --project-ref $stagingRef --env-file '<private-staging-env-file>'
supabase secrets list --project-ref $stagingRef
supabase functions deploy mentor-ai-insight --project-ref $stagingRef
```

Required Edge secrets: OPENAI_API_KEY, OPENAI_MODEL, SUPABASE_SERVICE_ROLE_KEY. Supabase supplies SUPABASE_URL and SUPABASE_ANON_KEY. Hosted Supabase reserves SUPABASE_* names: verify its provided service-role secret rather than trying to overwrite a reserved name via secrets set. For local serve, provide the required local values. Optional: AI_MENTOR_MINUTE_LIMIT (3), AI_MENTOR_DAILY_LIMIT (30), AI_MENTOR_TIMEOUT_MS (20000). `secrets list` reports names/digests, not proof of provider validity.

Local fresh replay on a disposable local stack only:

```powershell
npm run prepare:migrations
supabase start
supabase db reset --local
# Never add --linked or --db-url to reset.
deno check supabase/functions/mentor-ai-insight/index.ts
supabase functions serve mentor-ai-insight --env-file '<private-local-env-file>'
```

## Real RLS / Edge / quota verification

- [ ] Create disposable confirmed Teacher A, Teacher B, Student A and a second student fixture; Student A is linked only to Teacher A. Use secure invite redemption to establish teacher accounts, not signup metadata. No real student data.
- [ ] In the application as Teacher A/Student A, create one task, performance, completed meeting, meeting action item, active goal and topic performance row for Student A. Record IDs in the private test environment.
- [ ] Set STAGING_PROJECT_REF, CONFIRM_STAGING_PROJECT_REF (same confirmed ref), STAGING_SUPABASE_URL, STAGING_SUPABASE_ANON_KEY, STAGING_TEACHER_A_JWT, STAGING_TEACHER_B_JWT, STAGING_STUDENT_A_JWT and STAGING_TASK_ID, STAGING_PERFORMANCE_ID, STAGING_MEETING_ID, STAGING_ACTION_ITEM_ID, STAGING_GOAL_ID, STAGING_TOPIC_PERFORMANCE_ID. Do not paste JWTs into logs or reports.
- [ ] Run `npm run test:staging`. This is a live staging script with attempted unauthorized writes; never target production. It requires nonempty fixtures so an empty database cannot falsely pass isolation checks.
- [ ] Confirm Student A/Teacher A can read the fixtures; Teacher B cannot. Additionally check Student A cannot read a known second student's fixture (manual cross-student test).
- [ ] Confirm unauthorized task/meeting teacher fields, goal creator and topic owner updates fail; student role and mentor changes fail. Compare the fixture values after attempted writes as defense in depth.
- [ ] All authenticated roles must receive permission errors for ai_mentor_usage and both telemetry RPCs. Service-role is confined to telemetry in the Edge Function; academic reads use user JWT/RLS.
- [ ] Edge OPTIONS succeeds; missing JWT rejected; invalid studentId is 400; student and wrong mentor are 403. The gateway may reject a missing JWT before application error normalization.
- [ ] For a dedicated mentor with no prior quota use: set RUN_RATE_LIMIT=yes and STAGING_SUPABASE_SERVICE_ROLE_KEY, then `npm run test:staging`. Expected: four concurrent RPC claims, three allowed with distinct IDs and one denied. Claims are completed as failed synthetic attempts and consume real staging quota. This tests DB atomicity, without OpenAI costs. Clear RUN_RATE_LIMIT afterward.
- [ ] In a separate run with available quota, set RUN_OPENAI=yes and run `npm run test:staging`. Exactly one correct-mentor paid call should return schema-valid output, generatedAt and fingerprint. Clear RUN_OPENAI afterward.
- [ ] Inspect staging operational telemetry: status, tokens, model and latency present; no prompt/context/student names or meeting notes. Inspect as privileged operator, never grant UI access.
- [ ] On disposable local Edge only: omit OPENAI_API_KEY from the private env and restart to verify NOT_CONFIGURED/503; use a deliberately invalid provider credential for PROVIDER_UNAVAILABLE/502. Restore config and verify success. Timeout/malformed-provider cases are covered locally by injected-fetch tests; hosted end-to-end fault injection is not claimed.
- [ ] Refresh student academic data and confirm stale warning plus manual refresh; no automatic AI request. AI failure leaves deterministic summary usable.

## Production and post-deploy

- [ ] **Gate:** attach passing real staging results (RLS, fresh and incremental migrations, Edge, concurrency, AI) and dependency risk decision. Without these, NO-GO.
- [ ] Verify production ref separately; back up; review exact pending migration dry-run. Apply only reviewed pending SQL, configure production secrets, deploy Edge, then the verified frontend artifact. Do not reuse the staging command block blindly.
- [ ] Smoke: login/logout, Student Dashboard, Teacher Dashboard, task creation/completion, meeting scheduling/outcome/follow-up, goal save, topic performance, alerts and one authorized AI request.
- [ ] Mobile widths 320/375/768: no horizontal overflow; bottom navigation does not obscure controls; chart containers shrink. Keyboard tab order, role selection, labels, loading disable, safe error/empty/insufficient-data states.
- [ ] Monitor normalized Edge failures and quota metadata, without student payload logs. Check SPA deep-link reloads and old-to-new release lazy chunk recovery.

## Rollback

Keep the previous frontend and Edge artifact. Roll back application/Edge first if compatible; preserve additive data and usage history. Do not DROP tables or reset a linked DB. Restore grants/functions from the reviewed pre-deploy dump only with operator approval and a tested restore plan. Reconcile migration ledger explicitly; never conceal a partially applied migration with blind repair. If a real privileged secret was exposed, rotate it through the owner-controlled process; removing it from Git does not erase history.

References: [Supabase CLI](https://supabase.com/docs/reference/cli/introduction), [Supabase migrations](https://supabase.com/docs/guides/deployment/database-migrations), [Vite production deployment](https://vite.dev/guide/static-deploy).
