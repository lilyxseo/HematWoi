create or replace function public.bud_upsert(
  p_category_id uuid,
  p_amount_planned numeric,
  p_period_month date,
  p_carryover_enabled boolean default false,
  p_notes text default null
)
returns public.budgets
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_period_month date;
  v_note text;
  v_result public.budgets%rowtype;
  v_carry_rule text;
  v_carryover_enabled boolean;
  v_amount_column text;
  v_insert_columns text := 'user_id, period_month, category_id';
  v_insert_values text;
  v_update_columns text := 'category_id = excluded.category_id';
  v_sql text;
  v_has_carry_rule boolean := false;
  v_has_carryover_enabled boolean := false;
  v_has_note boolean := false;
  v_has_notes boolean := false;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception
      using message = 'Unauthorized', errcode = 'PGRST301';
  end if;

  if p_category_id is null then
    raise exception using message = 'Kategori wajib diisi.';
  end if;

  if p_period_month is null then
    raise exception using message = 'Periode anggaran wajib diisi.';
  end if;

  v_period_month := date_trunc('month', p_period_month::timestamptz)::date;
  v_carry_rule := case when coalesce(p_carryover_enabled, false) then 'carry-positive' else 'none' end;
  v_carryover_enabled := coalesce(p_carryover_enabled, false);
  v_note := nullif(trim(coalesce(p_notes, '')), '');

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'budgets'
      and column_name = 'carry_rule'
  ) into v_has_carry_rule;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'budgets'
      and column_name = 'carryover_enabled'
  ) into v_has_carryover_enabled;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'budgets'
      and column_name = 'note'
  ) into v_has_note;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'budgets'
      and column_name = 'notes'
  ) into v_has_notes;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'budgets'
      and column_name = 'planned'
  ) then
    v_amount_column := 'planned';
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'budgets'
      and column_name = 'amount_planned'
  ) then
    v_amount_column := 'amount_planned';
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'budgets'
      and column_name = 'planned_amount'
  ) then
    v_amount_column := 'planned_amount';
  else
    raise exception using message = 'Kolom nominal anggaran tidak ditemukan pada tabel budgets.';
  end if;

  v_insert_values := format('%L, %L, %L', v_user_id, v_period_month, p_category_id);
  v_insert_columns := v_insert_columns || format(', %I', v_amount_column);
  v_insert_values := v_insert_values || format(', %L', coalesce(p_amount_planned, 0));
  v_update_columns := v_update_columns || format(', %1$I = excluded.%1$I', v_amount_column);

  if v_has_carry_rule then
    v_insert_columns := v_insert_columns || ', carry_rule';
    v_insert_values := v_insert_values || format(', %L', v_carry_rule);
    v_update_columns := v_update_columns || ', carry_rule = excluded.carry_rule';
  elsif v_has_carryover_enabled then
    v_insert_columns := v_insert_columns || ', carryover_enabled';
    v_insert_values := v_insert_values || format(', %L', v_carryover_enabled);
    v_update_columns := v_update_columns || ', carryover_enabled = excluded.carryover_enabled';
  end if;

  if v_has_note then
    v_insert_columns := v_insert_columns || ', note';
    v_insert_values := v_insert_values || format(', %L', v_note);
    v_update_columns := v_update_columns || ', note = excluded.note';
  elsif v_has_notes then
    v_insert_columns := v_insert_columns || ', notes';
    v_insert_values := v_insert_values || format(', %L', v_note);
    v_update_columns := v_update_columns || ', notes = excluded.notes';
  end if;

  v_sql := format(
    'insert into public.budgets as b (%s) values (%s) ' ||
    'on conflict on constraint budgets_unique_per_key ' ||
    'do update set %s returning b.*',
    v_insert_columns,
    v_insert_values,
    v_update_columns
  );

  execute v_sql into v_result;

  return v_result;
end;
$$;

revoke all on function public.bud_upsert(uuid, numeric, date, boolean, text) from public;
grant execute on function public.bud_upsert(uuid, numeric, date, boolean, text) to authenticated;
