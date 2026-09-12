import { readFileSync, writeFileSync } from 'node:fs'
import ts from 'typescript'

function load(path) {
  const mod = { exports: {} }
  const source = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText

  new Function('module', 'exports', source)(mod, mod.exports)
  return mod.exports
}

const { EXAM_QUESTION_LIMITS } = load('src/lib/mockExams.ts')

const literal = value =>
  "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb"

const sql = `-- Generated from the central mock-exam question-limit config.
-- Existing rows are not rewritten. New inserts/updates must obey the limits.
begin;

create function public.check_exam_question_limit()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_limit integer;
begin
  select (
    ${literal(EXAM_QUESTION_LIMITS)}
    -> s.exam_type
    ->> s.name
  )::integer
  into v_limit
  from public.exam_subjects s
  where s.id = new.subject_id;

  if v_limit is null then
    raise exception 'Bu ders için soru sınırı tanımlanmamış.'
      using errcode = '23514';
  end if;

  if new.correct_count::bigint
     + new.wrong_count::bigint
     + new.blank_count::bigint > v_limit then
    raise exception 'Doğru, yanlış ve boş toplamı dersin soru sınırını aşamaz.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger enforce_exam_question_limit
before insert or update
on public.mock_exam_subject_results
for each row
execute function public.check_exam_question_limit();

revoke all
on function public.check_exam_question_limit()
from public, anon, authenticated;

commit;
`

writeFileSync(
  'sql/migrations/202609120002_integration_validation.sql',
  sql,
)