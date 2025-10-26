import { supabase } from './supabase';
import { getCurrentUserId } from './session';

export type UUID = string;

export interface SalarySimulationRecord {
  id: UUID;
  user_id: UUID;
  title: string | null;
  salary_amount: number;
  period_month: string; // YYYY-MM-01
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalarySimulationItemRecord {
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
    type?: string | null;
    color?: string | null;
  } | null;
}

export interface SalarySimulationWithItems extends SalarySimulationRecord {
  items: SalarySimulationItemRecord[];
}

export interface ExpenseCategoryRecord {
  id: UUID;
  name: string;
  type: 'income' | 'expense';
  color?: string | null;
  group_name?: string | null;
}

export interface BudgetRecord {
  id: UUID;
  category_id: UUID | null;
  amount_planned: number;
  period_month: string;
  category: {
    id: UUID;
    name: string;
    type?: string | null;
  } | null;
}

export interface BudgetSummaryByCategory {
  categoryId: UUID;
  categoryName: string;
  planned: number;
}

export interface SalarySimulationInput {
  title: string | null;
  salaryAmount: number;
  periodMonth: string;
  notes: string | null;
  items: Array<{
    id?: string;
    categoryId: UUID;
    allocationAmount: number;
    allocationPercent: number | null;
    notes?: string | null;
  }>;
}

export async function listExpenseCategories(): Promise<ExpenseCategoryRecord[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, type, color, group_name')
    .eq('type', 'expense')
    .order('group_name', { ascending: true, nullsFirst: true })
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Gagal memuat kategori');
  }

  return data ?? [];
}

export async function getMonthlyBudgets(
  periodMonth: string
): Promise<BudgetSummaryByCategory[]> {
  const { data, error } = await supabase
    .from('budgets')
    .select('id, category_id, amount_planned, period_month, category:categories(id, name, type)')
    .eq('period_month', periodMonth);

  if (error) {
    throw new Error(error.message || 'Gagal memuat anggaran bulanan');
  }

  return (
    data ?? []
  ).reduce<BudgetSummaryByCategory[]>((accumulator, row) => {
    if (!row.category_id || !row.category) return accumulator;
    accumulator.push({
      categoryId: row.category_id,
      categoryName: row.category.name,
      planned: Number(row.amount_planned ?? 0),
    });
    return accumulator;
  }, []);
}

function ensureUser(userId: string | null | undefined): asserts userId is string {
  if (!userId) {
    throw new Error('Pengguna belum masuk.');
  }
}

export async function getSalarySimulations(
  options?: { periodMonth?: string }
): Promise<SalarySimulationWithItems[]> {
  const userId = await getCurrentUserId();
  ensureUser(userId);

  let query = supabase
    .from('salary_simulations')
    .select(
      'id, user_id, title, salary_amount, period_month, notes, created_at, updated_at, items:salary_simulation_items(id, simulation_id, category_id, allocation_amount, allocation_percent, notes, created_at, updated_at, category:categories(id, name, type, color))'
    )
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (options?.periodMonth) {
    query = query.eq('period_month', options.periodMonth);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || 'Gagal memuat simulasi');
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    salary_amount: Number(row.salary_amount ?? 0),
    period_month: row.period_month,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    items: (row.items ?? []).map((item: any) => ({
      id: item.id,
      simulation_id: item.simulation_id,
      category_id: item.category_id,
      allocation_amount: Number(item.allocation_amount ?? 0),
      allocation_percent:
        typeof item.allocation_percent === 'number'
          ? item.allocation_percent
          : item.allocation_percent === null
            ? null
            : Number(item.allocation_percent ?? 0),
      notes: item.notes,
      created_at: item.created_at,
      updated_at: item.updated_at,
      category: item.category ?? null,
    })),
  }));
}

