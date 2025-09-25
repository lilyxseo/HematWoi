-- Ensure debt_payments has the columns required for automatic transaction sync
alter table public.debt_payments
  add column if not exists account_id uuid references public.accounts (id) on delete set null,
  add column if not exists paid_at date not null default (timezone('Asia/Jakarta', now())::date),
  add column if not exists note text,
  add column if not exists related_tx_id uuid;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'debt_payments'
      AND column_name = 'date'
  ) THEN
    EXECUTE $$
      update public.debt_payments
         set paid_at = coalesce(public.debt_payments.paid_at, (timezone('Asia/Jakarta', public.debt_payments.date)::date))
       where public.debt_payments.paid_at is null
         and public.debt_payments.date is not null
    $$;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'debt_payments'
      AND column_name = 'notes'
  ) THEN
    EXECUTE $$
      update public.debt_payments
         set note = coalesce(public.debt_payments.note, public.debt_payments.notes)
       where public.debt_payments.note is null
         and public.debt_payments.notes is not null
    $$;
  END IF;
END
$$;

-- Ensure related_tx_id has a unique constraint and foreign key to transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'debt_payments_related_tx_id_key'
      AND table_schema = 'public'
      AND table_name = 'debt_payments'
  ) THEN
    ALTER TABLE public.debt_payments
      ADD CONSTRAINT debt_payments_related_tx_id_key UNIQUE (related_tx_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'debt_payments_related_tx_id_fkey'
      AND table_schema = 'public'
      AND table_name = 'debt_payments'
  ) THEN
    ALTER TABLE public.debt_payments
      ADD CONSTRAINT debt_payments_related_tx_id_fkey FOREIGN KEY (related_tx_id)
        REFERENCES public.transactions (id) ON DELETE SET NULL;
  END IF;
END
$$;

create or replace function public.debt_payment_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  debt_owner uuid;
  debt_title text;
  tx_title text;
begin
  -- Prevent duplicate transaction creation when retrying inserts
  if new.related_tx_id is not null then
    return new;
  end if;

  select d.user_id, d.title
    into debt_owner, debt_title
  from public.debts d
  where d.id = new.debt_id;

  if debt_owner is null then
    raise exception 'Debt % not found for payment', new.debt_id;
  end if;

  new.user_id := debt_owner;
  new.paid_at := coalesce(new.paid_at, timezone('Asia/Jakarta', now())::date);
  new.note := case when new.note is null then null else nullif(trim(new.note), '') end;

  tx_title := 'Bayar utang: ' || coalesce(debt_title, 'Tanpa judul');
  if new.note is not null then
    tx_title := tx_title || ' - ' || new.note;
  end if;

  insert into public.transactions (user_id, date, type, amount, account_id, title, notes)
  values (debt_owner, new.paid_at, 'expense', new.amount, new.account_id, tx_title, new.note)
  returning id into new.related_tx_id;

  return new;
end;
$$;

create or replace function public.debt_payment_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  debt_title text;
  tx_title text;
begin
  if new.related_tx_id is null then
    return new;
  end if;

  select d.title
    into debt_title
  from public.debts d
  where d.id = new.debt_id;

  tx_title := 'Bayar utang: ' || coalesce(debt_title, 'Tanpa judul');
  if new.note is not null and trim(new.note) <> '' then
    tx_title := tx_title || ' - ' || trim(new.note);
  end if;

  update public.transactions
     set amount = new.amount,
         date = coalesce(new.paid_at, timezone('Asia/Jakarta', now())::date),
         account_id = new.account_id,
         title = tx_title,
         notes = case when new.note is null or trim(new.note) = '' then null else trim(new.note) end,
         deleted_at = null
   where id = new.related_tx_id;

  return new;
end;
$$;

create or replace function public.debt_payment_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.related_tx_id is null then
    return old;
  end if;

  update public.transactions
     set deleted_at = coalesce(deleted_at, timezone('utc', now()))
   where id = old.related_tx_id
     and deleted_at is null;

  return old;
end;
$$;

drop trigger if exists debt_payment_before_insert_trigger on public.debt_payments;
create trigger debt_payment_before_insert_trigger
before insert on public.debt_payments
for each row
execute function public.debt_payment_before_insert();

drop trigger if exists debt_payment_after_update_trigger on public.debt_payments;
create trigger debt_payment_after_update_trigger
after update on public.debt_payments
for each row
execute function public.debt_payment_after_update();

drop trigger if exists debt_payment_after_delete_trigger on public.debt_payments;
create trigger debt_payment_after_delete_trigger
after delete on public.debt_payments
for each row
execute function public.debt_payment_after_delete();
