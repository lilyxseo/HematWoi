create table if not exists public.budget_categories (
  budget_id uuid not null references public.budgets (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (budget_id, category_id)
);

create index if not exists budget_categories_category_idx
  on public.budget_categories (category_id);

alter table public.budget_categories enable row level security;

create policy if not exists "Budget categories select"
  on public.budget_categories
  for select
  using (
    exists (
      select 1
      from public.budgets b
      where b.id = budget_categories.budget_id
        and b.user_id = auth.uid()
    )
  );

create policy if not exists "Budget categories insert"
  on public.budget_categories
  for insert
  with check (
    exists (
      select 1
      from public.budgets b
      where b.id = budget_categories.budget_id
        and b.user_id = auth.uid()
    )
  );

create policy if not exists "Budget categories delete"
  on public.budget_categories
  for delete
  using (
    exists (
      select 1
      from public.budgets b
      where b.id = budget_categories.budget_id
        and b.user_id = auth.uid()
    )
  );

insert into public.budget_categories (budget_id, category_id)
select b.id, b.category_id
from public.budgets b
where b.category_id is not null
on conflict (budget_id, category_id) do nothing;
