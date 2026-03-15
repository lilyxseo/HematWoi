alter table if exists public.budgets_weekly
  add column if not exists name text;

update public.budgets_weekly bw
set name = coalesce(nullif(btrim(c.name), ''), 'Budget Mingguan')
from public.categories c
where bw.category_id = c.id
  and (bw.name is null or btrim(bw.name) = '');

update public.budgets_weekly
set name = 'Budget Mingguan'
where name is null or btrim(name) = '';

alter table if exists public.budgets_weekly
  alter column name set not null;

create table if not exists public.weekly_budget_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  budget_weekly_id uuid not null references public.budgets_weekly (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (budget_weekly_id, category_id)
);

create index if not exists weekly_budget_categories_user_idx on public.weekly_budget_categories (user_id);
create index if not exists weekly_budget_categories_budget_idx on public.weekly_budget_categories (budget_weekly_id);
create index if not exists weekly_budget_categories_category_idx on public.weekly_budget_categories (category_id);

alter table public.weekly_budget_categories enable row level security;

create policy if not exists "Weekly budget categories select" on public.weekly_budget_categories
for select using (user_id = auth.uid());

create policy if not exists "Weekly budget categories insert" on public.weekly_budget_categories
for insert with check (user_id = auth.uid());

create policy if not exists "Weekly budget categories update" on public.weekly_budget_categories
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy if not exists "Weekly budget categories delete" on public.weekly_budget_categories
for delete using (user_id = auth.uid());

insert into public.weekly_budget_categories (user_id, budget_weekly_id, category_id)
select bw.user_id, bw.id, bw.category_id
from public.budgets_weekly bw
left join public.weekly_budget_categories wbc
  on wbc.budget_weekly_id = bw.id and wbc.category_id = bw.category_id
where bw.category_id is not null
  and wbc.id is null;

create or replace function public.bud_weekly_upsert(
  p_category_id uuid,
  p_week_start date,
  p_planned_amount numeric,
  p_carryover_enabled boolean default false,
  p_notes text default null,
  p_name text default null
) returns public.budgets_weekly
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_week_start date := p_week_start;
  v_amount numeric := p_planned_amount;
  v_notes text := nullif(btrim(p_notes), '');
  v_name text := nullif(btrim(p_name), '');
  v_carryover boolean := coalesce(p_carryover_enabled, false);
  v_budget public.budgets_weekly;
begin
  if v_user_id is null then
    raise exception 'User tidak terautentik' using errcode = 'P0001';
  end if;

  if p_category_id is null then
    raise exception 'Kategori wajib dipilih' using errcode = 'P0001';
  end if;

  if v_week_start is null then
    raise exception 'Tanggal mulai minggu wajib diisi' using errcode = 'P0001';
  end if;

  v_week_start := date_trunc('day', v_week_start)::date;

  if extract(dow from v_week_start) <> 1 then
    raise exception 'Tanggal mulai minggu harus hari Senin' using errcode = 'P0001';
  end if;

  if v_amount is null then
    raise exception 'Nominal anggaran wajib diisi' using errcode = 'P0001';
  end if;

  if v_amount < 0 then
    raise exception 'Nominal anggaran tidak boleh negatif' using errcode = 'P0001';
  end if;

  if v_name is null then
    select coalesce(nullif(btrim(c.name), ''), 'Budget Mingguan')
      into v_name
    from public.categories c
    where c.id = p_category_id;

    v_name := coalesce(v_name, 'Budget Mingguan');
  end if;

  insert into public.budgets_weekly (
    user_id,
    name,
    category_id,
    week_start,
    planned_amount,
    carryover_enabled,
    notes
  )
  values (
    v_user_id,
    v_name,
    p_category_id,
    v_week_start,
    v_amount,
    v_carryover,
    v_notes
  )
  on conflict (user_id, category_id, week_start)
  do update
    set name = excluded.name,
        planned_amount = excluded.planned_amount,
        carryover_enabled = excluded.carryover_enabled,
        notes = excluded.notes,
        updated_at = timezone('utc', now())
  returning * into v_budget;

  return v_budget;
end;
$$;

grant execute on function public.bud_weekly_upsert(uuid, date, numeric, boolean, text, text) to authenticated;
