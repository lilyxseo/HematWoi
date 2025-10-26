import { supabase } from './supabase';
import { getCurrentUserId, getUserToken } from './session';

export type UUID = string;

export interface SalarySimulationItemInput {
  categoryId: UUID;
  allocationAmount: number;
  allocationPercent?: number | null;
  notes?: string | null;
}

export interface SalarySimulationInput {
  title?: string | null;
  salaryAmount: number;
  periodMonth: string; // YYYY-MM-01
  notes?: string | null;
  items: SalarySimulationItemInput[];
}

export interface SalarySimulationItem {
  id: UUID;
  simulation_id: UUID;
  category_id: UUID;
  allocation_amount: number;
  allocation_percent: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  category?: {
    id: UUID;
    name: string;
    type: 'income' | 'expense' | null;
  } | null;
}

export interface SalarySimulationRecord {
  id: UUID;
  user_id: UUID;
  title: string | null;
  salary_amount: number;
  period_month: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: SalarySimulationItem[];
}

export interface SalarySimulationSummary extends SalarySimulationRecord {
  totals: {
    allocations: number;
    remaining: number;
  };
}

export interface ExpenseCategoryOption {
  id: UUID;
  name: string;
  type: 'income' | 'expense' | null;
  group_name?: string | null;
}

export interface BudgetComparisonRow {
  id: UUID;
  category_id: UUID;
  planned: number;
  period_month: string;
  category?: {
    id: UUID;
    name: string;
    type: 'income' | 'expense' | null;
  } | null;
}

async function requireSessionUser(provided?: string | null): Promise<string> {
  if (provided) return provided;
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Pengguna belum masuk.');
  }
  return userId;
}

export async function listExpenseCategories(userId?: string): Promise<ExpenseCategoryOption[]> {
  const resolvedUserId = await requireSessionUser(userId);
  const { data, error } = await supabase
    .from('categories')
    .select('id,name,type,group_name')
    .eq('user_id', resolvedUserId)
    .eq('type', 'expense')
    .order('group_name', { ascending: true, nullsFirst: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as UUID,
    name: row.name as string,
    type: (row.type as 'income' | 'expense' | null) ?? null,
    group_name: (row.group_name as string | null | undefined) ?? null,
  }));
}

export async function getMonthlyBudgets(periodMonth: string, userId?: string): Promise<BudgetComparisonRow[]> {
  const resolvedUserId = await requireSessionUser(userId);
  const { data, error } = await supabase
    .from('budgets')
    .select('id,category_id,planned,period_month,category:categories(id,name,type)')
    .eq('user_id', resolvedUserId)
    .eq('period_month', periodMonth)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as UUID,
    category_id: row.category_id as UUID,
    planned: Number(row.planned ?? 0),
    period_month: row.period_month as string,
    category: row.category as BudgetComparisonRow['category'],
  }));
}

async function fetchSimulationRecord(id: string, userId: string): Promise<SalarySimulationRecord | null> {
  const { data, error } = await supabase
    .from('salary_simulations')
    .select(
      'id,user_id,title,salary_amount,period_month,notes,created_at,updated_at,items:salary_simulation_items(id,simulation_id,category_id,allocation_amount,allocation_percent,notes,created_at,updated_at,category:categories(id,name,type)))'
    )
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as SalarySimulationRecord | null) ?? null;
}

export async function getSalarySimulations(
  options?: { periodMonth?: string; userId?: string }
): Promise<SalarySimulationSummary[]> {
  const resolvedUserId = await requireSessionUser(options?.userId);
  let query = supabase
    .from('salary_simulations')
    .select(
      'id,user_id,title,salary_amount,period_month,notes,created_at,updated_at,items:salary_simulation_items(id,simulation_id,category_id,allocation_amount,allocation_percent,notes,created_at,updated_at,category:categories(id,name,type)))'
    )
    .eq('user_id', resolvedUserId)
    .order('updated_at', { ascending: false });
  if (options?.periodMonth) {
    query = query.eq('period_month', options.periodMonth);
  }
  const { data, error } = await query;
  if (error) throw error;
  const records = (data ?? []) as SalarySimulationRecord[];
  return records.map((record) => {
    const totalAllocations = (record.items ?? []).reduce(
      (sum, item) => sum + Number(item.allocation_amount ?? 0),
      0
    );
    return {
      ...record,
      totals: {
        allocations: totalAllocations,
        remaining: Number(record.salary_amount ?? 0) - totalAllocations,
      },
    } satisfies SalarySimulationSummary;
  });
}

