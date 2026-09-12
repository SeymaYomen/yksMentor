-- Keep legacy values intact, but remove their shared API read surface.
begin;
create table public.meeting_private_notes (
  meeting_id uuid primary key references public.meetings(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id),
  note text not null check (length(note) <= 3000),
  updated_at timestamptz not null default now()
);
alter table public.meeting_private_notes enable row level security;
revoke all on public.meeting_private_notes from public, anon, authenticated;
grant select on public.meeting_private_notes to authenticated;
create policy teacher_private_read on public.meeting_private_notes for select to authenticated
  using (public.current_profile_role() = 'teacher' and teacher_id = auth.uid() and exists (
    select 1 from public.meetings m where m.id = meeting_id and m.teacher_id = auth.uid()
      and public.is_teacher_of(auth.uid(), m.student_id)
  ));

-- A table SELECT grant would override column-level protection. Grant only the
-- existing shared columns; no legacy text is copied, updated, or deleted.
revoke select on public.meetings from public, anon, authenticated;
revoke select (outcome_summary) on public.meetings from public, anon, authenticated;
grant select (id, teacher_id, student_id, title, description, meeting_url, scheduled_at, status, created_at)
  on public.meetings to authenticated;

create function public.read_meeting_private_note(p_meeting_id uuid)
returns text language plpgsql security definer set search_path = pg_catalog, public as $$
declare m public.meetings; v_note text;
begin
  select * into m from public.meetings where id = p_meeting_id;
  if not found or auth.uid() is null or public.current_profile_role() is distinct from 'teacher'
    or m.teacher_id <> auth.uid() or not public.is_teacher_of(auth.uid(), m.student_id) then
    raise exception 'Bu nota erişim yetkiniz yok.' using errcode = '42501';
  end if;
  select note into v_note from public.meeting_private_notes where meeting_id = m.id and teacher_id = auth.uid();
  if found then return v_note; end if;
  return m.outcome_summary;
end; $$;

-- Preserve the existing RPC name and completed-meeting lifecycle.
create or replace function public.save_meeting_outcome_summary(p_meeting_id uuid, p_summary text)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare m public.meetings;
begin
  select * into m from public.meetings where id = p_meeting_id for update;
  if not found or auth.uid() is null or public.current_profile_role() is distinct from 'teacher'
    or m.teacher_id <> auth.uid() or not public.is_teacher_of(auth.uid(), m.student_id) then
    raise exception 'Bu nota erişim yetkiniz yok.' using errcode = '42501';
  end if;
  if m.status <> 'completed' then raise exception 'Görüşme sonucu yalnızca tamamlanan görüşmelere eklenebilir.'; end if;
  insert into public.meeting_private_notes(meeting_id, teacher_id, note)
    values(m.id, auth.uid(), coalesce(btrim(p_summary), ''))
    on conflict (meeting_id) do update set note = excluded.note, teacher_id = excluded.teacher_id, updated_at = now();
end; $$;
revoke all on function public.read_meeting_private_note(uuid), public.save_meeting_outcome_summary(uuid,text) from public, anon, authenticated;
grant execute on function public.read_meeting_private_note(uuid), public.save_meeting_outcome_summary(uuid,text) to authenticated;
commit;
