-- ACCOUNTS TABLE + RLS
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('cash','bank','ewallet','other')),
  currency text not null default 'IDR',
  created_at timestamptz not null default now()
);

create index if not exists idx_accounts_user_created on public.accounts(user_id, created_at desc);
create unique index if not exists uniq_accounts_user_name on public.accounts(user_id, name);

alter table public.accounts enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'accounts' and policyname = 'accounts_select_own') then
    create policy accounts_select_own on public.accounts
      for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'accounts' and policyname = 'accounts_insert_own') then
    create policy accounts_insert_own on public.accounts
      for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'accounts' and policyname = 'accounts_update_own') then
    create policy accounts_update_own on public.accounts
      for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'accounts' and policyname = 'accounts_delete_own') then
    create policy accounts_delete_own on public.accounts
      for delete using (auth.uid() = user_id);
  end if;
end $$;
