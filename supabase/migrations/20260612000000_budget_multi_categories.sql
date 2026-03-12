-- Support 1 monthly budget linked to many categories

create table if not exists public.budget_categories (
  budget_id uuid not null references public.budgets(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
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

create policy if not exists "Budget categories modify"
  on public.budget_categories
  for all
  using (
    exists (
      select 1
      from public.budgets b
      where b.id = budget_categories.budget_id
        and b.user_id = auth.uid()
    )
  )
  with check (
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

create or replace function public.bud_monthly_upsert_multi(
  p_category_id uuid,
  p_category_ids uuid[] default null,
  p_month date,
  p_amount numeric,
  p_carryover_enabled boolean default false,
  p_notes text default null
) returns public.budgets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_month date := p_month;
  v_amount numeric := p_amount;
  v_notes text := nullif(btrim(p_notes), '');
  v_carryover boolean := coalesce(p_carryover_enabled, false);
  v_category_ids uuid[];
  v_primary_category uuid;
  v_budget public.budgets;
begin
  if v_user_id is null then
    raise exception 'User tidak terautentik' using errcode = 'P0001';
  end if;

  if v_month is null or date_trunc('month', v_month)::date <> v_month then
    raise exception 'Tanggal bulan harus hari pertama bulan (YYYY-MM-01)' using errcode = 'P0001';
  end if;

  if v_amount is null or v_amount <= 0 then
    raise exception 'Nominal anggaran harus lebih besar dari 0' using errcode = 'P0001';
  end if;

  v_category_ids := array(
    select distinct unnest(coalesce(p_category_ids, array[]::uuid[]))
  );

  if p_category_id is not null then
    v_category_ids := array(
      select distinct x
      from unnest(array_append(v_category_ids, p_category_id)) as x
      where x is not null
    );
  end if;

  if coalesce(array_length(v_category_ids, 1), 0) = 0 then
    raise exception 'Pilih minimal 1 kategori' using errcode = 'P0001';
  end if;

  v_primary_category := coalesce(p_category_id, v_category_ids[1]);

  insert into public.budgets (
    user_id,
    month,
    category_id,
    amount_planned,
    carryover_enabled,
    notes,
    budget_type,
    period_month
  )
  values (
    v_user_id,
    v_month,
    v_primary_category,
    v_amount,
    v_carryover,
    v_notes,
    'monthly',
    v_month
  )
  on conflict (user_id, month, category_id)
  do update
    set amount_planned = excluded.amount_planned,
        carryover_enabled = excluded.carryover_enabled,
        notes = excluded.notes,
        budget_type = 'monthly',
        month = excluded.month,
        period_month = excluded.period_month,
        updated_at = timezone('utc', now()),
        rev = coalesce(public.budgets.rev, 0) + 1
  returning * into v_budget;

  delete from public.budget_categories where budget_id = v_budget.id;

  insert into public.budget_categories (budget_id, category_id)
  select v_budget.id, x
  from unnest(v_category_ids) as x
  on conflict (budget_id, category_id) do nothing;

  return v_budget;
end;
$$;

grant execute on function public.bud_monthly_upsert_multi(uuid, uuid[], date, numeric, boolean, text) to authenticated;
