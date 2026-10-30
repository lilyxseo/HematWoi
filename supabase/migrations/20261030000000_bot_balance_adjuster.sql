-- Read the account ledger and append exactly the difference in one transaction.
-- No direct update to account balance fields: existing ledger triggers remain authoritative.
create or replace function public.adjust_whatsapp_account_balance(
  p_user_id uuid, p_account_id uuid, p_target numeric, p_date date
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  account_name text;
  previous_balance numeric;
  difference numeric;
  transaction_id uuid;
  transaction_type text;
begin
  if p_target is null or p_target::text in ('NaN','Infinity','-Infinity') or
     p_target != trunc(p_target) or abs(p_target) > 9007199254740991 or p_date is null then
    raise exception 'INVALID_ADJUST_TARGET';
  end if;
  -- Prevent another ledger write between the balance calculation and the insert,
  -- including writers outside the bot that do not participate in bot claims.
  lock table public.transactions in share row exclusive mode;
  select a.name into account_name from public.accounts a
    where a.id = p_account_id and a.user_id = p_user_id for update;
  if not found then raise exception 'ADJUST_ACCOUNT_NOT_FOUND'; end if;

  -- Same ledger model as the dashboard: include incoming/outgoing transfers and
  -- future-dated entries, ignore soft-deleted transactions and account snapshots.
  select coalesce(sum(
    case when t.type = 'transfer' or nullif(to_jsonb(t)->>'parent_id','') is not null or nullif(to_jsonb(t)->>'transfer_group_id','') is not null then
      (case when t.to_account_id = p_account_id then t.amount else 0 end) -
      (case when t.account_id = p_account_id then t.amount else 0 end)
    when t.account_id = p_account_id and t.type = 'income' then t.amount
    when t.account_id = p_account_id and t.type = 'expense' then -t.amount
    else 0 end
  ), 0) into previous_balance
  from public.transactions t
  where t.user_id = p_user_id and t.deleted_at is null and t.date is not null
    and (t.account_id = p_account_id or t.to_account_id = p_account_id);

  difference := p_target - previous_balance;
  if difference = 0 then
    return jsonb_build_object('transaction_id',null,'before',previous_balance,'target',p_target,'delta',0,'account_name',account_name);
  end if;
  transaction_type := case when difference > 0 then 'income' else 'expense' end;
  insert into public.transactions(user_id,account_id,type,date,amount,title,notes)
    values(p_user_id,p_account_id,transaction_type,p_date,abs(difference),
      'Adjuster ' || account_name,
      'WhatsApp adjust: saldo_sebelum=' || previous_balance || '; target=' || p_target || '; selisih=' || difference)
    returning id into transaction_id;
  return jsonb_build_object('transaction_id',transaction_id,'before',previous_balance,'target',p_target,
    'delta',difference,'type',transaction_type,'account_name',account_name);
end $$;
revoke all on function public.adjust_whatsapp_account_balance(uuid,uuid,numeric,date) from public, anon, authenticated;
grant execute on function public.adjust_whatsapp_account_balance(uuid,uuid,numeric,date) to service_role;
notify pgrst, 'reload schema';
