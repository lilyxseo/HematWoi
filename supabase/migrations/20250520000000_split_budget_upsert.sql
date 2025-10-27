-- Split budget upsert RPCs for monthly and weekly budgets

-- Clean up legacy function if it exists
DROP FUNCTION IF EXISTS public.bud_upsert();
DROP FUNCTION IF EXISTS public.bud_upsert(uuid, date, numeric, boolean, text);
DROP FUNCTION IF EXISTS public.bud_upsert(uuid, date, numeric, boolean);
DROP FUNCTION IF EXISTS public.bud_upsert(jsonb);

-- Ensure unique indexes for idempotent upserts
CREATE UNIQUE INDEX IF NOT EXISTS ux_budgets_user_month_cat
  ON public.budgets(user_id, month, category_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_budgets_weekly_user_cat_week
  ON public.budgets_weekly(user_id, category_id, week_start);

-- Ensure RLS stays enabled and select policies exist
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets_weekly ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'budgets'
      AND policyname = 'Budgets select'
  ) THEN
    EXECUTE 'CREATE POLICY "Budgets select" ON public.budgets FOR SELECT USING (user_id = auth.uid())';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'budgets_weekly'
      AND policyname = 'Budgets weekly select'
  ) THEN
    EXECUTE 'CREATE POLICY "Budgets weekly select" ON public.budgets_weekly FOR SELECT USING (user_id = auth.uid())';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.bud_monthly_upsert(
  p_category_id uuid,
  p_month date,
  p_amount numeric,
  p_carryover_enabled boolean DEFAULT false,
  p_notes text DEFAULT NULL
) RETURNS public.budgets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_amount numeric := p_amount;
  v_month date := p_month;
  v_notes text := NULLIF(btrim(p_notes), '');
  v_carryover boolean := COALESCE(p_carryover_enabled, false);
  v_budget public.budgets;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User tidak terautentik' USING ERRCODE = 'P0001';
  END IF;

  IF p_category_id IS NULL THEN
    RAISE EXCEPTION 'Kategori wajib dipilih' USING ERRCODE = 'P0001';
  END IF;

  IF v_month IS NULL THEN
    RAISE EXCEPTION 'Tanggal bulan wajib diisi' USING ERRCODE = 'P0001';
  END IF;

  IF date_trunc('month', v_month)::date <> v_month THEN
    RAISE EXCEPTION 'Tanggal bulan harus hari pertama bulan (YYYY-MM-01)' USING ERRCODE = 'P0001';
  END IF;

  IF v_amount IS NULL THEN
    RAISE EXCEPTION 'Nominal anggaran wajib diisi' USING ERRCODE = 'P0001';
  END IF;

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal anggaran harus lebih besar dari 0' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.budgets (
    user_id,
    month,
    category_id,
    amount_planned,
    carryover_enabled,
    notes,
    budget_type,
    period_month
  )
  VALUES (
    v_user_id,
    v_month,
    p_category_id,
    v_amount,
    v_carryover,
    v_notes,
    'monthly',
    v_month
  )
  ON CONFLICT (user_id, month, category_id)
  DO UPDATE
    SET amount_planned = EXCLUDED.amount_planned,
        carryover_enabled = EXCLUDED.carryover_enabled,
        notes = EXCLUDED.notes,
        budget_type = 'monthly',
        month = EXCLUDED.month,
        period_month = EXCLUDED.period_month,
        updated_at = timezone('utc', now()),
        rev = COALESCE(public.budgets.rev, 0) + 1
  RETURNING * INTO v_budget;

  RETURN v_budget;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bud_monthly_upsert(uuid, date, numeric, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.bud_weekly_upsert(
  p_category_id uuid,
  p_week_start date,
  p_planned_amount numeric,
  p_carryover_enabled boolean DEFAULT false,
  p_notes text DEFAULT NULL
) RETURNS public.budgets_weekly
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_week_start date := p_week_start;
  v_amount numeric := p_planned_amount;
  v_notes text := NULLIF(btrim(p_notes), '');
  v_carryover boolean := COALESCE(p_carryover_enabled, false);
  v_budget public.budgets_weekly;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User tidak terautentik' USING ERRCODE = 'P0001';
  END IF;

  IF p_category_id IS NULL THEN
    RAISE EXCEPTION 'Kategori wajib dipilih' USING ERRCODE = 'P0001';
  END IF;

  IF v_week_start IS NULL THEN
    RAISE EXCEPTION 'Tanggal mulai minggu wajib diisi' USING ERRCODE = 'P0001';
  END IF;

  v_week_start := date_trunc('day', v_week_start)::date;

  IF EXTRACT(DOW FROM v_week_start) <> 1 THEN
    RAISE EXCEPTION 'Tanggal mulai minggu harus hari Senin' USING ERRCODE = 'P0001';
  END IF;

  IF v_amount IS NULL THEN
    RAISE EXCEPTION 'Nominal anggaran wajib diisi' USING ERRCODE = 'P0001';
  END IF;

  IF v_amount < 0 THEN
    RAISE EXCEPTION 'Nominal anggaran tidak boleh negatif' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.budgets_weekly (
    user_id,
    category_id,
    week_start,
    planned_amount,
    carryover_enabled,
    notes
  )
  VALUES (
    v_user_id,
    p_category_id,
    v_week_start,
    v_amount,
    v_carryover,
    v_notes
  )
  ON CONFLICT (user_id, category_id, week_start)
  DO UPDATE
    SET planned_amount = EXCLUDED.planned_amount,
        carryover_enabled = EXCLUDED.carryover_enabled,
        notes = EXCLUDED.notes,
        updated_at = timezone('utc', now())
  RETURNING * INTO v_budget;

  RETURN v_budget;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bud_weekly_upsert(uuid, date, numeric, boolean, text) TO authenticated;
