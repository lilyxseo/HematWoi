alter table public.debt_payments
  add column if not exists account_id uuid references public.accounts (id) on delete set null;

alter table public.debt_payments
  add column if not exists transaction_id uuid references public.transactions (id) on delete set null;

create index if not exists debt_payments_account_idx on public.debt_payments (user_id, account_id);
create index if not exists debt_payments_transaction_idx on public.debt_payments (user_id, transaction_id);