export async function getSalarySimulation(id: string, userId?: string): Promise<SalarySimulationRecord | null> {
  const resolvedUserId = await requireSessionUser(userId);
  return fetchSimulationRecord(id, resolvedUserId);
}

export async function createSalarySimulation(
  input: SalarySimulationInput,
  userId?: string
): Promise<SalarySimulationRecord> {
  const resolvedUserId = await requireSessionUser(userId);
  await getUserToken();
  const payload = {
    user_id: resolvedUserId,
    title: input.title?.trim() || null,
    salary_amount: Number(input.salaryAmount ?? 0),
    period_month: input.periodMonth,
    notes: input.notes?.trim() || null,
  };
  const { data, error } = await supabase
    .from('salary_simulations')
    .insert(payload)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  const simulationId = (data?.id as string | undefined) ?? null;
  if (!simulationId) {
    throw new Error('Gagal membuat simulasi gajian');
  }
  if (input.items.length) {
    const itemsPayload = input.items.map((item) => ({
      simulation_id: simulationId,
      category_id: item.categoryId,
      allocation_amount: Number(item.allocationAmount ?? 0),
      allocation_percent:
        item.allocationPercent == null ? null : Number(item.allocationPercent ?? 0),
      notes: item.notes?.trim() || null,
    }));
    const { error: itemsError } = await supabase
      .from('salary_simulation_items')
      .insert(itemsPayload);
    if (itemsError) {
      await supabase.from('salary_simulations').delete().eq('id', simulationId);
      throw itemsError;
    }
  }
  const record = await fetchSimulationRecord(simulationId, resolvedUserId);
  if (!record) {
    throw new Error('Simulasi tidak ditemukan setelah dibuat');
  }
  return record;
}

export async function updateSalarySimulation(
  id: string,
  input: SalarySimulationInput,
  userId?: string
): Promise<SalarySimulationRecord> {
  const resolvedUserId = await requireSessionUser(userId);
  await getUserToken();
  const { error } = await supabase
    .from('salary_simulations')
    .update({
      title: input.title?.trim() || null,
      salary_amount: Number(input.salaryAmount ?? 0),
      period_month: input.periodMonth,
      notes: input.notes?.trim() || null,
    })
    .eq('id', id)
    .eq('user_id', resolvedUserId);
  if (error) throw error;
  const { error: deleteError } = await supabase
    .from('salary_simulation_items')
    .delete()
    .eq('simulation_id', id);
  if (deleteError) throw deleteError;
  if (input.items.length) {
    const itemsPayload = input.items.map((item) => ({
      simulation_id: id,
      category_id: item.categoryId,
      allocation_amount: Number(item.allocationAmount ?? 0),
      allocation_percent:
        item.allocationPercent == null ? null : Number(item.allocationPercent ?? 0),
      notes: item.notes?.trim() || null,
    }));
    const { error: itemsError } = await supabase
      .from('salary_simulation_items')
      .insert(itemsPayload);
    if (itemsError) throw itemsError;
  }
  const record = await fetchSimulationRecord(id, resolvedUserId);
  if (!record) {
    throw new Error('Simulasi tidak ditemukan setelah diperbarui');
  }
  return record;
}

export async function deleteSalarySimulation(id: string, userId?: string): Promise<void> {
  const resolvedUserId = await requireSessionUser(userId);
  await getUserToken();
  const { error: itemsError } = await supabase
    .from('salary_simulation_items')
    .delete()
    .eq('simulation_id', id);
  if (itemsError && itemsError.code !== 'PGRST302') {
    // ignore row not found
    throw itemsError;
  }
  const { error } = await supabase
    .from('salary_simulations')
    .delete()
    .eq('id', id)
    .eq('user_id', resolvedUserId);
  if (error) throw error;
}

export async function duplicateSalarySimulation(id: string, userId?: string): Promise<SalarySimulationRecord> {
  const resolvedUserId = await requireSessionUser(userId);
  const existing = await fetchSimulationRecord(id, resolvedUserId);
  if (!existing) {
    throw new Error('Simulasi tidak ditemukan untuk diduplikasi');
  }
  const title = existing.title ? `${existing.title} (Copy)` : null;
  const items = (existing.items ?? []).map((item) => ({
    categoryId: item.category_id,
    allocationAmount: Number(item.allocation_amount ?? 0),
    allocationPercent:
      item.allocation_percent == null ? null : Number(item.allocation_percent ?? 0),
    notes: item.notes ?? null,
  }));
  return createSalarySimulation(
    {
      title,
      salaryAmount: Number(existing.salary_amount ?? 0),
      periodMonth: existing.period_month,
      notes: existing.notes ?? null,
      items,
    },
    resolvedUserId
  );
}
