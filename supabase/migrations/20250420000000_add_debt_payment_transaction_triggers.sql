create or replace function public.handle_debt_payment_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  debt_owner uuid;
  debt_title text;
  tx_id uuid;
  description text;
  trimmed_note text;
  payment_date date;
begin
  if new.related_tx_id is not null then
    return new;
  end if;

  select d.user_id, d.title
    into debt_owner, debt_title
  from public.debts d
  where d.id = new.debt_id
  limit 1;

  if debt_owner is null then
    raise exception 'Debt % not found or inaccessible', new.debt_id;
  end if;

  trimmed_note := nullif(trim(coalesce(new.note, '')), '');
  new.user_id := debt_owner;

  payment_date := coalesce(new.paid_at::date, now()::date);

  description := 'Bayar utang: ' || coalesce(nullif(trim(debt_title), ''), 'Tanpa judul');
  if trimmed_note is not null then
    description := description || ' - ' || trimmed_note;
  end if;

  insert into public.transactions (user_id, date, type, amount, account_id, title, notes)
  values (debt_owner, payment_date, 'expense', new.amount, new.account_id, description, null)
  returning id into tx_id;

  new.related_tx_id := tx_id;
  new.paid_at := payment_date;

  return new;
end;
$$;

create or replace function public.handle_debt_payment_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  debt_title text;
  debt_owner uuid;
  description text;
  trimmed_note text;
  payment_date date;
begin
  if new.related_tx_id is null then
    return new;
  end if;

  select d.title, d.user_id
    into debt_title, debt_owner
  from public.debts d
  where d.id = new.debt_id
  limit 1;

  trimmed_note := nullif(trim(coalesce(new.note, '')), '');

  payment_date := coalesce(new.paid_at::date, now()::date);

  description := 'Bayar utang: ' || coalesce(nullif(trim(debt_title), ''), 'Tanpa judul');
  if trimmed_note is not null then
    description := description || ' - ' || trimmed_note;
  end if;

  update public.transactions
     set user_id = coalesce(debt_owner, new.user_id),
         amount = new.amount,
         date = payment_date,
         account_id = new.account_id,
         title = description,
         notes = null,
         deleted_at = null
   where id = new.related_tx_id;

  return new;
end;
$$;

create or replace function public.handle_debt_payment_after_delete()
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
     set deleted_at = now()
   where id = old.related_tx_id
     and deleted_at is null;

  return old;
end;
$$;

drop trigger if exists trg_debt_payments_before_insert on public.debt_payments;
create trigger trg_debt_payments_before_insert
before insert on public.debt_payments
for each row
execute function public.handle_debt_payment_before_insert();

drop trigger if exists trg_debt_payments_after_update on public.debt_payments;
create trigger trg_debt_payments_after_update
after update on public.debt_payments
for each row
execute function public.handle_debt_payment_after_update();

drop trigger if exists trg_debt_payments_after_delete on public.debt_payments;
create trigger trg_debt_payments_after_delete
after delete on public.debt_payments
for each row
execute function public.handle_debt_payment_after_delete();
