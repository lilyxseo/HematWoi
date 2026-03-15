alter table if exists public.budgets
  add column if not exists name text;

update public.budgets b
set name = coalesce(nullif(trim(b.name), ''), nullif(trim(c.name), ''), 'Budget Tanpa Nama')
from public.categories c
where b.category_id = c.id
  and coalesce(nullif(trim(b.name), ''), '') = '';

update public.budgets
set name = 'Budget Tanpa Nama'
where coalesce(nullif(trim(name), ''), '') = '';

create table if not exists public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  budget_id uuid not null references public.budgets (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (budget_id, category_id)
);

create index if not exists budget_categories_user_idx on public.budget_categories (user_id);
create index if not exists budget_categories_budget_idx on public.budget_categories (budget_id);
create index if not exists budget_categories_category_idx on public.budget_categories (category_id);

alter table public.budget_categories enable row level security;

create policy if not exists "Budget categories select" on public.budget_categories
  for select using (user_id = auth.uid());

create policy if not exists "Budget categories insert" on public.budget_categories
  for insert with check (user_id = auth.uid());

create policy if not exists "Budget categories update" on public.budget_categories
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy if not exists "Budget categories delete" on public.budget_categories
  for delete using (user_id = auth.uid());

insert into public.budget_categories (user_id, budget_id, category_id)
select b.user_id, b.id, b.category_id
from public.budgets b
left join public.budget_categories bc
  on bc.budget_id = b.id and bc.category_id = b.category_id
where b.category_id is not null
  and bc.id is null;

create or replace function public.bud_monthly_upsert(
  p_category_id uuid,
  p_month date,
  p_amount numeric,
  p_carryover_enabled boolean default false,
  p_notes text default null,
  p_name text default null,
  p_budget_id uuid default null
) returns public.budgets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_amount numeric := p_amount;
  v_month date := p_month;
  v_notes text := nullif(btrim(p_notes), '');
  v_name text := coalesce(nullif(btrim(p_name), ''), 'Budget Tanpa Nama');
  v_carryover boolean := coalesce(p_carryover_enabled, false);
  v_budget public.budgets;
begin
  if v_user_id is null then
    raise exception 'User tidak terautentik' using errcode = 'P0001';
  end if;

  if p_category_id is null then
    raise exception 'Kategori wajib dipilih' using errcode = 'P0001';
  end if;

  if v_month is null then
    raise exception 'Tanggal bulan wajib diisi' using errcode = 'P0001';
  end if;

  if date_trunc('month', v_month)::date <> v_month then
    raise exception 'Tanggal bulan harus hari pertama bulan (YYYY-MM-01)' using errcode = 'P0001';
  end if;

  if v_amount is null then
    raise exception 'Nominal anggaran wajib diisi' using errcode = 'P0001';
  end if;

  if v_amount <= 0 then
    raise exception 'Nominal anggaran harus lebih besar dari 0' using errcode = 'P0001';
  end if;

  if p_budget_id is not null then
    update public.budgets
    set
      category_id = p_category_id,
      amount_planned = v_amount,
      carryover_enabled = v_carryover,
      notes = v_notes,
      name = v_name,
      budget_type = 'monthly',
      month = v_month,
      period_month = v_month,
      updated_at = timezone('utc', now()),
      rev = coalesce(public.budgets.rev, 0) + 1
    where id = p_budget_id
      and user_id = v_user_id
    returning * into v_budget;

    if found then
      return v_budget;
    end if;
  end if;

  insert into public.budgets (
    user_id,
    month,
    category_id,
    amount_planned,
    carryover_enabled,
    notes,
    name,
    budget_type,
    period_month
  )
  values (
    v_user_id,
    v_month,
    p_category_id,
    v_amount,
    v_carryover,
    v_notes,
    v_name,
    'monthly',
    v_month
  )
  on conflict (user_id, month, category_id)
  do update
    set amount_planned = excluded.amount_planned,
        carryover_enabled = excluded.carryover_enabled,
        notes = excluded.notes,
        name = excluded.name,
        budget_type = 'monthly',
        month = excluded.month,
        period_month = excluded.period_month,
        updated_at = timezone('utc', now()),
        rev = coalesce(public.budgets.rev, 0) + 1
  returning * into v_budget;

  return v_budget;
end;
$$;

grant execute on function public.bud_monthly_upsert(uuid, date, numeric, boolean, text, text, uuid) to authenticated;
