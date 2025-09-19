create extension if not exists "pgcrypto";

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('debt','receivable')),
  party_name text not null,
  title text not null,
  date timestamptz not null default now(),
  due_date timestamptz,
  amount numeric(14,2) not null check (amount > 0),
  rate_percent numeric(5,2) default 0,
  paid_total numeric(14,2) not null default 0,
  status text not null default 'ongoing' check (status in ('ongoing','paid','overdue')),
  notes text,
  attachments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists debts_user_status_idx on public.debts (user_id, status);
create index if not exists debts_user_due_idx on public.debts (user_id, due_date);

create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.debts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  date timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create or replace function public.set_debts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists debts_updated_at on public.debts;
create trigger debts_updated_at
before update on public.debts
for each row
execute function public.set_debts_updated_at();
