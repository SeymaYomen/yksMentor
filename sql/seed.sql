-- Seed data for YKS Mentor MVP
-- Run this in Supabase SQL editor after applying schema.sql

insert into profiles (id, username, password_hash, role, join_code)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ogretmen1', 'ogretmen123', 'teacher', 'MENTOR123');

insert into profiles (id, username, password_hash, role, mentor_id)
values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'emre', 'sifre123', 'student', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- Notes:
-- The project uses a trigger to hash password_hash on insert/update.
-- Teacher join_code = MENTOR123
-- Student mentor_id references the teacher above.
