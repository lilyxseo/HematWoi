-- Update debt_payments to link automatic transactions
alter table public.debt_payments
  add column if not exists account_id uuid,
  add column if not exists paid_at date not null default (timezone('Asia/Jakarta', now()))::date,
  add column if not exists related_tx_id uuid,
  add column if not exists note text;

-- migrate legacy notes column if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'debt_payments'
      AND column_name = 'notes'
  ) THEN
    UPDATE public.debt_payments
       SET note = COALESCE(note, notes)
     WHERE note IS NULL;
    ALTER TABLE public.debt_payments
      DROP COLUMN notes;
  END IF;
END;
$$;

-- backfill paid_at from previous date column when available
UPDATE public.debt_payments
   SET paid_at = COALESCE(paid_at, date::date)
 WHERE paid_at IS NULL;

-- ensure account foreign key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.constraint_schema = tc.constraint_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'debt_payments'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.column_name = 'account_id'
  ) THEN
    ALTER TABLE public.debt_payments
      ADD CONSTRAINT debt_payments_account_id_fkey
        FOREIGN KEY (account_id)
        REFERENCES public.accounts (id)
        ON DELETE RESTRICT;
  END IF;
END;
$$;

-- ensure related transaction reference
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.constraint_schema = tc.constraint_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'debt_payments'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.column_name = 'related_tx_id'
  ) THEN
    ALTER TABLE public.debt_payments
      ADD CONSTRAINT debt_payments_related_tx_id_fkey
        FOREIGN KEY (related_tx_id)
        REFERENCES public.transactions (id)
        ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS debt_payments_related_tx_id_key
  ON public.debt_payments (related_tx_id);

-- helper to build transaction description
CREATE OR REPLACE FUNCTION public.build_debt_payment_description(p_debt_id uuid, p_note text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  debt_title text;
  trimmed_note text;
  description text;
BEGIN
  SELECT title INTO debt_title
    FROM public.debts
   WHERE id = p_debt_id;

  IF debt_title IS NULL THEN
    debt_title := 'Hutang';
  END IF;

  trimmed_note := NULLIF(BTRIM(p_note), '');
  description := 'Bayar utang: ' || debt_title;
  IF trimmed_note IS NOT NULL THEN
    description := description || ' - ' || trimmed_note;
  END IF;

  RETURN description;
END;
$$;

CREATE OR REPLACE FUNCTION public.debt_payments_before_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  description text;
  inserted_tx_id uuid;
  now_utc timestamptz := timezone('utc', now());
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;

  IF NEW.account_id IS NULL THEN
    RAISE EXCEPTION 'Account wajib diisi untuk pembayaran utang.';
  END IF;

  IF NEW.paid_at IS NULL THEN
    NEW.paid_at := (timezone('Asia/Jakarta', now()))::date;
  END IF;

  NEW.date := COALESCE(NEW.date, NEW.paid_at::timestamp AT TIME ZONE 'Asia/Jakarta');

  description := public.build_debt_payment_description(NEW.debt_id, NEW.note);

  INSERT INTO public.transactions (
    user_id,
    date,
    type,
    amount,
    account_id,
    note,
    notes,
    title,
    created_at,
    updated_at,
    rev
  )
  VALUES (
    NEW.user_id,
    NEW.paid_at,
    'expense',
    NEW.amount,
    NEW.account_id,
    description,
    description,
    description,
    now_utc,
    now_utc,
    1
  )
  RETURNING id INTO inserted_tx_id;

  NEW.related_tx_id := inserted_tx_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.debt_payments_after_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  description text;
  now_utc timestamptz := timezone('utc', now());
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.related_tx_id IS NOT NULL THEN
      UPDATE public.transactions
         SET deleted_at = now_utc,
             updated_at = now_utc,
             rev = COALESCE(rev, 0) + 1
       WHERE id = OLD.related_tx_id;
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.related_tx_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.account_id IS NULL THEN
    RAISE EXCEPTION 'Account wajib diisi untuk pembayaran utang.';
  END IF;

  IF NEW.paid_at IS NULL THEN
    NEW.paid_at := (timezone('Asia/Jakarta', now()))::date;
  END IF;

  IF (NEW.amount IS DISTINCT FROM OLD.amount)
     OR (NEW.account_id IS DISTINCT FROM OLD.account_id)
     OR (NEW.paid_at IS DISTINCT FROM OLD.paid_at)
     OR (COALESCE(NEW.note, '') IS DISTINCT FROM COALESCE(OLD.note, '')) THEN
    description := public.build_debt_payment_description(NEW.debt_id, NEW.note);

    UPDATE public.transactions
       SET amount = NEW.amount,
           account_id = NEW.account_id,
           date = NEW.paid_at,
           note = description,
           notes = description,
           title = description,
           updated_at = now_utc,
           deleted_at = NULL,
           rev = COALESCE(rev, 0) + 1
     WHERE id = NEW.related_tx_id;
  END IF;

  NEW.date := NEW.paid_at::timestamp AT TIME ZONE 'Asia/Jakarta';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS debt_payments_before_insert ON public.debt_payments;
CREATE TRIGGER debt_payments_before_insert
BEFORE INSERT ON public.debt_payments
FOR EACH ROW
EXECUTE FUNCTION public.debt_payments_before_insert();

DROP TRIGGER IF EXISTS debt_payments_after_change ON public.debt_payments;
CREATE TRIGGER debt_payments_after_change
AFTER UPDATE OR DELETE ON public.debt_payments
FOR EACH ROW
EXECUTE FUNCTION public.debt_payments_after_change();
