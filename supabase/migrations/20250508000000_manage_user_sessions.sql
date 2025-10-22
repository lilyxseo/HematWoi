create or replace function public.list_user_sessions()
returns table (
  id uuid,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  expires_at timestamptz,
  ip_address text,
  user_agent text,
  aal text,
  factor_id uuid,
  current boolean
)
language sql
security definer
set search_path = public, auth
as $$
  with claims as (
    select coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb as value
  )
  select
    s.id,
    s.created_at,
    coalesce(s.updated_at, s.created_at) as last_sign_in_at,
    s.not_after as expires_at,
    s.ip::text as ip_address,
    s.user_agent,
    s.aal,
    s.factor_id,
    (s.id::text = claims.value->> 'session_id') as current
  from auth.sessions as s
  cross join claims
  where s.user_id = auth.uid()
  order by (s.id::text = claims.value->> 'session_id') desc, coalesce(s.updated_at, s.created_at) desc;
$$;

revoke all on function public.list_user_sessions() from public;
grant execute on function public.list_user_sessions() to authenticated;

create or replace function public.sign_out_session(target_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  deleted_count integer;
begin
  if target_session_id is null then
    return false;
  end if;

  delete from auth.sessions
  where id = target_session_id
    and user_id = auth.uid();

  get diagnostics deleted_count = row_count;

  return deleted_count > 0;
end;
$$;

revoke all on function public.sign_out_session(uuid) from public;
grant execute on function public.sign_out_session(uuid) to authenticated;
