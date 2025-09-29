import { supabase } from './supabase';
import { getCurrentUserId, getUserToken } from './session';
import type { CategoryRecord } from './api-categories';

export type BudgetType = 'income' | 'expense';

export interface BudgetCategoryInfo {
  id: string;
  name: string;
  type: BudgetType;
  group_name: string | null;
}

export interface BudgetRecord {
  id: string;
  user_id: string;
  category_id: string;
  amount_planned: number | null;
  carryover_enabled: boolean | null;
  notes: string | null;
  period_month: string;
  created_at: string;
  updated_at: string;
  category: BudgetCategoryInfo | null;
}

export interface BudgetWithActual extends BudgetRecord {
  planned: number;
  actual: number;
  remaining: number;
  progress: number;
}

export interface BudgetSummary {
  planned: number;
  actual: number;
  remaining: number;
  progress: number;
}

export interface ListBudgetsOptions {
  period: string; // YYYY-MM
  signal?: AbortSignal;
  force?: boolean;
}

export interface CreateBudgetPayload {
  period: string; // YYYY-MM
  category_id: string;
  amount: number;
  carryover_enabled?: boolean;
  notes?: string | null;
}

export interface UpdateBudgetPayload {
  amount?: number;
  carryover_enabled?: boolean;
  notes?: string | null;
}

const CACHE_TTL = 90_000; // 90 seconds
const budgetCache = new Map<string, { timestamp: number; data: BudgetWithActual[] }>();
let budgetsViewAvailable: boolean | null = null;

function now(): number {
  return Date.now();
}

function clampMonth(value: number): number {
  if (value < 1) return 1;
  if (value > 12) return 12;
  return value;
}

export function toMonthStart(period: string): string {
  const [yearStr, monthStr] = (period ?? '').split('-');
  const year = Number.parseInt(yearStr ?? '', 10);
  const month = Number.parseInt(monthStr ?? '', 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    throw new Error('Periode harus dalam format YYYY-MM');
  }
  const normalizedMonth = clampMonth(month);
  return `${year.toString().padStart(4, '0')}-${normalizedMonth.toString().padStart(2, '0')}-01`;
}

export function getMonthRange(period: string): { start: string; end: string } {
  const startDate = new Date(`${toMonthStart(period)}T00:00:00.000Z`);
  const endDate = new Date(startDate);
  endDate.setUTCMonth(endDate.getUTCMonth() + 1);
  const format = (date: Date) => {
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  return {
    start: format(startDate),
    end: format(endDate),
  };
}

function normaliseNumber(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

function computeProgress(actual: number, planned: number): number {
  if (planned <= 0) return actual > 0 ? 1 : 0;
  return actual / planned;
}

function shouldFallbackView(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const message = (error as { message?: unknown }).message;
  const code = (error as { code?: unknown }).code;
  if (code === '42P01' || code === 'PGRST201' || code === 'PGRST204') {
    return true;
  }
  if (typeof message === 'string') {
    const normalised = message.toLowerCase();
    if (normalised.includes('budgets_v') && normalised.includes('does not exist')) {
      return true;
    }
  }
  return false;
}

async function fetchBudgetsBase(
  userId: string,
  period: string,
  signal?: AbortSignal
): Promise<BudgetRecord[]> {
  const monthStart = toMonthStart(period);

  if (budgetsViewAvailable !== false) {
    try {
      let query = supabase
        .from('budgets_v')
        .select(
          'id,user_id,category_id,amount_planned,carryover_enabled,notes,period_month,created_at,updated_at,category_name,category_type,group_name'
        )
        .eq('user_id', userId)
        .eq('period_month', monthStart)
        .order('category_name', { ascending: true });

      if (signal) {
        query = query.abortSignal(signal);
      }

        const { data, error } = await query;
        if (error) throw error;
        budgetsViewAvailable = true;
        return (data ?? []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        category_id: row.category_id,
        amount_planned: row.amount_planned,
        carryover_enabled: row.carryover_enabled,
        notes: row.notes ?? null,
        period_month: row.period_month,
        created_at: row.created_at,
        updated_at: row.updated_at,
        category: {
          id: row.category_id,
          name: row.category_name,
          type: row.category_type ?? 'expense',
          group_name: row.group_name ?? null,
        },
      }));
    } catch (error) {
      if (shouldFallbackView(error)) {
        budgetsViewAvailable = false;
      } else {
        throw error;
      }
    }
  }

  let query = supabase
    .from('budgets')
    .select(
      'id,user_id,category_id,amount_planned,carryover_enabled,notes,period_month,created_at,updated_at,categories(id,name,type,group_name)'
    )
    .eq('user_id', userId)
    .eq('period_month', monthStart)
    .order('created_at', { ascending: true });

  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    category_id: row.category_id,
    amount_planned: row.amount_planned,
    carryover_enabled: row.carryover_enabled,
    notes: row.notes ?? null,
    period_month: row.period_month,
    created_at: row.created_at,
    updated_at: row.updated_at,
    category: row.categories
      ? {
          id: row.categories.id,
          name: row.categories.name,
          type: (row.categories.type as BudgetType) ?? 'expense',
          group_name: row.categories.group_name ?? null,
        }
      : null,
  }));
}

