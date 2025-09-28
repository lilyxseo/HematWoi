drop trigger if exists trg_debt_payments_sync_transaction on public.debt_payments;

create or replace function public.debt_payment_sync_transaction()
returns trigger
language plpgsql
as $$
declare
  debt_record public.debts%rowtype;
  txn_type text;
  txn_title text;
  party_name text;
  debt_title text;
  txn_notes text;
  txn_date date;
  new_transaction_id uuid;
begin
  if tg_op in ('INSERT', 'UPDATE') then
    select * into debt_record
    from public.debts
    where id = new.debt_id;

    if not found then
      raise exception 'Debt % tidak ditemukan untuk pembayaran', new.debt_id;
    end if;

    debt_title := nullif(trim(coalesce(debt_record.title, '')), '');
    party_name := nullif(trim(coalesce(debt_record.party_name, '')), '');

    if debt_record.type = 'receivable' then
      txn_type := 'income';
      txn_title := coalesce(
        debt_title,
        'Pelunasan piutang' || case when party_name is not null then ' - ' || party_name else '' end
      );
    else
      txn_type := 'expense';
      txn_title := coalesce(
        debt_title,
        'Pembayaran hutang' || case when party_name is not null then ' - ' || party_name else '' end
      );
    end if;

    txn_notes := nullif(trim(coalesce(new.notes, '')), '');
    txn_date := (timezone('utc', coalesce(new.date, now())))::date;

    if tg_op = 'INSERT' or new.transaction_id is null then
      insert into public.transactions (
        user_id,
        type,
        amount,
        date,
        account_id,
        title,
        notes
      )
      values (
        new.user_id,
        txn_type,
        new.amount,
        txn_date,
        new.account_id,
        txn_title,
        txn_notes
      )
      returning id into new_transaction_id;

      new.transaction_id := new_transaction_id;
    else
      update public.transactions
      set
        user_id = new.user_id,
        type = txn_type,
        amount = new.amount,
        date = txn_date,
        account_id = new.account_id,
        title = txn_title,
        notes = txn_notes
      where id = new.transaction_id;

      if not found then
        insert into public.transactions (
          user_id,
          type,
          amount,
          date,
          account_id,
          title,
          notes
        )
        values (
          new.user_id,
          txn_type,
          new.amount,
          txn_date,
          new.account_id,
          txn_title,
          txn_notes
        )
        returning id into new_transaction_id;

        new.transaction_id := new_transaction_id;
      end if;
    end if;

    return new;
  elsif tg_op = 'DELETE' then
    if old.transaction_id is not null then
      delete from public.transactions
      where id = old.transaction_id
        and user_id = old.user_id;
    end if;

    return old;
  end if;

  return null;
end;
$$;

create trigger trg_debt_payments_sync_transaction
before insert or update or delete on public.debt_payments
for each row
execute function public.debt_payment_sync_transaction();
