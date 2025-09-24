-- Update debt_payments structure and automate related transactions

alter table public.debt_payments
  rename column date to paid_at;

alter table public.debt_payments
  alter column paid_at type date using paid_at::date;

alter table public.debt_payments
  alter column paid_at set default current_date;

alter table public.debt_payments
  rename column notes to note;

alter table public.debt_payments
  add column if not exists account_id uuid;

alter table public.debt_payments
  add column if not exists related_tx_id uuid;

alter table public.debt_payments
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.debt_payments
set updated_at = coalesce(updated_at, created_at)
where updated_at is null;

alter table public.debt_payments
  add constraint debt_payments_related_tx_unique unique (related_tx_id);

alter table public.debt_payments
  add constraint debt_payments_account_fk foreign key (account_id) references public.accounts (id) on delete set null;

alter table public.debt_payments
  add constraint debt_payments_transaction_fk foreign key (related_tx_id) references public.transactions (id) on delete set null;

create or replace function public.debt_payment_set_meta()
returns trigger
language plpgsql
as $$
declare
  trimmed_note text;
begin
  if new.paid_at is null then
    new.paid_at := current_date;
  end if;

  trimmed_note := nullif(btrim(coalesce(new.note, '')), '');
  new.note := trimmed_note;
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists debt_payments_set_meta on public.debt_payments;
create trigger debt_payments_set_meta
before insert or update on public.debt_payments
for each row
execute function public.debt_payment_set_meta();

create or replace function public.debt_payment_create_transaction()
returns trigger
language plpgsql
as $$
declare
  debt_title text;
  transaction_title text;
  tx_id uuid;
  payment_note text;
  payment_date timestamptz;
begin
  if new.related_tx_id is not null then
    return new;
  end if;

  if new.paid_at is null then
    new.paid_at := current_date;
  end if;

  if new.account_id is null then
    raise exception 'Akun sumber wajib diisi untuk pembayaran hutang.';
  end if;

  select title into debt_title
  from public.debts
  where id = new.debt_id;

  if debt_title is null then
    raise exception 'Hutang tidak ditemukan untuk pembayaran.';
  end if;

  payment_note := nullif(btrim(coalesce(new.note, '')), '');
  new.note := payment_note;
  if payment_note is not null then
    transaction_title := format('Bayar utang: %s - %s', debt_title, payment_note);
  else
    transaction_title := format('Bayar utang: %s', debt_title);
  end if;

  payment_date := new.paid_at::timestamptz;

  insert into public.transactions (
    user_id,
    date,
    type,
    amount,
    account_id,
    title,
    notes,
    created_at,
    updated_at,
    deleted_at
  )
  values (
    new.user_id,
    payment_date,
    'expense',
    new.amount,
    new.account_id,
    transaction_title,
    payment_note,
    timezone('utc', now()),
    timezone('utc', now()),
    null
  )
  returning id into tx_id;

  new.related_tx_id := tx_id;
  return new;
end;
$$;

drop trigger if exists debt_payments_before_insert on public.debt_payments;
create trigger debt_payments_before_insert
before insert on public.debt_payments
for each row
execute function public.debt_payment_create_transaction();

create or replace function public.debt_payment_sync_transaction()
returns trigger
language plpgsql
as $$
declare
  debt_title text;
  payment_note text;
  transaction_title text;
begin
  if new.related_tx_id is null then
    return new;
  end if;

  if (new.amount is distinct from old.amount)
     or (new.account_id is distinct from old.account_id)
     or (new.paid_at is distinct from old.paid_at)
     or (coalesce(new.note, '') is distinct from coalesce(old.note, '')) then
    select title into debt_title
    from public.debts
    where id = new.debt_id;

    payment_note := new.note;
    if payment_note is not null then
      transaction_title := format('Bayar utang: %s - %s', coalesce(debt_title, '-'), payment_note);
    else
      transaction_title := format('Bayar utang: %s', coalesce(debt_title, '-'));
    end if;

    update public.transactions
    set
      amount = new.amount,
      account_id = new.account_id,
      date = new.paid_at::timestamptz,
      title = transaction_title,
      notes = payment_note,
      deleted_at = null,
      updated_at = timezone('utc', now())
    where id = new.related_tx_id and user_id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists debt_payments_after_update on public.debt_payments;
create trigger debt_payments_after_update
after update on public.debt_payments
for each row
execute function public.debt_payment_sync_transaction();

create or replace function public.debt_payment_soft_delete_transaction()
returns trigger
language plpgsql
as $$
begin
  if old.related_tx_id is null then
    return old;
  end if;

  update public.transactions
  set
    deleted_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  where id = old.related_tx_id and user_id = old.user_id;

  return old;
end;
$$;

drop trigger if exists debt_payments_after_delete on public.debt_payments;
create trigger debt_payments_after_delete
after delete on public.debt_payments
for each row
execute function public.debt_payment_soft_delete_transaction();
