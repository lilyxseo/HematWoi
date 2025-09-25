-- Ensure debt payment columns align with latest app expectations
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'debt_payments'
      and column_name = 'date'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'debt_payments'
      and column_name = 'paid_at'
  ) then
    alter table public.debt_payments rename column "date" to paid_at;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'debt_payments'
      and column_name = 'notes'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'debt_payments'
      and column_name = 'note'
  ) then
    alter table public.debt_payments rename column notes to note;
  end if;
end;
$$;

alter table public.debt_payments
  add column if not exists paid_at date default timezone('Asia/Jakarta', now())::date;

alter table public.debt_payments
  add column if not exists account_id uuid references public.accounts (id) on delete set null;

alter table public.debt_payments
  add column if not exists note text;

alter table public.debt_payments
  add column if not exists related_tx_id uuid;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'debt_payments'
      and column_name = 'paid_at'
  ) then
    execute $$alter table public.debt_payments alter column paid_at type date using paid_at::date$$;
    execute $$alter table public.debt_payments alter column paid_at set default timezone('Asia/Jakarta', now())::date$$;
    execute $$alter table public.debt_payments alter column paid_at set not null$$;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.debt_payments'::regclass
      and conname = 'debt_payments_related_tx_id_fkey'
  ) then
    alter table public.debt_payments
      add constraint debt_payments_related_tx_id_fkey
      foreign key (related_tx_id) references public.transactions (id) on delete set null;
  end if;
end;
$$;

create unique index if not exists debt_payments_related_tx_id_key
  on public.debt_payments (related_tx_id)
  where related_tx_id is not null;

create index if not exists debt_payments_paid_at_idx
  on public.debt_payments (paid_at desc);

create or replace function public.debt_payments_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  debt_owner uuid;
  debt_title text;
  description text;
begin
  if new.related_tx_id is not null then
    return new;
  end if;

  select d.user_id, d.title
    into debt_owner, debt_title
  from public.debts d
  where d.id = new.debt_id;

  if debt_owner is null then
    raise exception 'Debt % not found', new.debt_id;
  end if;

  new.user_id := debt_owner;
  if new.paid_at is null then
    new.paid_at := timezone('Asia/Jakarta', now())::date;
  end if;

  description := coalesce('Bayar utang: ' || debt_title, 'Bayar utang');
  if new.note is not null and length(trim(new.note)) > 0 then
    description := description || ' - ' || trim(new.note);
  end if;

  insert into public.transactions (user_id, date, type, amount, account_id, title)
    values (
      debt_owner,
      coalesce(new.paid_at, timezone('Asia/Jakarta', now())::date),
      'expense',
      new.amount,
      new.account_id,
      description
    )
    returning id into new.related_tx_id;

  return new;
end;
$$;

create or replace function public.debt_payments_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  debt_owner uuid;
  debt_title text;
  description text;
begin
  if new.related_tx_id is null then
    return new;
  end if;

  select d.user_id, d.title
    into debt_owner, debt_title
  from public.debts d
  where d.id = new.debt_id;

  if debt_owner is null then
    return new;
  end if;

  description := coalesce('Bayar utang: ' || debt_title, 'Bayar utang');
  if new.note is not null and length(trim(new.note)) > 0 then
    description := description || ' - ' || trim(new.note);
  end if;

  update public.transactions
     set user_id = debt_owner,
         type = 'expense',
         amount = new.amount,
         account_id = new.account_id,
         date = coalesce(new.paid_at, timezone('Asia/Jakarta', now())::date),
         title = description,
         updated_at = timezone('utc', now())
   where id = new.related_tx_id;

  return new;
end;
$$;

create or replace function public.debt_payments_after_delete()
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
     set deleted_at = coalesce(deleted_at, timezone('utc', now())),
         updated_at = timezone('utc', now())
   where id = old.related_tx_id
     and deleted_at is null;

  return old;
end;
$$;

drop trigger if exists debt_payments_before_insert on public.debt_payments;
create trigger debt_payments_before_insert
before insert on public.debt_payments
for each row
execute function public.debt_payments_before_insert();

drop trigger if exists debt_payments_after_update on public.debt_payments;
create trigger debt_payments_after_update
after update on public.debt_payments
for each row
execute function public.debt_payments_after_update();

drop trigger if exists debt_payments_after_delete on public.debt_payments;
create trigger debt_payments_after_delete
after delete on public.debt_payments
for each row
execute function public.debt_payments_after_delete();
