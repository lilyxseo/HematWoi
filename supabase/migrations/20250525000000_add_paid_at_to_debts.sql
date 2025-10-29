alter table public.debts
  add column if not exists paid_at timestamptz;

create index if not exists debts_user_paid_idx on public.debts (user_id, paid_at);