export async function createSalarySimulation(
  input: SalarySimulationInput
): Promise<SalarySimulationWithItems> {
  const userId = await getCurrentUserId();
  ensureUser(userId);

  const { data, error } = await supabase
    .from('salary_simulations')
    .insert({
      user_id: userId,
      title: input.title,
      salary_amount: input.salaryAmount,
      period_month: input.periodMonth,
      notes: input.notes,
    })
    .select('id, user_id, title, salary_amount, period_month, notes, created_at, updated_at')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Gagal menyimpan simulasi');
  }

  if (input.items.length > 0) {
    const itemsPayload = input.items.map((item) => ({
      simulation_id: data.id,
      category_id: item.categoryId,
      allocation_amount: item.allocationAmount,
      allocation_percent: item.allocationPercent,
      notes: item.notes ?? null,
    }));

    const { error: itemsError } = await supabase
      .from('salary_simulation_items')
      .insert(itemsPayload);

    if (itemsError) {
      throw new Error(itemsError.message || 'Gagal menyimpan item simulasi');
    }
  }

  return {
    ...data,
    salary_amount: Number(data.salary_amount ?? 0),
    items: input.items.map((item) => ({
      id: item.id ?? globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
      simulation_id: data.id,
      category_id: item.categoryId,
      allocation_amount: item.allocationAmount,
      allocation_percent: item.allocationPercent,
      notes: item.notes ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })),
  };
}

export async function updateSalarySimulation(
  id: UUID,
  input: SalarySimulationInput
): Promise<void> {
  const userId = await getCurrentUserId();
  ensureUser(userId);

  const { error: updateError } = await supabase
    .from('salary_simulations')
    .update({
      title: input.title,
      salary_amount: input.salaryAmount,
      period_month: input.periodMonth,
      notes: input.notes,
    })
    .eq('id', id)
    .eq('user_id', userId);

  if (updateError) {
    throw new Error(updateError.message || 'Gagal memperbarui simulasi');
  }

  const { error: deleteError } = await supabase
    .from('salary_simulation_items')
    .delete()
    .eq('simulation_id', id);

  if (deleteError) {
    throw new Error(deleteError.message || 'Gagal memperbarui item simulasi');
  }

  if (input.items.length > 0) {
    const payload = input.items.map((item) => ({
      simulation_id: id,
      category_id: item.categoryId,
      allocation_amount: item.allocationAmount,
      allocation_percent: item.allocationPercent,
      notes: item.notes ?? null,
    }));
    const { error: insertError } = await supabase
      .from('salary_simulation_items')
      .insert(payload);

    if (insertError) {
      throw new Error(insertError.message || 'Gagal memperbarui item simulasi');
    }
  }
}

export async function deleteSalarySimulation(id: UUID): Promise<void> {
  const userId = await getCurrentUserId();
  ensureUser(userId);

  const { error } = await supabase
    .from('salary_simulations')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message || 'Gagal menghapus simulasi');
  }
}

export async function duplicateSalarySimulation(
  id: UUID,
  overrides?: Partial<Omit<SalarySimulationInput, 'items'>>
): Promise<SalarySimulationWithItems> {
  const simulations = await getSalarySimulations();
  const target = simulations.find((sim) => sim.id === id);
  if (!target) {
    throw new Error('Simulasi tidak ditemukan');
  }

  const baseTitle = overrides?.title ?? target.title ?? 'Salinan Simulasi';
  const title = baseTitle.includes('Salinan')
    ? `${baseTitle}`
    : `${baseTitle} (Salinan)`;

  return createSalarySimulation({
    title,
    salaryAmount: overrides?.salaryAmount ?? target.salary_amount,
    periodMonth: overrides?.periodMonth ?? target.period_month,
    notes: overrides?.notes ?? target.notes,
    items: target.items.map((item) => ({
      categoryId: item.category_id,
      allocationAmount: item.allocation_amount,
      allocationPercent: item.allocation_percent,
      notes: item.notes ?? null,
    })),
  });
}

export async function applySalarySimulationToBudgets(
  simulationId: UUID
): Promise<void> {
  const simulations = await getSalarySimulations();
  const target = simulations.find((sim) => sim.id === simulationId);
  if (!target) {
    throw new Error('Simulasi tidak ditemukan');
  }

  const userId = await getCurrentUserId();
  ensureUser(userId);

  const updates = target.items
    .filter((item) => item.category_id)
    .map((item) => ({
      period_month: target.period_month,
      category_id: item.category_id,
      amount_planned: item.allocation_amount,
      notes: item.notes ?? null,
      user_id: userId,
    }));

  if (updates.length === 0) return;

  const { error } = await supabase.from('budgets').upsert(updates, {
    onConflict: 'user_id,period_month,category_id',
    ignoreDuplicates: false,
  });

  if (error) {
    throw new Error(error.message || 'Gagal menerapkan simulasi ke anggaran');
  }
}
