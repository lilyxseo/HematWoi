import { supabase } from './supabase';
import { getCurrentUserId, getUserToken } from './session';

export type BudgetCategoryType = 'income' | 'expense';

export interface BudgetCategoryInfo {
  id: string;
  name: string;
  type: BudgetCategoryType;
  group_name: string | null;
}

export interface BudgetRecord {
  id: string;
  user_id: string;
  period_month: string;
  category_id: string | null;
  planned: number;
  carryover_enabled: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  category?: BudgetCategoryInfo | null;
}

export interface BudgetWithActual extends BudgetRecord {
  actual: number;
  remaining: number;
  percent: number;
}

export interface BudgetSummarySnapshot {
  planned: number;
  actual: number;
  remaining: number;
  progress: number;
}

export interface ListBudgetsParams {
  period: string; // YYYY-MM
  signal?: AbortSignal;
}

export interface BudgetMutationPayload {
  period: string;
  category_id: string | null;
  planned: number;
  carryover_enabled?: boolean;
  notes?: string | null;
}

export interface UpdateBudgetPayload extends Partial<BudgetMutationPayload> {
  id: string;
}

export type BudgetTypeFilter = 'all' | BudgetCategoryType;

let budgetsViewUnavailable = false;
let transactionsDateColumn: 'date' | 'transaction_date' | null = null;

function ensurePeriod(period: string): string {
  if (!period) throw new Error('Periode tidak valid');
  if (/^\d{4}-\d{2}$/.test(period)) return period;
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) return period.slice(0, 7);
  throw new Error('Format periode harus YYYY-MM');
}

function toMonthStart(period: string): string {
  const normalized = ensurePeriod(period);
  return `${normalized}-01`;
}

function getMonthRange(period: string): { start: string; end: string } {
  const normalized = ensurePeriod(period);
  const [year, month] = normalized.split('-').map((value) => Number.parseInt(value, 10));
  if (!year || !month) {
    throw new Error('Periode tidak valid');
  }
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function normalizeNumber(value: unknown, fallback = 0): number {
  if (value == null || value === '') return fallback;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isRelationMissing(error: any, relation: string): boolean {
  if (!error) return false;
  const message = typeof error === 'string' ? error : error?.message ?? '';
  if (typeof message !== 'string') return false;
  const normalized = message.toLowerCase();
  return normalized.includes('relation') && normalized.includes('does not exist') && normalized.includes(relation);
}

async function fetchBudgets(period: string, userId: string, signal?: AbortSignal) {
  const monthStart = toMonthStart(period);

  if (!budgetsViewUnavailable) {
    const viewQuery = supabase
      .from('budgets_v')
      .select(
        'id,user_id,category_id,period_month,amount_planned,amount,carryover_enabled,notes,created_at,updated_at,category_name,category_type,group_name'
      )
      .eq('user_id', userId)
      .eq('period_month', monthStart)
      .order('category_name', { ascending: true });
    if (signal) viewQuery.abortSignal(signal);
    const { data, error } = await viewQuery;
    if (!error) {
      return (data ?? []).map((row: any) => ({
        id: String(row.id),
        user_id: String(row.user_id ?? userId),
        period_month: row.period_month ?? monthStart,
        category_id: row.category_id ?? null,
        planned: normalizeNumber(row.amount_planned ?? row.amount),
        carryover_enabled: Boolean(row.carryover_enabled ?? row.carryoverEnabled ?? false),
        notes: row.notes ?? null,
        created_at: row.created_at ?? new Date().toISOString(),
        updated_at: row.updated_at ?? new Date().toISOString(),
        category: row.category_name
          ? {
              id: row.category_id ? String(row.category_id) : '',
              name: String(row.category_name),
              type: (row.category_type as BudgetCategoryType) ?? 'expense',
              group_name: row.group_name ?? null,
            }
          : null,
      }));
    }
    if (!isRelationMissing(error, 'budgets_v')) {
      throw error;
    }
    budgetsViewUnavailable = true;
  }

  const baseQuery = supabase
    .from('budgets')
    .select(
      'id,user_id,category_id,period_month,amount_planned,carryover_enabled,notes,created_at,updated_at,category:categories(id,name,type,group_name)'
    )
    .eq('user_id', userId)
    .eq('period_month', monthStart)
    .order('created_at', { ascending: false });
  if (signal) baseQuery.abortSignal(signal);
  const { data, error } = await baseQuery;
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    user_id: String(row.user_id ?? userId),
    period_month: row.period_month ?? monthStart,
    category_id: row.category_id ?? null,
    planned: normalizeNumber(row.amount_planned),
    carryover_enabled: Boolean(row.carryover_enabled ?? row.carryoverEnabled ?? false),
    notes: row.notes ?? null,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
    category: row.category
      ? {
          id: row.category.id ? String(row.category.id) : '',
          name: row.category.name ?? 'Tanpa kategori',
          type: (row.category.type as BudgetCategoryType) ?? 'expense',
          group_name: row.category.group_name ?? null,
        }
      : null,
  }));
}

function isMissingColumn(error: any, column: string): boolean {
  if (!error) return false;
  const message = typeof error === 'string' ? error : error?.message ?? '';
  if (typeof message !== 'string') return false;
  const normalized = message.toLowerCase();
  return normalized.includes(column.toLowerCase()) && normalized.includes('column') && normalized.includes('does not exist');
}

