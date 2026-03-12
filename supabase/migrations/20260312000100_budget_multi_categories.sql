create table if not exists public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  budget_id uuid not null references public.budgets(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (budget_id, category_id)
);

create index if not exists budget_categories_user_idx
  on public.budget_categories(user_id, budget_id);

create index if not exists budget_categories_category_idx
  on public.budget_categories(user_id, category_id);

insert into public.budget_categories (user_id, budget_id, category_id)
select b.user_id, b.id, b.category_id
from public.budgets b
where b.category_id is not null
on conflict (budget_id, category_id) do nothing;

alter table public.budget_categories enable row level security;

create policy if not exists "Budget categories select" on public.budget_categories
  for select using (user_id = auth.uid());

create policy if not exists "Budget categories insert" on public.budget_categories
  for insert with check (user_id = auth.uid());

create policy if not exists "Budget categories update" on public.budget_categories
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy if not exists "Budget categories delete" on public.budget_categories
  for delete using (user_id = auth.uid());
