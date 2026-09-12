-- Generated from the central mock-exam question-limit config.
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
    '{"TYT":{"Türkçe":40,"Matematik":40,"Fizik":7,"Kimya":7,"Biyoloji":6,"Tarih":5,"Coğrafya":5,"Felsefe":5,"Din Kültürü":5},"AYT":{"Matematik":40,"Fizik":14,"Kimya":13,"Biyoloji":13,"Türk Dili ve Edebiyatı":24,"Tarih":21,"Coğrafya":17,"Felsefe Grubu":12}}'::jsonb
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