async function fetchActualMap(period: string, userId: string, signal?: AbortSignal) {
  const { start, end } = getMonthRange(period);
  const columnsToTry: ('date' | 'transaction_date')[] = transactionsDateColumn
    ? [transactionsDateColumn]
    : ['date', 'transaction_date'];

  for (const column of columnsToTry) {
    const query = supabase
      .from('transactions')
      .select('category_id, amount, date, transaction_date, type, to_account_id')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .is('to_account_id', null)
      .gte(column, start)
      .lt(column, end);
    if (signal) query.abortSignal(signal);
    const { data, error } = await query;
    if (error) {
      if (isMissingColumn(error, column)) {
        continue;
      }
      throw error;
    }
    transactionsDateColumn = column;
    const totals: Record<string, number> = {};
    for (const row of data ?? []) {
      const categoryId = (row as any)?.category_id;
      if (!categoryId) continue;
      const amount = normalizeNumber((row as any)?.amount);
      totals[categoryId] = (totals[categoryId] ?? 0) + amount;
    }
    return totals;
  }

  return {};
}

function enrichBudgetRecord(record: BudgetRecord, actualMap: Record<string, number>): BudgetWithActual {
  const categoryId = record.category_id ?? '';
  const planned = normalizeNumber(record.planned);
  const actual = record.category?.type === 'expense' ? normalizeNumber(actualMap[categoryId]) : 0;
  const remaining = planned - actual;
  const percent = planned > 0 ? actual / planned : 0;
  return {
    ...record,
    planned,
    actual,
    remaining,
    percent,
  };
}

export async function listBudgetsWithActual({ period, signal }: ListBudgetsParams): Promise<BudgetWithActual[]> {
  const normalized = ensurePeriod(period);
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Anda harus login untuk melihat anggaran');
  }

  const [budgetRows, actualMap] = await Promise.all([
    fetchBudgets(normalized, userId, signal),
    fetchActualMap(normalized, userId, signal),
  ]);

  return budgetRows.map((record) => enrichBudgetRecord(record, actualMap));
}

export function buildBudgetSummary(rows: BudgetWithActual[]): BudgetSummarySnapshot {
  if (rows.length === 0) {
    return { planned: 0, actual: 0, remaining: 0, progress: 0 };
  }
  const planned = rows.reduce((acc, row) => acc + normalizeNumber(row.planned), 0);
  const actual = rows.reduce((acc, row) => acc + normalizeNumber(row.actual), 0);
  const remaining = planned - actual;
  const progress = planned > 0 ? actual / planned : 0;
  return { planned, actual, remaining, progress };
}

export async function listBudgetCategories(type: BudgetTypeFilter = 'expense', signal?: AbortSignal): Promise<BudgetCategoryInfo[]> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Anda harus login untuk melihat kategori');
  }
  const query = supabase
    .from('categories')
    .select('id,name,type,group_name')
    .eq('user_id', userId)
    .order('name', { ascending: true });
  if (type !== 'all') {
    query.eq('type', type);
  }
  if (signal) query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    name: row.name ?? 'Tanpa nama',
    type: (row.type as BudgetCategoryType) ?? 'expense',
    group_name: row.group_name ?? null,
  }));
}

function mapMutationPayload(payload: BudgetMutationPayload) {
  return {
    category_id: payload.category_id,
    amount_planned: normalizeNumber(payload.planned),
    carryover_enabled: Boolean(payload.carryover_enabled ?? false),
    notes: payload.notes ?? null,
    period_month: toMonthStart(payload.period),
  };
}

export async function createBudget(payload: BudgetMutationPayload): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Silakan login untuk menambah anggaran');
  }
  await getUserToken();
  const mapped = mapMutationPayload(payload);
  const { error } = await supabase.from('budgets').insert(mapped);
  if (error) throw error;
}

export async function updateBudget({ id, ...patch }: UpdateBudgetPayload): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Silakan login untuk memperbarui anggaran');
  }
  await getUserToken();
  const updates: Record<string, unknown> = {};
  if (patch.period) updates.period_month = toMonthStart(patch.period);
  if (patch.category_id !== undefined) updates.category_id = patch.category_id;
  if (patch.planned != null) updates.amount_planned = normalizeNumber(patch.planned);
  if (patch.carryover_enabled !== undefined) updates.carryover_enabled = Boolean(patch.carryover_enabled);
  if (patch.notes !== undefined) updates.notes = patch.notes ?? null;
  updates.updated_at = new Date().toISOString();
  const { error } = await supabase.from('budgets').update(updates).eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

export async function deleteBudget(id: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Silakan login untuk menghapus anggaran');
  }
  await getUserToken();
  const { error } = await supabase.from('budgets').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

export function getPeriodBounds(period: string): { start: string; end: string } {
  const normalized = ensurePeriod(period);
  const monthStart = toMonthStart(normalized);
  const [year, month] = normalized.split('-').map((value) => Number.parseInt(value, 10));
  if (!year || !month) {
    return { start: monthStart, end: monthStart };
  }
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${normalized}-${String(lastDay).padStart(2, '0')}`;
  return { start: monthStart, end };
}
