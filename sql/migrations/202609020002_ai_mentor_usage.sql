-- YKS Mentor - production-safe AI usage telemetry and atomic rate limiting
-- Stores operational metadata only; prompts, academic context and student data are excluded.

begin;

create table if not exists public.ai_mentor_usage (
  id bigint generated always as identity primary key,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  provider text not null,
  model text not null,
  request_status text not null default 'started',
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  latency_ms integer,
  error_code text,
  constraint ai_mentor_usage_provider_check check (length(btrim(provider)) between 1 and 50),
  constraint ai_mentor_usage_model_check check (length(btrim(model)) between 1 and 100),
  constraint ai_mentor_usage_status_check check (request_status in ('started', 'succeeded', 'failed')),
  constraint ai_mentor_usage_input_tokens_check check (input_tokens is null or input_tokens >= 0),
  constraint ai_mentor_usage_output_tokens_check check (output_tokens is null or output_tokens >= 0),
  constraint ai_mentor_usage_total_tokens_check check (total_tokens is null or total_tokens >= 0),
  constraint ai_mentor_usage_latency_check check (latency_ms is null or latency_ms >= 0),
  constraint ai_mentor_usage_error_code_check check (error_code is null or length(error_code) <= 100)
);

create index if not exists ai_mentor_usage_teacher_created_idx
  on public.ai_mentor_usage(teacher_id, created_at desc);

alter table public.ai_mentor_usage enable row level security;
revoke all on table public.ai_mentor_usage from public, anon, authenticated;
grant select, insert, update on table public.ai_mentor_usage to service_role;

-- Serializes claims per mentor with a transaction-scoped advisory lock. Only the
-- server-side Edge Function service client can call this RPC.
create or replace function public.claim_ai_mentor_request(
  p_teacher_id uuid,
  p_provider text,
  p_model text,
  p_minute_limit integer default 3,
  p_daily_limit integer default 30
)
returns table (
  allowed boolean,
  usage_id bigint,
  minute_count integer,
  daily_count integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_minute_limit integer := least(greatest(coalesce(p_minute_limit, 3), 1), 60);
  v_daily_limit integer;
  v_minute_count integer;
  v_daily_count integer;
  v_usage_id bigint;
begin
  v_daily_limit := least(greatest(coalesce(p_daily_limit, 30), v_minute_limit), 1000);
  if p_teacher_id is null or not exists (
    select 1 from public.profiles profile where profile.id = p_teacher_id and profile.role = 'teacher'
  ) then
    raise exception 'Geçerli mentor gerekli.';
  end if;
  if nullif(btrim(p_provider), '') is null or nullif(btrim(p_model), '') is null then
    raise exception 'Provider ve model gerekli.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_teacher_id::text, 824631));
  v_now := clock_timestamp();

  select count(*)::integer into v_minute_count
  from public.ai_mentor_usage usage
  where usage.teacher_id = p_teacher_id
    and usage.created_at > v_now - interval '1 minute';

  select count(*)::integer into v_daily_count
  from public.ai_mentor_usage usage
  where usage.teacher_id = p_teacher_id
    and usage.created_at > v_now - interval '24 hours';

  if v_minute_count >= v_minute_limit then
    return query select false, null::bigint, v_minute_count, v_daily_count, 60;
    return;
  end if;
  if v_daily_count >= v_daily_limit then
    return query select false, null::bigint, v_minute_count, v_daily_count, 3600;
    return;
  end if;

  insert into public.ai_mentor_usage (teacher_id, provider, model, request_status, created_at)
  values (p_teacher_id, btrim(p_provider), btrim(p_model), 'started', v_now)
  returning id into v_usage_id;

  return query select true, v_usage_id, v_minute_count + 1, v_daily_count + 1, 0;
end;
$$;

create or replace function public.complete_ai_mentor_request(
  p_usage_id bigint,
  p_request_status text,
  p_model text,
  p_input_tokens integer default null,
  p_output_tokens integer default null,
  p_total_tokens integer default null,
  p_latency_ms integer default null,
  p_error_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  if p_request_status not in ('succeeded', 'failed') then
    raise exception 'Geçersiz AI istek durumu.';
  end if;

  update public.ai_mentor_usage
  set request_status = p_request_status,
      model = coalesce(nullif(btrim(p_model), ''), model),
      input_tokens = case when p_input_tokens is null then null else greatest(p_input_tokens, 0) end,
      output_tokens = case when p_output_tokens is null then null else greatest(p_output_tokens, 0) end,
      total_tokens = case when p_total_tokens is null then null else greatest(p_total_tokens, 0) end,
      latency_ms = case when p_latency_ms is null then null else greatest(p_latency_ms, 0) end,
      error_code = case when p_error_code is null then null else left(p_error_code, 100) end
  where id = p_usage_id
    and request_status = 'started';

  return found;
end;
$$;

revoke all on function public.claim_ai_mentor_request(uuid, text, text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.complete_ai_mentor_request(bigint, text, text, integer, integer, integer, integer, text)
  from public, anon, authenticated;
grant execute on function public.claim_ai_mentor_request(uuid, text, text, integer, integer)
  to service_role;
grant execute on function public.complete_ai_mentor_request(bigint, text, text, integer, integer, integer, integer, text)
  to service_role;

commit;

-- Rollback guidance (manual): drop the two RPCs, then the index/table. No student
-- domain data depends on this operational telemetry table.