async function fetchActualMap(
  userId: string,
  period: string,
  signal?: AbortSignal
): Promise<Record<string, number>> {
  const { start, end } = getMonthRange(period);
  let query = supabase
    .from('transactions')
    .select('category_id, amount, to_account_id, type, deleted_at, date')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .is('deleted_at', null)
    .is('to_account_id', null)
    .gte('date', start)
    .lt('date', end);

  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query;
  if (error) throw error;
  const result: Record<string, number> = {};
  for (const row of data ?? []) {
    const categoryId = (row as { category_id?: string | null }).category_id;
    if (!categoryId) continue;
    const amount = normaliseNumber((row as { amount?: unknown }).amount);
    result[categoryId] = (result[categoryId] ?? 0) + amount;
  }
  return result;
}

export function buildBudgetSummary(rows: BudgetWithActual[]): BudgetSummary {
  const summary = rows.reduce(
    (acc, row) => {
      acc.planned += row.planned;
      acc.actual += row.actual;
      acc.remaining += row.remaining;
      return acc;
    },
    { planned: 0, actual: 0, remaining: 0, progress: 0 }
  );
  summary.progress = summary.planned > 0 ? summary.actual / summary.planned : 0;
  return summary;
}

function mapToWithActual(
  budgets: BudgetRecord[],
  actualMap: Record<string, number>
): BudgetWithActual[] {
  return budgets.map((budget) => {
    const planned = normaliseNumber(budget.amount_planned);
    const actual = normaliseNumber(actualMap[budget.category_id]);
    const remaining = planned - actual;
    return {
      ...budget,
      planned,
      actual,
      remaining,
      progress: computeProgress(actual, planned),
    };
  });
}

export async function listBudgetsWithActual({
  period,
  signal,
  force = false,
}: ListBudgetsOptions): Promise<BudgetWithActual[]> {
  const cacheKey = period;
  if (!force) {
    const cached = budgetCache.get(cacheKey);
    if (cached && now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Pengguna belum masuk');
  }

  const [budgets, actualMap] = await Promise.all([
    fetchBudgetsBase(userId, period, signal),
    fetchActualMap(userId, period, signal),
  ]);

  const merged = mapToWithActual(budgets, actualMap);
  budgetCache.set(cacheKey, { timestamp: now(), data: merged });
  return merged;
}

export function invalidateBudgetsCache(period?: string) {
  if (!period) {
    budgetCache.clear();
    return;
  }
  budgetCache.delete(period);
}

function ensureNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

export async function createBudget(payload: CreateBudgetPayload): Promise<BudgetWithActual> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Pengguna belum masuk');
  await getUserToken();

  const insertPayload = {
    user_id: userId,
    category_id: payload.category_id,
    amount_planned: ensureNumber(payload.amount),
    carryover_enabled: payload.carryover_enabled ?? false,
    notes: payload.notes ?? null,
    period_month: toMonthStart(payload.period),
  };

  const { data, error } = await supabase
    .from('budgets')
    .insert(insertPayload)
    .select(
      'id,user_id,category_id,amount_planned,carryover_enabled,notes,period_month,created_at,updated_at,categories(id,name,type,group_name)'
    )
    .single();

  if (error) {
    throw new Error(error.message || 'Gagal menyimpan anggaran');
  }

  invalidateBudgetsCache(payload.period);

  const record: BudgetRecord = {
    id: data.id,
    user_id: data.user_id,
    category_id: data.category_id,
    amount_planned: ensureNumber(data.amount_planned),
    carryover_enabled: Boolean(data.carryover_enabled),
    notes: data.notes ?? null,
    period_month: data.period_month,
    created_at: data.created_at,
    updated_at: data.updated_at,
    category: data.categories
      ? {
          id: data.categories.id,
          name: data.categories.name,
          type: (data.categories.type as BudgetType) ?? 'expense',
          group_name: data.categories.group_name ?? null,
        }
      : null,
  };

  return {
    ...record,
    planned: ensureNumber(record.amount_planned),
    actual: 0,
    remaining: ensureNumber(record.amount_planned),
    progress: 0,
  };
}

export async function updateBudget(id: string, payload: UpdateBudgetPayload, period: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Pengguna belum masuk');
  await getUserToken();

  const updatePayload: Record<string, unknown> = {};
  if (payload.amount !== undefined) {
    updatePayload.amount_planned = ensureNumber(payload.amount);
  }
  if (payload.carryover_enabled !== undefined) {
    updatePayload.carryover_enabled = payload.carryover_enabled;
  }
  if (payload.notes !== undefined) {
    updatePayload.notes = payload.notes ?? null;
  }

  if (Object.keys(updatePayload).length === 0) return;

  const { error } = await supabase
    .from('budgets')
    .update(updatePayload)
    .eq('user_id', userId)
    .eq('id', id);

  if (error) {
    throw new Error(error.message || 'Gagal memperbarui anggaran');
  }

  invalidateBudgetsCache(period);
}

export async function deleteBudget(id: string, period: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Pengguna belum masuk');
  await getUserToken();

  const { error } = await supabase.from('budgets').delete().eq('user_id', userId).eq('id', id);
  if (error) {
    throw new Error(error.message || 'Gagal menghapus anggaran');
  }
  invalidateBudgetsCache(period);
}

export function mapCategoryRecordToInfo(category: CategoryRecord): BudgetCategoryInfo {
  return {
    id: category.id,
    name: category.name,
    type: category.type,
    group_name: (category as { group_name?: string | null }).group_name ?? null,
  };
}
