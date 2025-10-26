import { supabase } from './supabase';
import { getCurrentUserId } from './session';
import type { ExpenseCategory } from './budgetApi';
import { upsertBudget } from './budgetApi';

export type UUID = string;

type Nullable<T> = T | null;

export interface MonthlyBudgetRow {
  id: UUID;
  category_id: UUID;
  amount_planned: number;
  category: {
    id: UUID;
    name: string | null;
  } | null;
}

export interface SalarySimulationRecord {
  id: UUID;
  user_id: UUID;
  title: Nullable<string>;
  salary_amount: number;
  period_month: string;
  notes: Nullable<string>;
  created_at: string;
  updated_at: string;
}

export interface SalarySimulationItemRecord {
  id: UUID;
  simulation_id: UUID;
  category_id: UUID;
  allocation_amount: number;
  allocation_percent: Nullable<number>;
  notes: Nullable<string>;
  created_at: string;
  updated_at: string;
  category?: {
    id: UUID;
    name: string | null;
    type?: 'income' | 'expense' | null;
  } | null;
}

export interface SalarySimulationWithItems extends SalarySimulationRecord {
  items: SalarySimulationItemRecord[];
}

export interface SalarySimulationItemInput {
  category_id: UUID;
  allocation_amount: number;
  allocation_percent?: number | null;
  notes?: string | null;
}

export interface SalarySimulationPayload {
  title?: string | null;
  salary_amount: number;
  period_month: string;
  notes?: string | null;
  items: SalarySimulationItemInput[];
}

export interface ListSalarySimulationParams {
  periodMonth?: string;
}

function toMonthStart(value: string): string {
  if (!value) throw new Error('Periode tidak valid');
  if (value.length === 7) {
    return `${value}-01`;
  }
  if (value.length === 10) {
    return value;
  }
  throw new Error('Periode harus dalam format YYYY-MM atau YYYY-MM-01');
}

function toPeriod(value: string): string {
  if (value.length === 10) {
    return value.slice(0, 7);
  }
  if (value.length === 7) {
    return value;
  }
  throw new Error('Periode harus dalam format YYYY-MM atau YYYY-MM-01');
}

async function resolveUserId(userId?: string): Promise<string> {
  if (userId) return userId;
  const current = await getCurrentUserId();
  if (!current) {
    throw new Error('Pengguna belum masuk');
  }
  return current;
}

function buildDefaultTitle(periodMonth: string): string {
  try {
    const monthStart = toMonthStart(periodMonth);
    const date = new Date(`${monthStart}T00:00:00.000Z`);
    const formatter = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' });
    return `Simulasi Gajian ${formatter.format(date)}`;
  } catch (_error) {
    return 'Simulasi Gajian';
  }
}

function sanitizeNullableText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function mapCategoryRow(row: any, userId: string): ExpenseCategory {
  return {
    id: row.id as UUID,
    user_id: userId,
    type: 'expense',
    name: (row.name as string) ?? 'Tanpa nama',
    inserted_at: (row.inserted_at as string) ?? row.created_at ?? new Date().toISOString(),
    group_name: (row.group_name as string | null) ?? null,
    order_index: (row.order_index as number | null) ?? (row.sort_order as number | null) ?? null,
  };
}

export async function listExpenseCategories(userId?: string): Promise<ExpenseCategory[]> {
  const resolvedUserId = await resolveUserId(userId);
  const { data, error } = await supabase
    .from('categories')
    .select('id,name,type,group_name,order_index,sort_order,inserted_at,created_at')
    .eq('user_id', resolvedUserId)
    .eq('type', 'expense')
    .order('order_index', { ascending: true, nullsFirst: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as any[]).map((row) => mapCategoryRow(row, resolvedUserId));
}

export async function getMonthlyBudgets(userId: string | undefined, periodMonth: string): Promise<MonthlyBudgetRow[]> {
  const resolvedUserId = await resolveUserId(userId);
  const monthStart = toMonthStart(periodMonth);
  const { data, error } = await supabase
    .from('budgets')
    .select('id,category_id,amount_planned:planned,category:categories(id,name)')
    .eq('user_id', resolvedUserId)
    .eq('period_month', monthStart)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as any[]).map((row) => ({
    id: row.id as UUID,
    category_id: row.category_id as UUID,
    amount_planned: Number(row.amount_planned ?? 0),
    category: row.category ?? null,
  }));
}

async function fetchSimulationById(simulationId: string, userId?: string): Promise<SalarySimulationWithItems> {
  const resolvedUserId = await resolveUserId(userId);
  const { data, error } = await supabase
    .from('salary_simulations')
    .select(
      'id,user_id,title,salary_amount,period_month,notes,created_at,updated_at,items:salary_simulation_items(id,simulation_id,category_id,allocation_amount,allocation_percent,notes,created_at,updated_at,category:categories(id,name,type))'
    )
    .eq('user_id', resolvedUserId)
    .eq('id', simulationId)
    .single();
  if (error) throw error;
  const record = data as SalarySimulationRecord & { items: SalarySimulationItemRecord[] | null };
  return {
    ...record,
    items: (record.items ?? []).map((item) => ({
      ...item,
      allocation_amount: Number(item.allocation_amount ?? 0),
      allocation_percent: item.allocation_percent === null ? null : Number(item.allocation_percent),
    })),
  };
}

