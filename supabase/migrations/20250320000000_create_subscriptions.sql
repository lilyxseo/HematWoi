create extension if not exists "pgcrypto";

create or replace function public.month_start(value date)
returns date
language sql
immutable
as $$
  select date_trunc('month', value)::date;
$$;

create or replace function public.month_start(value timestamptz)
returns date
language sql
immutable
as $$
  select date_trunc('month', value)::date;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.set_user_id_default()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is null then
    new.user_id = auth.uid();
  end if;
  return new;
end;
$$;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  vendor text,
  category_id uuid references public.categories (id) on delete set null,
  account_id uuid references public.accounts (id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'IDR',
  interval_unit text not null default 'month' check (interval_unit in ('day','week','month','year')),
  interval_count integer not null default 1 check (interval_count >= 1),
  anchor_date date not null,
  anchor_day_of_week integer check (anchor_day_of_week between 0 and 6),
  start_date date,
  end_date date,
  trial_end date,
  status text not null default 'active' check (status in ('active','paused','canceled')),
  reminder_days smallint[] not null default '{}',
  tags text[] not null default '{}',
  color text,
  icon text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  next_due_date date,
  last_charge_at date,
  total_charges integer not null default 0,
  active bool generated always as (status = 'active') stored
);

create index if not exists subscriptions_user_idx on public.subscriptions (user_id, created_at desc);
create index if not exists subscriptions_status_idx on public.subscriptions (user_id, status, next_due_date);
create index if not exists subscriptions_category_idx on public.subscriptions (user_id, category_id);
create index if not exists subscriptions_account_idx on public.subscriptions (user_id, account_id);

create table if not exists public.subscription_charges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  due_date date not null,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'IDR',
  status text not null default 'due' check (status in ('due','paid','skipped','canceled','overdue')),
  paid_at timestamptz,
  transaction_id uuid references public.transactions (id) on delete set null,
  notes text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (subscription_id, due_date)
);

create index if not exists subscription_charges_user_due_idx on public.subscription_charges (user_id, due_date);
create index if not exists subscription_charges_status_idx on public.subscription_charges (user_id, status);
create index if not exists subscription_charges_subscription_idx on public.subscription_charges (subscription_id, due_date);

create table if not exists public.subscription_skips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  due_date date not null,
  reason text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists subscription_skips_user_idx on public.subscription_skips (user_id, subscription_id, due_date desc);

create or replace function public.handle_subscription_charge_change()
returns trigger
language plpgsql
as $$
declare
  target record;
begin
  target := coalesce(new, old);
  if target is null then
    return null;
  end if;

  update public.subscriptions s
     set updated_at = timezone('utc', now()),
         next_due_date = (
           select min(c2.due_date)
           from public.subscription_charges c2
           where c2.subscription_id = target.subscription_id
             and c2.user_id = target.user_id
             and c2.status in ('due','overdue')
         ),
         last_charge_at = (
           select max(c3.due_date)
           from public.subscription_charges c3
           where c3.subscription_id = target.subscription_id
             and c3.user_id = target.user_id
             and c3.status = 'paid'
         ),
         total_charges = (
           select count(*)
           from public.subscription_charges c4
           where c4.subscription_id = target.subscription_id
             and c4.user_id = target.user_id
         )
   where s.id = target.subscription_id
     and s.user_id = target.user_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row
execute function public.set_updated_at();

drop trigger if exists subscriptions_set_user_id on public.subscriptions;
create trigger subscriptions_set_user_id
before insert on public.subscriptions
for each row
execute function public.set_user_id_default();

drop trigger if exists subscription_charges_set_updated_at on public.subscription_charges;
create trigger subscription_charges_set_updated_at
before update on public.subscription_charges
for each row
execute function public.set_updated_at();

drop trigger if exists subscription_charges_set_user_id on public.subscription_charges;
create trigger subscription_charges_set_user_id
before insert on public.subscription_charges
for each row
execute function public.set_user_id_default();

drop trigger if exists subscription_charges_after_change on public.subscription_charges;
create trigger subscription_charges_after_change
after insert or update or delete on public.subscription_charges
for each row
execute function public.handle_subscription_charge_change();

drop trigger if exists subscription_skips_set_user_id on public.subscription_skips;
create trigger subscription_skips_set_user_id
before insert on public.subscription_skips
for each row
execute function public.set_user_id_default();

create or replace view public.subscriptions_forecast_month as
select
  c.user_id,
  public.month_start(c.due_date) as period_month,
  count(*) filter (where c.status in ('due','overdue')) as due_count,
  sum(c.amount) filter (where c.status in ('due','overdue')) as due_amount,
  count(*) filter (where c.status = 'paid') as paid_count,
  sum(c.amount) filter (where c.status = 'paid') as paid_amount,
  count(*) filter (where c.status = 'skipped') as skipped_count,
  sum(c.amount) filter (where c.status = 'skipped') as skipped_amount
from public.subscription_charges c
where c.due_date is not null
  and c.user_id is not null
group by 1,2;

alter table public.subscriptions enable row level security;
alter table public.subscription_charges enable row level security;
alter table public.subscription_skips enable row level security;

create policy if not exists "Subscriptions select" on public.subscriptions
  for select using (user_id = auth.uid());

create policy if not exists "Subscriptions modify" on public.subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy if not exists "Subscription charges select" on public.subscription_charges
  for select using (user_id = auth.uid());

create policy if not exists "Subscription charges modify" on public.subscription_charges
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy if not exists "Subscription skips select" on public.subscription_skips
  for select using (user_id = auth.uid());

create policy if not exists "Subscription skips modify" on public.subscription_skips
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
