-- Triggers and RPC for linking Supabase Auth users to application profiles
-- Run this after you've applied sql/schema.sql (which creates the 'profiles' table)

create or replace function public.handle_auth_user()
returns trigger as $$
begin
  -- Insert a profiles row for the new auth user.
  -- Read username and role from user_metadata (set during signUp from frontend).
  -- Fallback: username = email, role = 'student'
  insert into public.profiles (id, username, role, created_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'student'),
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Attach to Supabase auth.users
drop trigger if exists auth_user_insert on auth.users;
create trigger auth_user_insert
after insert on auth.users
for each row execute function public.handle_auth_user();

-- RPC: student joins a teacher by invite code (join_code stored in profiles.join_code)
create or replace function public.join_teacher_by_code(p_code text)
returns void as $$
declare
  v_teacher_id uuid;
begin
  select id into v_teacher_id from public.profiles where join_code = p_code and role = 'teacher' limit 1;
  if v_teacher_id is null then
    raise exception 'Invalid invite code';
  end if;

  update public.profiles
  set mentor_id = v_teacher_id
  where id = auth.uid()::uuid;

  return;
end;
$$ language plpgsql security definer;

grant execute on function public.join_teacher_by_code(text) to authenticated;
