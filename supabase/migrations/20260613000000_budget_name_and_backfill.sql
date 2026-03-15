alter table public.budgets
  add column if not exists name text;

update public.budgets b
set name = c.name
from public.categories c
where b.name is null
  and b.category_id = c.id;

update public.budgets
set name = 'Budget Tanpa Nama'
where name is null;
