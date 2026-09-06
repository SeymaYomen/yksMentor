# YKS Mentor V1

React, TypeScript, Vite, Tailwind and Supabase mentor/student application.

## Local setup

Use Node 22+ and install the locked dependencies:

```sh
npm ci
```

Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the intended development project. These are public client settings. Never use a service-role key in the browser. Start with `npm run dev`.

## Database and Edge

The canonical migration chain is in `sql/migrations`. Run `npm run prepare:migrations` to prepare Supabase CLI copies, then follow the fresh/existing database procedures in [V1 release checklist](docs/V1_RELEASE_CHECKLIST.md). Do not use legacy `sql/schema.sql`: it drops tables. Do not reapply the legacy auth/RLS scripts after the secure migrations.

`mentor-ai-insight` verifies user JWT, teacher role and student ownership; academic data stays under RLS. Server-only secret names: OPENAI_API_KEY, OPENAI_MODEL, SUPABASE_SERVICE_ROLE_KEY. Optional limits: AI_MENTOR_MINUTE_LIMIT, AI_MENTOR_DAILY_LIMIT, AI_MENTOR_TIMEOUT_MS. See the [Edge README](supabase/functions/mentor-ai-insight/README.md) and release checklist for local serve/deployment. No real secrets belong in the repository.

## Validation and deployment

```sh
npm test
npm run typecheck
npm run build
npm run check:secrets -- --bundle
npm run preview -- --host 127.0.0.1
```

Host `dist` over HTTPS with SPA deep-link fallback to `/index.html`; configure Supabase Auth Site URL/redirect allowlist. Vite preview is a local smoke server, not the production host. Retain previous hashed assets during rollout.

`npm run test:staging` requires explicitly confirmed staging settings and disposable fixtures; it never runs as part of `npm test`. Real OpenAI/concurrency checks are separately opt-in. Production release remains gated on real staging evidence; see [release audit](docs/V1_RELEASE_AUDIT.md) and [checklist](docs/V1_RELEASE_CHECKLIST.md).
