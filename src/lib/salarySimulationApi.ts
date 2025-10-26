import { supabase } from './supabase.js';

export interface ExpenseCategoryRecord {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
}

export interface MonthlyBudgetRecord {
  id: string;
  category_id: string | null;
  planned: number;
  name?: string | null;
}

export interface SalarySimulationItemInput {
  id?: string;
  categoryId: string;
  allocationAmount: number;
  allocationPercent: number;
  notes?: string | null;
}

export interface SalarySimulationInput {
  id?: string;
  userId: string;
  title?: string | null;
  salaryAmount: number;
  periodMonth: string;
  notes?: string | null;
  items: SalarySimulationItemInput[];
}

export interface SalarySimulationItemRecord {
  id: string;
  simulation_id: string;
  category_id: string;
  allocation_amount: number;
  allocation_percent: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  category?: {
    id: string;
    name: string;
    color?: string | null;
    icon?: string | null;
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
  items: SalarySimulationItemRecord[];
}

function normalizeISODate(value: string): string {
  if (!value) throw new Error('Periode simulasi tidak valid');
  if (value.length === 10 && value.includes('-')) return value;
  if (value.length === 7) return `${value}-01`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

export async function listExpenseCategories(
  userId: string
): Promise<ExpenseCategoryRecord[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, color, icon')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .order('name', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: row.name ?? 'Tanpa nama',
    color: row.color ?? null,
    icon: row.icon ?? null,
  }));
}

export async function getMonthlyBudgets(
  userId: string,
  periodMonth: string
): Promise<MonthlyBudgetRecord[]> {
  const resolvedPeriod = normalizeISODate(periodMonth);
  const { data, error } = await supabase
    .from('budgets')
    .select('id, category_id, planned, amount_planned, name')
    .eq('user_id', userId)
    .eq('period_month', resolvedPeriod);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    category_id: row.category_id ?? null,
    planned: Number(row.planned ?? row.amount_planned ?? 0),
    name: row.name ?? null,
  }));
}

function mapSimulationRow(row: any): SalarySimulationRecord {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    title: row.title ?? null,
    salary_amount: Number(row.salary_amount ?? 0),
    period_month: normalizeISODate(String(row.period_month ?? row.periodMonth ?? '')),
    notes: row.notes ?? null,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
    items: Array.isArray(row.items)
      ? row.items.map((item: any) => ({
          id: String(item.id),
          simulation_id: String(item.simulation_id ?? row.id),
          category_id: String(item.category_id),
          allocation_amount: Number(item.allocation_amount ?? 0),
          allocation_percent: Number(item.allocation_percent ?? 0),
          notes: item.notes ?? null,
          created_at: item.created_at ?? new Date().toISOString(),
          updated_at: item.updated_at ?? new Date().toISOString(),
          category: item.category
            ? {
                id: String(item.category.id),
                name: item.category.name ?? 'Tanpa kategori',
                color: item.category.color ?? null,
                icon: item.category.icon ?? null,
              }
            : null,
        }))
      : [],
  };
}

export async function getSalarySimulations(
  userId: string,
  options: { periodMonth?: string } = {}
): Promise<SalarySimulationRecord[]> {
  let query = supabase
    .from('salary_simulations')
    .select(
      'id, user_id, title, salary_amount, period_month, notes, created_at, updated_at, items:salary_simulation_items(id, simulation_id, category_id, allocation_amount, allocation_percent, notes, created_at, updated_at, category:categories(id, name, color, icon))'
    )
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (options.periodMonth) {
    query = query.eq('period_month', normalizeISODate(options.periodMonth));
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []).map(mapSimulationRow);
}

export async function getSalarySimulationById(
  id: string
): Promise<SalarySimulationRecord | null> {
  const { data, error } = await supabase
    .from('salary_simulations')
    .select(
      'id, user_id, title, salary_amount, period_month, notes, created_at, updated_at, items:salary_simulation_items(id, simulation_id, category_id, allocation_amount, allocation_percent, notes, created_at, updated_at, category:categories(id, name, color, icon))'
    )
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapSimulationRow(data);
}

