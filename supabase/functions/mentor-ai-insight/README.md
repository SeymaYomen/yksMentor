# AI Mentor Insight Edge Function

Bu fonksiyon yalnız mentor tarafından açıkça tetiklendiğinde çalışır. İstemciden yalnız `studentId` alır; oturumu, teacher rolünü ve mentor–öğrenci ilişkisini sunucuda doğrular. Akademik context mevcut domain motorlarıyla sunucuda oluşturulur.

OpenAI anahtarını kök `.env` dosyasına veya herhangi bir `VITE_*` değişkenine eklemeyin. Secret'ları Supabase Function ortamına tanımlayın:

```sh
supabase secrets set OPENAI_API_KEY=... OPENAI_MODEL=...
supabase functions deploy mentor-ai-insight
```

`OPENAI_MODEL`, hesabınızda Responses API ve Structured Outputs destekleyen bir model kimliği olmalıdır.

## Production hardening

Required Edge environment: `OPENAI_API_KEY`, `OPENAI_MODEL`, `SUPABASE_SERVICE_ROLE_KEY`.
Supabase also supplies `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Never put provider or service-role secrets in `VITE_*` variables.

Optional settings:

| Variable | Default | Bounds |
| --- | --- | --- |
| AI_MENTOR_MINUTE_LIMIT | 3 | 1-60 |
| AI_MENTOR_DAILY_LIMIT | 30 | minute limit-1000 |
| AI_MENTOR_TIMEOUT_MS | 20000 | 5000-60000 |

Apply `sql/migrations/202609020002_ai_mentor_usage.sql` using the project's database migration process before deploying. The SQL directory is not automatically applied by `supabase functions deploy`.

Store local secrets in an ignored file outside the repository. Example commands (replace placeholders locally):

```sh
supabase secrets set --env-file /path/to/private/mentor.env
supabase functions serve mentor-ai-insight --env-file /path/to/private/mentor.env
supabase functions deploy mentor-ai-insight
```

Keep JWT verification enabled. Requests contain only `{ "studentId": "<uuid>" }` and a user Bearer JWT. Teacher role and mentor ownership are checked before reserving usage. Academic queries use this JWT and RLS; the service-role client calls only `claim_ai_mentor_request` and `complete_ai_mentor_request`.

Limits apply per authenticated mentor across students, using rolling one-minute and 24-hour windows. All claimed attempts, including failed requests, consume quota. An advisory transaction lock serializes concurrent claims. HTTP 429 returns `RATE_LIMITED` and `retryAfterSeconds` (60 seconds for minute limits; 3600 seconds before retrying daily limits, which may still be exhausted).

Telemetry contains teacher ID, timestamps, provider/model, status, token counts, latency and normalized error code only. No prompts, context, student identifiers/names or meeting notes are stored. Completion is best effort: a failed telemetry write does not replace the main response; an interrupted invocation can leave a `started` record, which still consumes quota. No retention job is included.

Provider timeout covers fetch and response body reading. Errors return a stable `code` without raw provider messages. Missing token usage is recorded as null. AI output is schema validated.

The UI compares shared stable-serialization SHA-256 context fingerprints, ignores obsolete asynchronous hash results, and offers manual refresh when data changes. No automatic AI call or persistent AI cache is introduced.

Validation: `npm test`, `npx tsc --noEmit`, `npm run build`. With Deno installed, run `deno check supabase/functions/mentor-ai-insight/index.ts`. Migration privilege tests are source-contract checks; verify grants/RLS and concurrent claims on a local Supabase database before production rollout.
