-- All selected history entries are soft-deleted together, or none are changed.
create or replace function public.delete_whatsapp_history_transactions(p_user_id uuid, p_transaction_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare expected integer; locked integer; deleted jsonb;
begin
  expected := cardinality(p_transaction_ids);
  if expected is null or expected < 1 or expected > 50 or
     array_position(p_transaction_ids,null) is not null or
     expected != (select count(distinct id) from unnest(p_transaction_ids) as id) then
    raise exception 'INVALID_HISTORY_SELECTION';
  end if;
  -- Lock in a stable order. A concurrent deletion must invalidate the whole set.
  perform t.id from public.transactions t
    where t.user_id = p_user_id and t.id = any(p_transaction_ids) and t.deleted_at is null
    order by t.id for update;
  get diagnostics locked = row_count;
  if locked != expected then return jsonb_build_object('ok',false,'reason','stale_selection'); end if;
  with changed as (
    update public.transactions set deleted_at = now()
      where user_id = p_user_id and id = any(p_transaction_ids) and deleted_at is null
      returning id
  ) select jsonb_agg(id) into deleted from changed;
  if jsonb_array_length(deleted) is distinct from expected then raise exception 'HISTORY_DELETE_INCOMPLETE'; end if;
  return jsonb_build_object('ok',true,'deleted_ids',deleted,'count',expected);
end $$;
revoke all on function public.delete_whatsapp_history_transactions(uuid,uuid[]) from public, anon, authenticated;
grant execute on function public.delete_whatsapp_history_transactions(uuid,uuid[]) to service_role;
notify pgrst, 'reload schema';
