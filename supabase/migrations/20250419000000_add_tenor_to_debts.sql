alter table public.debts
  add column if not exists tenor_months integer not null default 1 check (tenor_months >= 1);

alter table public.debts
  add column if not exists tenor_sequence integer not null default 1 check (tenor_sequence >= 1);

alter table public.debts
  add constraint debts_tenor_sequence_valid
  check (tenor_sequence <= tenor_months);

create index if not exists debts_user_tenor_idx on public.debts (user_id, tenor_sequence);
