create table if not exists public.user_highlight_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  budget_type text not null check (budget_type in ('monthly','weekly')),
  budget_id uuid not null,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists user_highlight_budgets_unique
  on public.user_highlight_budgets (user_id, budget_type, budget_id);

create index if not exists user_highlight_budgets_user_created_idx
  on public.user_highlight_budgets (user_id, created_at);

create or replace function public.user_highlight_budgets_enforce_limit()
returns trigger
language plpgsql
as $$
declare
  total integer;
begin
  if tg_op = 'UPDATE' then
    select count(*)
    into total
    from public.user_highlight_budgets
    where user_id = new.user_id
      and id <> old.id;
  else
    select count(*)
    into total
    from public.user_highlight_budgets
    where user_id = new.user_id;
  end if;

  if total >= 2 then
    raise exception 'Maks. 2 highlight' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists user_highlight_budgets_limit on public.user_highlight_budgets;
create trigger user_highlight_budgets_limit
before insert or update on public.user_highlight_budgets
for each row
execute function public.user_highlight_budgets_enforce_limit();

alter table public.user_highlight_budgets enable row level security;

create policy if not exists "User highlight select" on public.user_highlight_budgets
  for select using (user_id = auth.uid());

create policy if not exists "User highlight modify" on public.user_highlight_budgets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
