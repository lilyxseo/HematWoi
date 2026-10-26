-- Durable inbound claims and reply outbox. Only the service role may access these tables.
create table if not exists public.whatsapp_inbound_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  context_key text not null,
  message_id text not null,
  state text not null default 'processing' check (state in ('processing','ready','delivered','review')),
  reply text,
  parsed jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, context_key, message_id)
);
create unique index if not exists whatsapp_one_processing_user
  on public.whatsapp_inbound_requests(user_id) where state = 'processing';
alter table public.whatsapp_inbound_requests enable row level security;
revoke all on public.whatsapp_inbound_requests from anon, authenticated;
grant all on public.whatsapp_inbound_requests to service_role;

create or replace function public.claim_whatsapp_request(p_user_id uuid, p_context_key text, p_message_id text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare existing public.whatsapp_inbound_requests; claimed uuid;
begin
  -- Serialize claims in the same user without a long-running database transaction.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select * into existing from public.whatsapp_inbound_requests
    where user_id = p_user_id and context_key = p_context_key and message_id = p_message_id;
  if found then
    return jsonb_build_object('kind','duplicate','id',existing.id,'state',existing.state,'reply',existing.reply,'parsed',existing.parsed);
  end if;
  if exists(select 1 from public.whatsapp_inbound_requests where user_id = p_user_id and state = 'processing') then
    return jsonb_build_object('kind','busy');
  end if;
  insert into public.whatsapp_inbound_requests(user_id,context_key,message_id)
    values(p_user_id,p_context_key,p_message_id) returning id into claimed;
  return jsonb_build_object('kind','claimed','id',claimed);
end $$;
revoke all on function public.claim_whatsapp_request(uuid,text,text) from public, anon, authenticated;
grant execute on function public.claim_whatsapp_request(uuid,text,text) to service_role;

create table if not exists public.whatsapp_recording_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_account_id uuid references public.accounts(id) on delete set null,
  learning_enabled boolean not null default true,
  learned_accounts jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.whatsapp_recording_preferences enable row level security;
revoke all on public.whatsapp_recording_preferences from anon, authenticated;
grant all on public.whatsapp_recording_preferences to service_role;

-- PostgREST must discover the newly created RPC before webhook traffic uses it.
notify pgrst, 'reload schema';
