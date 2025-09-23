-- Add achievements column to user_profiles if it does not exist
alter table if exists public.user_profiles
  add column if not exists achievements jsonb not null default '[]'::jsonb;
