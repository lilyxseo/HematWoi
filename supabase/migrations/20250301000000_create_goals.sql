create extension if not exists "pgcrypto";

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 80),
  description text,
  target_amount numeric(14,2) not null check (target_amount > 0),
  saved_amount numeric(14,2) not null default 0,
  start_date timestamptz not null default timezone('utc', now()),
  due_date timestamptz,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'active' check (status in ('active','paused','achieved','archived')),
  category_id uuid references public.categories (id) on delete set null,
  color text not null default '#3898f8',
  icon text,
  milestones jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists goals_user_status_idx on public.goals (user_id, status);
create index if not exists goals_user_due_idx on public.goals (user_id, due_date);

create table if not exists public.goal_entries (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  date timestamptz not null default timezone('utc', now()),
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists goal_entries_goal_idx on public.goal_entries (goal_id);
create index if not exists goal_entries_user_date_idx on public.goal_entries (user_id, date desc);

create or replace function public.set_goal_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists goals_set_updated_at on public.goals;
create trigger goals_set_updated_at
before update on public.goals
for each row
execute function public.set_goal_updated_at();

create or replace function public.refresh_goal_totals()
returns trigger
language plpgsql
as $$
declare
  target_goal uuid;
  total_saved numeric(14,2);
  current_status text;
  target_amount numeric(14,2);
  next_status text;
begin
  target_goal := coalesce(new.goal_id, old.goal_id);
  if target_goal is null then
    return null;
  end if;

  select coalesce(sum(amount), 0) into total_saved
  from public.goal_entries
  where goal_id = target_goal;

  select status, target_amount into current_status, target_amount
  from public.goals
  where id = target_goal
  for update;

  next_status := current_status;
  if total_saved >= target_amount then
    next_status := 'achieved';
  elsif current_status = 'achieved' then
    next_status := 'active';
  end if;

  update public.goals
  set saved_amount = total_saved,
      status = next_status,
      updated_at = timezone('utc', now())
  where id = target_goal;

  return null;
end;
$$;

drop trigger if exists goal_entries_refresh_insert on public.goal_entries;
create trigger goal_entries_refresh_insert
after insert on public.goal_entries
for each row
execute function public.refresh_goal_totals();

drop trigger if exists goal_entries_refresh_update on public.goal_entries;
create trigger goal_entries_refresh_update
after update on public.goal_entries
for each row
execute function public.refresh_goal_totals();

drop trigger if exists goal_entries_refresh_delete on public.goal_entries;
create trigger goal_entries_refresh_delete
after delete on public.goal_entries
for each row
execute function public.refresh_goal_totals();

alter table public.goals enable row level security;
alter table public.goal_entries enable row level security;

drop policy if exists "Goals select" on public.goals;
drop policy if exists "Goals modify" on public.goals;
drop policy if exists "Goal entries select" on public.goal_entries;
drop policy if exists "Goal entries modify" on public.goal_entries;

create policy "Goals select"
  on public.goals
  for select
  using (user_id = auth.uid());

create policy "Goals insert"
  on public.goals
  for insert
  with check (user_id = auth.uid());

create policy "Goals update"
  on public.goals
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Goals delete"
  on public.goals
  for delete
  using (user_id = auth.uid());

create policy "Goal entries select"
  on public.goal_entries
  for select
  using (user_id = auth.uid());

create policy "Goal entries insert"
  on public.goal_entries
  for insert
  with check (user_id = auth.uid());

create policy "Goal entries update"
  on public.goal_entries
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Goal entries delete"
  on public.goal_entries
  for delete
  using (user_id = auth.uid());