export async function createSalarySimulation(
  input: SalarySimulationInput
): Promise<SalarySimulationRecord> {
  const payload = {
    user_id: input.userId,
    title: input.title?.trim() || null,
    salary_amount: Number(input.salaryAmount ?? 0),
    period_month: normalizeISODate(input.periodMonth),
    notes: input.notes?.trim() || null,
  };

  const { data, error } = await supabase
    .from('salary_simulations')
    .insert(payload)
    .select(
      'id, user_id, title, salary_amount, period_month, notes, created_at, updated_at'
    )
    .maybeSingle();

  if (error || !data) {
    throw error ?? new Error('Gagal membuat simulasi gajian');
  }

  const simulationId = data.id as string;

  if (input.items?.length) {
    const itemPayload = input.items.map((item) => ({
      simulation_id: simulationId,
      category_id: item.categoryId,
      allocation_amount: Number(item.allocationAmount ?? 0),
      allocation_percent: Number(item.allocationPercent ?? 0),
      notes: item.notes?.trim() || null,
    }));

    const { error: itemError } = await supabase
      .from('salary_simulation_items')
      .insert(itemPayload);

    if (itemError) throw itemError;
  }

  return getSalarySimulationById(simulationId).then((result) => {
    if (!result) throw new Error('Simulasi tidak ditemukan setelah dibuat');
    return result;
  });
}

export async function updateSalarySimulation(
  id: string,
  input: Omit<SalarySimulationInput, 'userId'>
): Promise<SalarySimulationRecord> {
  const payload = {
    title: input.title?.trim() || null,
    salary_amount: Number(input.salaryAmount ?? 0),
    period_month: normalizeISODate(input.periodMonth),
    notes: input.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('salary_simulations')
    .update(payload)
    .eq('id', id);

  if (error) throw error;

  await supabase
    .from('salary_simulation_items')
    .delete()
    .eq('simulation_id', id);

  if (input.items?.length) {
    const itemPayload = input.items.map((item) => ({
      simulation_id: id,
      category_id: item.categoryId,
      allocation_amount: Number(item.allocationAmount ?? 0),
      allocation_percent: Number(item.allocationPercent ?? 0),
      notes: item.notes?.trim() || null,
    }));

    const { error: itemError } = await supabase
      .from('salary_simulation_items')
      .insert(itemPayload);

    if (itemError) throw itemError;
  }

  return getSalarySimulationById(id).then((result) => {
    if (!result) throw new Error('Simulasi tidak ditemukan setelah diperbarui');
    return result;
  });
}

export async function deleteSalarySimulation(id: string): Promise<void> {
  await supabase.from('salary_simulation_items').delete().eq('simulation_id', id);
  const { error } = await supabase
    .from('salary_simulations')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function duplicateSalarySimulation(
  sourceId: string,
  overrides: Partial<Omit<SalarySimulationInput, 'userId' | 'items'>> & {
    userId: string;
    items?: SalarySimulationItemInput[];
  }
): Promise<SalarySimulationRecord> {
  const existing = await getSalarySimulationById(sourceId);
  if (!existing) throw new Error('Simulasi sumber tidak ditemukan');

  const payload: SalarySimulationInput = {
    userId: overrides.userId,
    title:
      overrides.title ??
      `${existing.title ?? 'Simulasi Gajian'} (Duplikat ${new Date().toLocaleDateString('id-ID')})`,
    salaryAmount: overrides.salaryAmount ?? existing.salary_amount,
    periodMonth: overrides.periodMonth ?? existing.period_month,
    notes: overrides.notes ?? existing.notes,
    items:
      overrides.items ??
      existing.items.map((item) => ({
        categoryId: item.category_id,
        allocationAmount: item.allocation_amount,
        allocationPercent: item.allocation_percent,
        notes: item.notes,
      })),
  };

  return createSalarySimulation(payload);
}

export async function applySalarySimulationToBudgets(
  simulationId: string,
  userId: string
): Promise<void> {
  const simulation = await getSalarySimulationById(simulationId);
  if (!simulation) {
    throw new Error('Simulasi tidak ditemukan');
  }

  const { items, period_month } = simulation;
  if (!items.length) return;

  const upsertPayload = items.map((item) => ({
    user_id: userId,
    period_month,
    category_id: item.category_id,
    planned: Number(item.allocation_amount ?? 0),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('budgets')
    .upsert(upsertPayload, { onConflict: 'user_id,period_month,category_id' });

  if (error) throw error;
}
