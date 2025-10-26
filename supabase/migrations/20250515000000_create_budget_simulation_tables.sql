create table if not exists public.budget_sim_scenarios (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    period_month date not null,
    include_weekly boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.budget_sim_items (
    id uuid primary key default gen_random_uuid(),
    scenario_id uuid not null references public.budget_sim_scenarios(id) on delete cascade,
    category_id uuid not null references public.categories(id) on delete cascade,
    delta_monthly numeric not null default 0,
    delta_weekly jsonb,
    locked boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.budget_sim_scenarios enable row level security;
alter table public.budget_sim_items enable row level security;

create policy "Users manage their own budget_sim_scenarios" on public.budget_sim_scenarios
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users manage their own budget_sim_items" on public.budget_sim_items
    for all
    using (
        exists (
            select 1 from public.budget_sim_scenarios s
            where s.id = budget_sim_items.scenario_id
              and s.user_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1 from public.budget_sim_scenarios s
            where s.id = budget_sim_items.scenario_id
              and s.user_id = auth.uid()
        )
    );

-- maintain updated_at columns
create trigger budget_sim_scenarios_set_updated_at
    before update on public.budget_sim_scenarios
    for each row
    execute function public.set_updated_at();

create trigger budget_sim_items_set_updated_at
    before update on public.budget_sim_items
    for each row
    execute function public.set_updated_at();

-- helpful indexes
create index if not exists budget_sim_scenarios_user_period_idx
    on public.budget_sim_scenarios (user_id, period_month);

create index if not exists budget_sim_items_scenario_category_idx
    on public.budget_sim_items (scenario_id, category_id);
