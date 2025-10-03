-- Ensure accounts can be manually ordered
alter table if exists public.accounts
  add column if not exists sort_order integer;

create index if not exists idx_accounts_user_sort_order
  on public.accounts(user_id, sort_order asc);

with ordered as (
  select
    id,
    row_number() over (
      partition by user_id
      order by sort_order nulls last, created_at asc, name asc
    ) - 1 as new_order
  from public.accounts
)
update public.accounts as acc
set sort_order = ordered.new_order
from ordered
where acc.id = ordered.id
  and (acc.sort_order is distinct from ordered.new_order or acc.sort_order is null);

create or replace function public.assign_account_sort_order()
returns trigger
language plpgsql
as $$
begin
  if new.sort_order is null then
    select coalesce(max(sort_order) + 1, 0)
      into new.sort_order
    from public.accounts
    where user_id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists accounts_set_sort_order on public.accounts;

create trigger accounts_set_sort_order
before insert on public.accounts
for each row
execute function public.assign_account_sort_order();
