import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getCurrentUserId, getUserToken } from './session';

export interface ExpenseCategorySummary {
  id: string;
  user_id: string;
  name: string;
  type: 'income' | 'expense';
  color?: string | null;
  icon?: string | null;
}

export interface MonthlyBudgetSummary {
  id: string;
  user_id: string;
  category_id: string;
  amount_planned: number;
  notes: string | null;
  carryover_enabled: boolean;
  period_month: string;
  category?: {
    id: string;
    name: string;
    type: 'income' | 'expense' | null;
  } | null;
}

export interface SalarySimulationRecord {
  id: string;
  user_id: string;
  title: string | null;
  salary_amount: number;
  period_month: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items?: SalarySimulationItemRecord[];
}

export interface SalarySimulationItemRecord {
  id: string;
  simulation_id: string;
  category_id: string;
  allocation_amount: number;
  allocation_percent: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalarySimulationListItem extends SalarySimulationRecord {
  total_allocations: number;
  remaining: number;
}

export interface SalarySimulationItemInput {
  category_id: string;
  allocation_amount: number;
  allocation_percent?: number | null;
  notes?: string | null;
}

export interface SalarySimulationUpsertInput {
  title?: string | null;
  salary_amount: number;
  period_month: string;
  notes?: string | null;
  items: SalarySimulationItemInput[];
}

type MaybeSingle<T> = T | null;

function ensureAuthenticated(userId: MaybeSingle<string>): asserts userId is string {
  if (!userId) {
    throw new Error('Silakan login untuk melanjutkan');
  }
}

function normalizeSimulation(simulation: SalarySimulationRecord): SalarySimulationListItem {
  const items = simulation.items ?? [];
  const total = items.reduce((acc, item) => acc + Number(item.allocation_amount ?? 0), 0);
  return {
    ...simulation,
    total_allocations: total,
    remaining: Number(simulation.salary_amount ?? 0) - total,
  };
}

export async function listExpenseCategories(userId?: string): Promise<ExpenseCategorySummary[]> {
  const actualUserId = userId ?? (await getCurrentUserId());
  ensureAuthenticated(actualUserId);

  const { data, error } = await supabase
    .from('categories')
    .select('id,user_id,name,type,color,icon')
    .eq('user_id', actualUserId)
    .eq('type', 'expense')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ExpenseCategorySummary[];
}

export async function getMonthlyBudgets(
  userId: string,
  periodMonth: string
): Promise<MonthlyBudgetSummary[]> {
  ensureAuthenticated(userId);

  const { data, error } = await supabase
    .from('budgets')
    .select('id,user_id,category_id,amount_planned,notes,carryover_enabled,period_month,category:categories(id,name,type)')
    .eq('user_id', userId)
    .eq('period_month', periodMonth)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as MonthlyBudgetSummary[];
}

export async function getSalarySimulations(
  userId: string,
  params?: { periodMonth?: string }
): Promise<SalarySimulationListItem[]> {
  ensureAuthenticated(userId);

  let query = supabase
    .from('salary_simulations')
    .select('id,user_id,title,salary_amount,period_month,notes,created_at,updated_at,items:salary_simulation_items(id,simulation_id,category_id,allocation_amount,allocation_percent,notes,created_at,updated_at)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(100);

  if (params?.periodMonth) {
    query = query.eq('period_month', params.periodMonth);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((simulation) => normalizeSimulation(simulation as SalarySimulationRecord));
}

export async function getSalarySimulation(
  simulationId: string
): Promise<SalarySimulationRecord | null> {
  const userId = await getCurrentUserId();
  ensureAuthenticated(userId);

  const { data, error } = await supabase
    .from('salary_simulations')
    .select('id,user_id,title,salary_amount,period_month,notes,created_at,updated_at,items:salary_simulation_items(id,simulation_id,category_id,allocation_amount,allocation_percent,notes,created_at,updated_at)')
    .eq('user_id', userId)
    .eq('id', simulationId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as MaybeSingle<SalarySimulationRecord>;
}

export async function createSalarySimulation(input: SalarySimulationUpsertInput): Promise<SalarySimulationRecord> {
  const userId = await getCurrentUserId();
  ensureAuthenticated(userId);
  await getUserToken();

  const { data, error } = await supabase
    .from('salary_simulations')
    .insert({
      user_id: userId,
      title: input.title ?? null,
      salary_amount: Number(input.salary_amount ?? 0),
      period_month: input.period_month,
      notes: input.notes ?? null,
    })
    .select('id,user_id,title,salary_amount,period_month,notes,created_at,updated_at')
    .single();

  if (error) throw error;

  const simulation = data as SalarySimulationRecord;
  if (input.items && input.items.length > 0) {
    const rows = input.items.map((item) => ({
      simulation_id: simulation.id,
      category_id: item.category_id,
      allocation_amount: Number(item.allocation_amount ?? 0),
      allocation_percent:
        item.allocation_percent === undefined || item.allocation_percent === null
          ? null
          : Number(item.allocation_percent),
      notes: item.notes ?? null,
    }));
    const { error: itemError } = await supabase.from('salary_simulation_items').insert(rows);
    if (itemError) throw itemError;
  }

  const next = await getSalarySimulation(simulation.id);
  if (!next) {
    throw new Error('Gagal membaca simulasi setelah membuat');
  }
  return next;
}

export async function updateSalarySimulation(
  simulationId: string,
  input: SalarySimulationUpsertInput
): Promise<SalarySimulationRecord> {
  const userId = await getCurrentUserId();
  ensureAuthenticated(userId);
  await getUserToken();

  const { error } = await supabase
    .from('salary_simulations')
    .update({
      title: input.title ?? null,
      salary_amount: Number(input.salary_amount ?? 0),
      period_month: input.period_month,
      notes: input.notes ?? null,
    })
    .eq('user_id', userId)
    .eq('id', simulationId);

  if (error) throw error;

  const { error: deleteError } = await supabase
    .from('salary_simulation_items')
    .delete()
    .eq('simulation_id', simulationId);
  if (deleteError) throw deleteError;

  if (input.items && input.items.length > 0) {
    const rows = input.items.map((item) => ({
      simulation_id: simulationId,
      category_id: item.category_id,
      allocation_amount: Number(item.allocation_amount ?? 0),
      allocation_percent:
        item.allocation_percent === undefined || item.allocation_percent === null
          ? null
          : Number(item.allocation_percent),
      notes: item.notes ?? null,
    }));
    const { error: itemError } = await supabase.from('salary_simulation_items').insert(rows);
    if (itemError) throw itemError;
  }

  const next = await getSalarySimulation(simulationId);
  if (!next) {
    throw new Error('Gagal membaca simulasi setelah pembaruan');
  }
  return next;
}

export async function deleteSalarySimulation(simulationId: string): Promise<void> {
  const userId = await getCurrentUserId();
  ensureAuthenticated(userId);
  await getUserToken();

  const { error: itemError } = await supabase
    .from('salary_simulation_items')
    .delete()
    .eq('simulation_id', simulationId);
  if (itemError && (itemError as PostgrestError).code !== 'PGRST116') {
    throw itemError;
  }

  const { error } = await supabase
    .from('salary_simulations')
    .delete()
    .eq('user_id', userId)
    .eq('id', simulationId);
  if (error) throw error;
}

export async function duplicateSalarySimulation(simulationId: string): Promise<SalarySimulationRecord> {
  const original = await getSalarySimulation(simulationId);
  if (!original) {
    throw new Error('Simulasi tidak ditemukan');
  }

  const baseTitle = original.title ?? 'Simulasi Gajian';
  const duplicateTitle = `${baseTitle} (Salinan)`;

  return createSalarySimulation({
    title: duplicateTitle,
    salary_amount: Number(original.salary_amount ?? 0),
    period_month: original.period_month,
    notes: original.notes ?? null,
    items: (original.items ?? []).map((item) => ({
      category_id: item.category_id,
      allocation_amount: Number(item.allocation_amount ?? 0),
      allocation_percent:
        item.allocation_percent === undefined || item.allocation_percent === null
          ? null
          : Number(item.allocation_percent),
      notes: item.notes ?? null,
    })),
  });
}

export async function applySalarySimulationToBudget(simulationId: string): Promise<void> {
  const userId = await getCurrentUserId();
  ensureAuthenticated(userId);
  await getUserToken();

  const { data, error } = await supabase
    .from('salary_simulations')
    .select('id,user_id,title,salary_amount,period_month,items:salary_simulation_items(category_id,allocation_amount)')
    .eq('user_id', userId)
    .eq('id', simulationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error('Simulasi tidak ditemukan');
  }

  const simulation = data as unknown as SalarySimulationRecord;
  const items = (simulation.items ?? []) as unknown as Array<{
    category_id: string;
    allocation_amount: number;
  }>;

  if (!simulation.period_month) {
    throw new Error('Periode simulasi tidak valid');
  }

  if (items.length === 0) {
    return;
  }

  const categoryIds = items.map((item) => item.category_id);
  const { data: budgetMeta, error: budgetError } = await supabase
    .from('budgets')
    .select('category_id,notes,carryover_enabled')
    .eq('user_id', userId)
    .eq('period_month', simulation.period_month)
    .in('category_id', categoryIds);

  if (budgetError) throw budgetError;

  const metaMap = new Map<string, { notes: string | null; carryover_enabled: boolean }>();
  (budgetMeta ?? []).forEach((row: any) => {
    metaMap.set(row.category_id, {
      notes: row.notes ?? null,
      carryover_enabled: Boolean(row.carryover_enabled),
    });
  });

  const rows = items.map((item) => {
    const meta = metaMap.get(item.category_id);
    return {
      user_id: userId,
      category_id: item.category_id,
      period_month: simulation.period_month,
      amount_planned: Number(item.allocation_amount ?? 0),
      notes: meta?.notes ?? null,
      carryover_enabled: meta?.carryover_enabled ?? false,
    };
  });

  const { error: upsertError } = await supabase.from('budgets').upsert(rows, {
    onConflict: 'user_id,category_id,period_month',
  });
  if (upsertError) throw upsertError;
}