export async function getSalarySimulations(
  userId: string | undefined,
  params: ListSalarySimulationParams = {}
): Promise<SalarySimulationWithItems[]> {
  const resolvedUserId = await resolveUserId(userId);
  const query = supabase
    .from('salary_simulations')
    .select(
      'id,user_id,title,salary_amount,period_month,notes,created_at,updated_at,items:salary_simulation_items(id,simulation_id,category_id,allocation_amount,allocation_percent,notes,created_at,updated_at,category:categories(id,name,type))'
    )
    .eq('user_id', resolvedUserId)
    .order('updated_at', { ascending: false });
  if (params.periodMonth) {
    query.eq('period_month', toMonthStart(params.periodMonth));
  }
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as any[]).map((row) => ({
    ...(row as SalarySimulationRecord),
    items: ((row as any).items ?? []).map((item: any) => ({
      ...item,
      allocation_amount: Number(item.allocation_amount ?? 0),
      allocation_percent: item.allocation_percent === null ? null : Number(item.allocation_percent),
    })),
  }));
}

async function replaceSimulationItems(simulationId: string, items: SalarySimulationItemInput[]): Promise<void> {
  const { error: deleteError } = await supabase
    .from('salary_simulation_items')
    .delete()
    .eq('simulation_id', simulationId);
  if (deleteError) throw deleteError;
  if (!items.length) return;
  const payload = items.map((item) => ({
    simulation_id: simulationId,
    category_id: item.category_id,
    allocation_amount: Number(item.allocation_amount ?? 0),
    allocation_percent:
      item.allocation_percent === undefined || item.allocation_percent === null
        ? null
        : Number(item.allocation_percent),
    notes: item.notes ?? null,
  }));
  const { error } = await supabase.from('salary_simulation_items').insert(payload);
  if (error) throw error;
}

export async function createSalarySimulation(
  payload: SalarySimulationPayload,
  userId?: string
): Promise<SalarySimulationWithItems> {
  const resolvedUserId = await resolveUserId(userId);
  const monthStart = toMonthStart(payload.period_month);
  const title = sanitizeNullableText(payload.title) ?? buildDefaultTitle(monthStart);
  const notes = sanitizeNullableText(payload.notes ?? null);
  const { data, error } = await supabase
    .from('salary_simulations')
    .insert({
      user_id: resolvedUserId,
      title,
      salary_amount: Number(payload.salary_amount ?? 0),
      period_month: monthStart,
      notes,
    })
    .select('id')
    .single();
  if (error) throw error;
  const record = data as { id: string };
  await replaceSimulationItems(record.id, payload.items ?? []);
  return fetchSimulationById(record.id, resolvedUserId);
}

export async function updateSalarySimulation(
  id: string,
  payload: SalarySimulationPayload,
  userId?: string
): Promise<SalarySimulationWithItems> {
  const resolvedUserId = await resolveUserId(userId);
  const monthStart = toMonthStart(payload.period_month);
  const title = sanitizeNullableText(payload.title) ?? buildDefaultTitle(monthStart);
  const notes = sanitizeNullableText(payload.notes ?? null);
  const { error } = await supabase
    .from('salary_simulations')
    .update({
      title,
      salary_amount: Number(payload.salary_amount ?? 0),
      period_month: monthStart,
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', resolvedUserId)
    .eq('id', id);
  if (error) throw error;
  await replaceSimulationItems(id, payload.items ?? []);
  return fetchSimulationById(id, resolvedUserId);
}

export async function deleteSalarySimulation(id: string, userId?: string): Promise<void> {
  const resolvedUserId = await resolveUserId(userId);
  const { error } = await supabase.from('salary_simulations').delete().eq('user_id', resolvedUserId).eq('id', id);
  if (error) throw error;
}

export async function duplicateSalarySimulation(id: string, userId?: string): Promise<SalarySimulationWithItems> {
  const original = await fetchSimulationById(id, userId);
  const resolvedUserId = original.user_id;
  const allSimulations = await getSalarySimulations(resolvedUserId, {
    periodMonth: original.period_month,
  });
  const existingTitles = new Set(
    allSimulations.map((item) => (item.title && item.title.trim().length ? item.title.trim() : buildDefaultTitle(item.period_month)))
  );
  const baseTitle = original.title && original.title.trim().length ? original.title.trim() : buildDefaultTitle(original.period_month);
  let candidate = `${baseTitle} (Salinan)`;
  let suffix = 2;
  while (existingTitles.has(candidate)) {
    candidate = `${baseTitle} (Salinan ${suffix})`;
    suffix += 1;
  }
  return createSalarySimulation(
    {
      title: candidate,
      salary_amount: original.salary_amount,
      period_month: original.period_month,
      notes: original.notes,
      items: original.items.map((item) => ({
        category_id: item.category_id,
        allocation_amount: Number(item.allocation_amount ?? 0),
        allocation_percent:
          item.allocation_percent === null || item.allocation_percent === undefined
            ? null
            : Number(item.allocation_percent),
        notes: item.notes ?? null,
      })),
    },
    resolvedUserId
  );
}

export async function applySimulationToBudgets(simulation: SalarySimulationWithItems): Promise<void> {
  const period = toPeriod(simulation.period_month);
  for (const item of simulation.items) {
    if (!item.category_id) continue;
    await upsertBudget({
      category_id: item.category_id,
      period,
      amount_planned: Number(item.allocation_amount ?? 0),
      carryover_enabled: false,
      notes: item.notes ?? undefined,
    });
  }
}

