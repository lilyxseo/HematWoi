import { supabase } from './supabase';
import { getCurrentUserId, getUserToken } from './session';

export type UUID = string;

type Nullable<T> = T | null;

function ensureAuth(userId: Nullable<string>): asserts userId is string {
  if (!userId) {
    throw new Error('Pengguna belum masuk');
  }
}

function normalizeMonthStart(value: string): string {
  if (!value) {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    return `${year}-${month}-01`;
  }
  if (/^\d{4}-\d{2}$/.test(value)) {
    return `${value}-01`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value.slice(0, 7)}-01`;
  }
  return value;
}

function buildDefaultTitle(periodMonth: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('id-ID', {
      month: 'long',
      year: 'numeric',
    });
    const [year, month] = periodMonth.split('-');
    if (!year || !month) throw new Error('Invalid month');
    const date = new Date(Number(year), Number(month) - 1, 1);
    const label = formatter.format(date);
    return `Simulasi Gajian ${label}`;
  } catch (_error) {
    return 'Simulasi Gajian';
  }
}

export interface ExpenseCategoryRow {
  id: UUID;
  name: string;
  group_name?: string | null;
  color?: string | null;
}

export async function listExpenseCategories(userId?: string): Promise<ExpenseCategoryRow[]> {
  const resolvedUserId = userId ?? (await getCurrentUserId());
  ensureAuth(resolvedUserId);
  const { data, error } = await supabase
    .from('categories')
    .select('id,name,group_name,color,type')
    .eq('user_id', resolvedUserId)
    .eq('type', 'expense')
    .order('group_name', { ascending: true, nullsFirst: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as UUID,
    name: row.name as string,
    group_name: (row as { group_name?: string | null }).group_name ?? null,
    color: (row as { color?: string | null }).color ?? null,
  }));
}

export interface MonthlyBudgetRow {
  id: UUID;
  category_id: UUID | null;
  amount_planned: number;
  carryover_enabled?: boolean;
  notes?: string | null;
  category?: { id: UUID; name: string | null } | null;
}

function isCarryRuleEnabled(value: unknown): boolean {
  if (!value) return false;
  const normalized = String(value).toLowerCase();
  return normalized === 'carry-positive' || normalized === 'carry-all';
}

function mapMonthlyBudgetRows(rows: Record<string, any>[]): MonthlyBudgetRow[] {
  return rows.map((row) => {
    const carryover =
      typeof row.carryover_enabled === 'boolean'
        ? row.carryover_enabled
        : isCarryRuleEnabled((row as { carry_rule?: string | null }).carry_rule);

    const plannedValue = (row as { planned?: number | null; amount_planned?: number | null }).planned;
    const amountPlanned = Number(plannedValue ?? (row as { amount_planned?: number | null }).amount_planned ?? 0);

    return {
      id: row.id as UUID,
      category_id: (row.category_id as UUID) ?? null,
      amount_planned: amountPlanned,
      carryover_enabled: carryover,
      notes: (row as { notes?: string | null }).notes ?? null,
      category: (row as { category?: { id: UUID; name: string | null } | null }).category ?? null,
    };
  });
}

function isMissingColumn(error: unknown, column: string): boolean {
  if (!error) return false;
  const code = (error as { code?: string }).code;
  if (code && code === '42703') {
    return true;
  }
  const message = typeof error === 'string' ? error : (error as { message?: string })?.message ?? '';
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes('does not exist') && normalized.includes(`column ${column.toLowerCase()}`);
}

export async function getMonthlyBudgets(periodMonth: string, userId?: string): Promise<MonthlyBudgetRow[]> {
  const resolvedUserId = userId ?? (await getCurrentUserId());
  ensureAuth(resolvedUserId);
  const normalized = normalizeMonthStart(periodMonth);
  const selection = 'id,category_id,planned,carryover_enabled,carry_rule,notes,category:categories(id,name)';

  const { data, error } = await supabase
    .from('budgets')
    .select(selection)
    .eq('user_id', resolvedUserId)
    .eq('period_month', normalized)
    .order('created_at', { ascending: true });

  if (error) {
    if (!isMissingColumn(error, 'carryover_enabled')) {
      throw error;
    }

    const fallback = await supabase
      .from('budgets')
      .select('id,category_id,planned,carry_rule,notes,category:categories(id,name)')
      .eq('user_id', resolvedUserId)
      .eq('period_month', normalized)
      .order('created_at', { ascending: true });

    if (fallback.error) throw fallback.error;
    return mapMonthlyBudgetRows(fallback.data ?? []);
  }

  return mapMonthlyBudgetRows(data ?? []);
}

export interface SalarySimulationItemInput {
  categoryId: UUID;
  allocationAmount: number;
  allocationPercent?: number | null;
  notes?: string | null;
}

export interface SaveSalarySimulationPayload {
  title?: string | null;
  salaryAmount: number;
  periodMonth: string;
  notes?: string | null;
  items: SalarySimulationItemInput[];
}

export interface SalarySimulationItemRow {
  id: UUID;
  simulation_id: UUID;
  category_id: UUID;
  allocation_amount: number;
  allocation_percent: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  category?: { id: UUID; name: string | null } | null;
}

export interface SalarySimulationRow {
  id: UUID;
  user_id: UUID;
  title: string | null;
  salary_amount: number;
  period_month: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items?: SalarySimulationItemRow[];
}

export async function getSalarySimulations(
  userId?: string,
  options: { periodMonth?: string } = {}
): Promise<SalarySimulationRow[]> {
  const resolvedUserId = userId ?? (await getCurrentUserId());
  ensureAuth(resolvedUserId);
  const { periodMonth } = options;
  let query = supabase
    .from('salary_simulations')
    .select(
      'id,user_id,title,salary_amount,period_month,notes,created_at,updated_at,' +
        'items:salary_simulation_items(id,simulation_id,category_id,allocation_amount,allocation_percent,notes,created_at,updated_at,category:categories(id,name))'
    )
    .eq('user_id', resolvedUserId)
    .order('updated_at', { ascending: false });
  if (periodMonth) {
    query = query.eq('period_month', normalizeMonthStart(periodMonth));
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as SalarySimulationRow[];
}

export async function getSalarySimulationById(id: UUID, userId?: string): Promise<SalarySimulationRow | null> {
  const resolvedUserId = userId ?? (await getCurrentUserId());
  ensureAuth(resolvedUserId);
  const { data, error } = await supabase
    .from('salary_simulations')
    .select(
      'id,user_id,title,salary_amount,period_month,notes,created_at,updated_at,' +
        'items:salary_simulation_items(id,simulation_id,category_id,allocation_amount,allocation_percent,notes,created_at,updated_at,category:categories(id,name))'
    )
    .eq('user_id', resolvedUserId)
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }
  return (data as unknown as SalarySimulationRow) ?? null;
}

async function writeGuard() {
  try {
    await getUserToken();
  } catch (error) {
    if (error instanceof Error && error.message === 'Not signed in') {
      throw new Error('Silakan login untuk menyimpan simulasi');
    }
    throw error;
  }
}

function mapItemInput(simulationId: UUID, item: SalarySimulationItemInput) {
  return {
    simulation_id: simulationId,
    category_id: item.categoryId,
    allocation_amount: Number(item.allocationAmount ?? 0),
    allocation_percent:
      item.allocationPercent === null || item.allocationPercent === undefined
        ? null
        : Number(item.allocationPercent ?? 0),
    notes: item.notes ?? null,
  };
}

export async function createSalarySimulation(payload: SaveSalarySimulationPayload): Promise<SalarySimulationRow> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);
  await writeGuard();
  const normalized = normalizeMonthStart(payload.periodMonth);
  const insertPayload = {
    user_id: userId,
    title: payload.title?.trim() || buildDefaultTitle(normalized),
    salary_amount: Number(payload.salaryAmount ?? 0),
    period_month: normalized,
    notes: payload.notes?.trim() || null,
  };
  const { data, error } = await supabase
    .from('salary_simulations')
    .insert(insertPayload)
    .select('id')
    .single();
  if (error) throw error;
  const simulationId = (data?.id as UUID) ?? null;
  if (!simulationId) {
    throw new Error('Gagal membuat simulasi');
  }
  if (payload.items?.length) {
    const itemsPayload = payload.items.map((item) => mapItemInput(simulationId, item));
    const { error: itemError } = await supabase.from('salary_simulation_items').insert(itemsPayload);
    if (itemError) throw itemError;
  }
  const simulation = await getSalarySimulationById(simulationId, userId);
  if (!simulation) {
    throw new Error('Simulasi tidak ditemukan setelah dibuat');
  }
  return simulation;
}

export async function updateSalarySimulation(
  id: UUID,
  payload: SaveSalarySimulationPayload,
  userId?: string
): Promise<SalarySimulationRow> {
  const resolvedUserId = userId ?? (await getCurrentUserId());
  ensureAuth(resolvedUserId);
  await writeGuard();
  const normalized = normalizeMonthStart(payload.periodMonth);
  const { error: updateError } = await supabase
    .from('salary_simulations')
    .update({
      title: payload.title?.trim() || buildDefaultTitle(normalized),
      salary_amount: Number(payload.salaryAmount ?? 0),
      period_month: normalized,
      notes: payload.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', resolvedUserId)
    .eq('id', id);
  if (updateError) throw updateError;

  const { error: deleteError } = await supabase
    .from('salary_simulation_items')
    .delete()
    .eq('simulation_id', id);
  if (deleteError) throw deleteError;

  if (payload.items?.length) {
    const itemsPayload = payload.items.map((item) => mapItemInput(id, item));
    const { error: insertError } = await supabase.from('salary_simulation_items').insert(itemsPayload);
    if (insertError) throw insertError;
  }

  const simulation = await getSalarySimulationById(id, resolvedUserId);
  if (!simulation) {
    throw new Error('Simulasi tidak ditemukan setelah diperbarui');
  }
  return simulation;
}

export async function deleteSalarySimulation(id: UUID, userId?: string): Promise<void> {
  const resolvedUserId = userId ?? (await getCurrentUserId());
  ensureAuth(resolvedUserId);
  await writeGuard();
  const { error: deleteItemsError } = await supabase
    .from('salary_simulation_items')
    .delete()
    .eq('simulation_id', id);
  if (deleteItemsError) throw deleteItemsError;
  const { error } = await supabase
    .from('salary_simulations')
    .delete()
    .eq('user_id', resolvedUserId)
    .eq('id', id);
  if (error) throw error;
}

export async function duplicateSalarySimulation(id: UUID, userId?: string): Promise<SalarySimulationRow> {
  const resolvedUserId = userId ?? (await getCurrentUserId());
  ensureAuth(resolvedUserId);
  await writeGuard();
  const source = await getSalarySimulationById(id, resolvedUserId);
  if (!source) {
    throw new Error('Simulasi sumber tidak ditemukan');
  }
  const normalized = normalizeMonthStart(source.period_month);
  const existing = await getSalarySimulations(resolvedUserId, { periodMonth: normalized });
  const existingTitles = new Set(existing.map((item) => (item.title ?? '').trim()));
  let suffix = 1;
  const baseName = source.title?.trim() || buildDefaultTitle(normalized);
  let candidate = `${baseName} (Salinan)`;
  while (existingTitles.has(candidate)) {
    suffix += 1;
    candidate = `${baseName} (Salinan ${suffix})`;
  }
  const clone = await createSalarySimulation({
    title: candidate,
    salaryAmount: source.salary_amount,
    periodMonth: normalized,
    notes: source.notes ?? null,
    items: (source.items ?? []).map((item) => ({
      categoryId: item.category_id,
      allocationAmount: item.allocation_amount,
      allocationPercent: item.allocation_percent ?? undefined,
      notes: item.notes ?? null,
    })),
  });
  return clone;
}
