create extension if not exists "pgcrypto";

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period_month date not null check (date_trunc('month', period_month) = period_month),
  category_id uuid references public.categories (id) on delete set null,
  name text,
  category_key text generated always as (
    coalesce(
      category_id::text,
      lower(coalesce(nullif(trim(name), ''), 'custom'))
    )
  ) stored,
  planned numeric(14,2) not null default 0,
  rollover_in numeric(14,2) not null default 0,
  rollover_out numeric(14,2) not null default 0,
  carry_rule text not null default 'carry-positive' check (carry_rule in ('none','carry-positive','carry-all','reset-zero')),
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists budgets_user_period_idx on public.budgets (user_id, period_month desc);
create index if not exists budgets_user_category_idx on public.budgets (user_id, category_id);
create unique index if not exists budgets_unique_per_key on public.budgets (user_id, period_month, category_key);

create or replace function public.set_budget_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists budgets_set_updated_at on public.budgets;
create trigger budgets_set_updated_at
before update on public.budgets
for each row
execute function public.set_budget_updated_at();

create or replace view public.budget_activity as
select
  date_trunc('month', t.date) :: date as period_month,
  t.category_id,
  sum(case when t.type = 'expense' then t.amount else 0 end) as outflow,
  sum(case when t.type = 'income' then t.amount else 0 end) as inflow,
  coalesce(sum(case when t.type = 'expense' then t.amount else 0 end) - sum(case when t.type = 'income' then t.amount else 0 end), 0) as actual
from public.transactions t
where t.type in ('expense','income')
group by 1,2;

create table if not exists public.budget_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  rule_type text not null check (rule_type in ('percent-income','fixed','smart')),
  value numeric(10,2) not null,
  active boolean not null default true,
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_budget_rule_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists budget_rules_set_updated_at on public.budget_rules;
create trigger budget_rules_set_updated_at
before update on public.budget_rules
for each row
execute function public.set_budget_rule_updated_at();

create table if not exists public.budget_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  budget_id uuid not null references public.budgets (id) on delete cascade,
  delta numeric(14,2) not null,
  reason text,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.budgets enable row level security;
alter table public.budget_rules enable row level security;
alter table public.budget_changes enable row level security;

create policy if not exists "Budgets select" on public.budgets
  for select using (user_id = auth.uid());

create policy if not exists "Budgets insert" on public.budgets
  for insert with check (user_id = auth.uid());

create policy if not exists "Budgets update" on public.budgets
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy if not exists "Budgets delete" on public.budgets
  for delete using (user_id = auth.uid());

create policy if not exists "Budget rules select" on public.budget_rules
  for select using (user_id = auth.uid());

create policy if not exists "Budget rules modify" on public.budget_rules
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy if not exists "Budget changes select" on public.budget_changes
  for select using (user_id = auth.uid());

create policy if not exists "Budget changes insert" on public.budget_changes
  for insert with check (user_id = auth.uid());
