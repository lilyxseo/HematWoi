import { supabase } from './supabase';
import { getCurrentUserId } from './session';

export interface SalarySimulationRecord {
  id: string;
  user_id: string;
  title: string | null;
  salary_amount: number;
  period_month: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalarySimulationSummary extends SalarySimulationRecord {
  total_allocations: number;
  remaining: number;
  item_count: number;
  period: string;
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
  category: {
    id: string;
    name: string;
    type: 'income' | 'expense' | null;
  } | null;
}

export interface SaveSalarySimulationInput {
  title?: string;
  salaryAmount: number;
  period: string; // YYYY-MM
  notes?: string | null;
}

export interface SaveSimulationItemInput {
  categoryId: string;
  allocationAmount: number;
  allocationPercent?: number | null;
  notes?: string | null;
}

function toMonthStart(period: string): string {
  const [yearStr, monthStr] = String(period ?? '')
    .split('-')
    .map((part) => part.trim());
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    throw new Error('Periode harus dalam format YYYY-MM');
  }
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-01`;
}

function sanitizeText(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeMoney(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Number.parseFloat(value.toFixed(2)));
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Number.parseFloat(parsed.toFixed(2)));
    }
  }
  return 0;
}

function normalizePercent(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.parseFloat(value.toFixed(4));
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return Number.parseFloat(parsed.toFixed(4));
    }
  }
  return null;
}

function normalizeSimulationRow(row: any): SalarySimulationSummary {
  const items: Array<{ allocation_amount?: unknown }> = Array.isArray(row?.items) ? row.items : [];
  const salaryAmount = normalizeMoney(row?.salary_amount);
  const totalAllocations = items.reduce((sum, item) => sum + normalizeMoney(item?.allocation_amount), 0);
  const periodMonth: string = typeof row?.period_month === 'string' ? row.period_month : '';
  const period = periodMonth ? periodMonth.slice(0, 7) : '';
  return {
    id: String(row?.id ?? ''),
    user_id: String(row?.user_id ?? ''),
    title: sanitizeText(row?.title) ?? null,
    salary_amount: salaryAmount,
    period_month: periodMonth,
    period,
    notes: sanitizeText(row?.notes),
    created_at: String(row?.created_at ?? ''),
    updated_at: String(row?.updated_at ?? ''),
    total_allocations: Number.parseFloat(totalAllocations.toFixed(2)),
    remaining: Number.parseFloat((salaryAmount - totalAllocations).toFixed(2)),
    item_count: items.length,
  };
}

function normalizeItemRow(row: any): SalarySimulationItemRecord {
  const allocation = normalizeMoney(row?.allocation_amount);
  const percent = normalizePercent(row?.allocation_percent);
  const category = row?.category;
  return {
    id: String(row?.id ?? ''),
    simulation_id: String(row?.simulation_id ?? ''),
    category_id: String(row?.category_id ?? ''),
    allocation_amount: allocation,
    allocation_percent: percent,
    notes: sanitizeText(row?.notes),
    created_at: String(row?.created_at ?? ''),
    updated_at: String(row?.updated_at ?? ''),
    category: category
      ? {
          id: String(category.id ?? ''),
          name: sanitizeText(category.name) ?? 'Tanpa kategori',
          type:
            category.type === 'income' || category.type === 'expense'
              ? (category.type as 'income' | 'expense')
              : null,
        }
      : null,
  };
}

export async function listSalarySimulations(period?: string): Promise<SalarySimulationSummary[]> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Pengguna belum masuk.');
  }

  const query = supabase
    .from('salary_simulations')
    .select(
      'id,user_id,title,salary_amount,period_month,notes,created_at,updated_at,items:salary_simulation_items(allocation_amount)'
    )
    .eq('user_id', userId)
    .order('period_month', { ascending: false })
    .order('created_at', { ascending: false });

  if (period && period.trim() !== '') {
    try {
      query.eq('period_month', toMonthStart(period));
    } catch (error) {
      throw error instanceof Error ? error : new Error('Periode tidak valid');
    }
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => normalizeSimulationRow(row));
}

export async function createSalarySimulation(
  input: SaveSalarySimulationInput
): Promise<SalarySimulationRecord> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Pengguna belum masuk.');
  }

  const periodMonth = toMonthStart(input.period);
  const payload = {
    user_id: userId,
    title: sanitizeText(input.title) ?? null,
    salary_amount: normalizeMoney(input.salaryAmount),
    period_month: periodMonth,
    notes: sanitizeText(input.notes) ?? null,
  };

  const { data, error } = await supabase
    .from('salary_simulations')
    .insert(payload)
    .select('id,user_id,title,salary_amount,period_month,notes,created_at,updated_at')
    .single();

  if (error) {
    throw error;
  }

  return {
    id: String(data.id),
    user_id: String(data.user_id),
    title: sanitizeText(data.title),
    salary_amount: normalizeMoney(data.salary_amount),
    period_month: String(data.period_month),
    notes: sanitizeText(data.notes),
    created_at: String(data.created_at),
    updated_at: String(data.updated_at),
  };
}

export async function updateSalarySimulation(
  id: string,
  input: SaveSalarySimulationInput
): Promise<SalarySimulationRecord> {
  if (!id) {
    throw new Error('Simulasi tidak ditemukan.');
  }

  const updates: Record<string, unknown> = {
    title: sanitizeText(input.title),
    salary_amount: normalizeMoney(input.salaryAmount),
    notes: sanitizeText(input.notes),
  };

  if (input.period) {
    updates.period_month = toMonthStart(input.period);
  }

  const { data, error } = await supabase
    .from('salary_simulations')
    .update(updates)
    .eq('id', id)
    .select('id,user_id,title,salary_amount,period_month,notes,created_at,updated_at')
    .single();

  if (error) {
    throw error;
  }

  return {
    id: String(data.id),
    user_id: String(data.user_id),
    title: sanitizeText(data.title),
    salary_amount: normalizeMoney(data.salary_amount),
    period_month: String(data.period_month),
    notes: sanitizeText(data.notes),
    created_at: String(data.created_at),
    updated_at: String(data.updated_at),
  };
}

export async function deleteSalarySimulation(id: string): Promise<void> {
  if (!id) {
    throw new Error('Simulasi tidak ditemukan.');
  }
  const { error } = await supabase.from('salary_simulations').delete().eq('id', id);
  if (error) {
    throw error;
  }
}

export async function listSalarySimulationItems(
  simulationId: string
): Promise<SalarySimulationItemRecord[]> {
  if (!simulationId) {
    return [];
  }

  const { data, error } = await supabase
    .from('salary_simulation_items')
    .select(
      'id,simulation_id,category_id,allocation_amount,allocation_percent,notes,created_at,updated_at,category:categories(id,name,type)'
    )
    .eq('simulation_id', simulationId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => normalizeItemRow(row));
}

export async function upsertSalarySimulationItem(
  simulationId: string,
  itemId: string | null,
  input: SaveSimulationItemInput
): Promise<void> {
  if (!simulationId) {
    throw new Error('Simulasi tidak ditemukan.');
  }
  if (!input.categoryId) {
    throw new Error('Kategori harus dipilih.');
  }

  const payload = {
    simulation_id: simulationId,
    category_id: input.categoryId,
    allocation_amount: normalizeMoney(input.allocationAmount),
    allocation_percent: normalizePercent(input.allocationPercent),
    notes: sanitizeText(input.notes),
  };

  if (itemId) {
    const { error } = await supabase
      .from('salary_simulation_items')
      .update(payload)
      .eq('id', itemId);
    if (error) {
      throw error;
    }
  } else {
    const { error } = await supabase.from('salary_simulation_items').insert(payload);
    if (error) {
      throw error;
    }
  }
}

export async function deleteSalarySimulationItem(id: string): Promise<void> {
  if (!id) {
    throw new Error('Item tidak ditemukan.');
  }
  const { error } = await supabase.from('salary_simulation_items').delete().eq('id', id);
  if (error) {
    throw error;
  }
}
