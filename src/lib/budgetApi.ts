// src/lib/budgets.ts (contoh nama file)

import { supabase } from './supabase';
import { getCurrentUserId, getUserToken } from './session';
import { listCategories as listAllCategories } from './api-categories';
import { buildSupabaseHeaders, createRestUrl } from './supabaseRest';

export type BudgetType = 'monthly' | 'weekly';

type UUID = string;

type Nullable<T> = T | null;

export interface ExpenseCategory {
  id: UUID;
  user_id: UUID;
  type: 'income' | 'expense';
  name: string;
  inserted_at: string;
  group_name: Nullable<string>;
  order_index: Nullable<number>;
}

const FALLBACK_CATEGORY_INSERTED_AT = '1970-01-01T00:00:00.000Z';

const CATEGORY_SELECT_COLUMNS = 'id,user_id,type,name,inserted_at,group_name,order_index';
const CATEGORY_ORDER = 'order_index.asc.nullsfirst,name.asc';

let categoriesViewUnavailable = false;
let categoriesFallbackWarned = false;

const isDevelopment = Boolean(
  (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.DEV) ||
    (typeof process !== 'undefined' && (process as any)?.env?.NODE_ENV === 'development')
);

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

async function parsePostgrestError(response: Response, fallback: string): Promise<Error> {
  let message = fallback;
  try {
    const body = await response.json();
    if ((body as any)?.message) {
      message = (body as any).message as string;
    }
  } catch (error) {
    if (isDevelopment) {
      console.warn('[HW] Failed to parse PostgREST error response', error);
    }
  }
  const err = new Error(message);
  (err as { status?: number }).status = response.status;
  return err;
}

function parseOrderIndex(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function mapCategoryRecordToExpense(category: {
  id: string;
  user_id: string | null;
  name: string;
  type: string;
  inserted_at?: string | null;
  created_at?: string | null;
  group_name?: string | null;
  order_index?: number | null;
  sort_order?: number | null;
}): ExpenseCategory {
  return {
    id: category.id as UUID,
    user_id: (category.user_id ?? 'local') as UUID,
    type: 'expense',
    name: category.name,
    inserted_at:
      category.inserted_at ??
      category.created_at ??
      FALLBACK_CATEGORY_INSERTED_AT,
    group_name: category.group_name ?? null,
    order_index: (category.order_index ?? category.sort_order) ?? null,
  };
}

export interface BudgetRow {
  id: UUID;
  user_id: UUID;
  category_id: UUID;
  amount_planned: number;
  carryover_enabled: boolean;
  notes: Nullable<string>;
  period_month: string; // ISO date (YYYY-MM-01)
  created_at: string;
  updated_at: string;
  category: {
    id: UUID;
    name: string;
  } | null;
}

export interface BudgetSpentRow {
  category_id: UUID;
  amount: number;
}

export interface BudgetWithSpent extends BudgetRow {
  spent: number;
  remaining: number;
}

export interface BudgetSummary {
  planned: number;
  spent: number;
  remaining: number;
  percentage: number;
}

export interface WeeklyBudgetRow {
  id: UUID;
  user_id: UUID;
  category_id: UUID;
  amount_planned: number;
  notes: Nullable<string>;
  week_start: string; // ISO date YYYY-MM-DD (Monday)
  created_at: string;
  updated_at: string;
  category: {
    id: UUID;
    name: string;
    type: 'income' | 'expense';
  } | null;
}

export interface WeeklyBudgetWithActual extends WeeklyBudgetRow {
  week_end: string;
  actual: number;
  remaining: number;
  percentage: number;
}

export interface WeeklyBudgetCategorySummary {
  category_id: UUID;
  category_name: string | null;
  category_type: 'income' | 'expense' | null;
  planned: number;
  actual: number;
  remaining: number;
  percentage: number;
}

export interface WeeklyBudgetsResult {
  rows: WeeklyBudgetWithActual[];
  summaries: WeeklyBudgetCategorySummary[];
}

export interface UpsertWeeklyBudgetInput {
  id?: UUID;
  category_id: UUID;
  week_start: string; // YYYY-MM-DD (Monday)
  amount_planned: number;
  notes?: Nullable<string>;
}

export interface HighlightBudgetRecord {
  id: UUID;
  budget_id: UUID;
  budget_type: BudgetType;
  created_at: string;
}

export interface HighlightedBudgetDetail {
  highlight_id: UUID;
  budget_type: BudgetType;
  budget_id: UUID;
  category_id: UUID | null;
  category_name: string | null;
  category_type: 'income' | 'expense' | null;
  planned: number;
  actual: number;
  remaining: number;
  percentage: number;
  label: string;
}

export interface UpsertBudgetInput {
  id?: UUID;
  category_id: UUID;
  period: string; // YYYY-MM
  amount_planned: number;
  carryover_enabled: boolean;
  notes?: Nullable<string>;
}

function ensureAuth(userId: Nullable<string>): asserts userId is string {
  if (!userId) {
    throw new Error('Pengguna belum masuk.');
  }
}

function toMonthStart(period: string): string {
  if (!period) throw new Error('Periode tidak valid');
  const [yearStr, monthStr] = period.split('-');
  if (!yearStr || !monthStr) throw new Error('Periode harus dalam format YYYY-MM');
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    throw new Error('Periode harus dalam format YYYY-MM');
  }
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-01`;
}

function getPreviousPeriod(period: string): string | null {
  try {
    const [yearStr, monthStr] = period.split('-');
    if (!yearStr || !monthStr) return null;
    const year = Number.parseInt(yearStr, 10);
    const month = Number.parseInt(monthStr, 10);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
    const current = new Date(Date.UTC(year, month - 1, 1));
    current.setUTCMonth(current.getUTCMonth() - 1);
    const prevYear = current.getUTCFullYear();
    const prevMonth = (current.getUTCMonth() + 1).toString().padStart(2, '0');
    return `${prevYear}-${prevMonth}`;
  } catch (error) {
    if (isDevelopment) {
      console.warn('[HW] Failed to resolve previous period', error);
    }
    return null;
  }
}

async function fetchBudgetsForPeriod(userId: string, period: string): Promise<BudgetRow[]> {
  const { data, error } = await supabase
    .from('budgets')
    .select(
      'id,user_id,category_id,amount_planned,carryover_enabled,notes,period_month,created_at,updated_at,category:categories(id,name)'
    )
    .eq('user_id', userId)
    .eq('period_month', toMonthStart(period))
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BudgetRow[];
}

export function getMonthRange(period: string): { start: string; end: string } {
  const start = new Date(`${toMonthStart(period)}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const format = (date: Date) => {
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  return {
    start: format(start),
    end: format(end),
  };
}

function toUtcDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeWeekStart(value: string): string {
  if (!value) {
    throw new Error('Tanggal minggu wajib diisi');
  }
  const date = toUtcDateOnly(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Tanggal minggu tidak valid');
  }
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Adjust to Monday
  date.setUTCDate(date.getUTCDate() + diff);
  return formatIsoDate(date);
}

export async function listCategoriesExpense(): Promise<ExpenseCategory[]> {
  async function fetchFromCloud(): Promise<ExpenseCategory[]> {
    const userId = await getCurrentUserId();
    ensureAuth(userId);
    return listExpenseCategories(userId);
  }

  try {
    const rows = await fetchFromCloud();
    return rows;
  } catch (error) {
    // Fallback handled below when cloud fetch fails (e.g. offline or guest mode)
    if (isDevelopment && error instanceof Error) {
      console.warn('[HW] listCategoriesExpense fallback', error);
    }
  }

  const localCategories = await listAllCategories();
  return localCategories
    .filter((category) => category.type === 'expense')
    .map((category) =>
      mapCategoryRecordToExpense({
        id: category.id,
        user_id: category.user_id,
        name: category.name,
        type: category.type,
        created_at: category.created_at,
        order_index: category.sort_order,
      })
    );
}

async function fetchExpenseCategoriesRemote(
  userId: string,
  signal?: AbortSignal
): Promise<ExpenseCategory[]> {
  const params = new URLSearchParams({
    select: CATEGORY_SELECT_COLUMNS,
    user_id: `eq.${userId}`,
    type: 'eq.expense',
    order: CATEGORY_ORDER,
  });
  const headers = buildSupabaseHeaders();

  if (!categoriesViewUnavailable) {
    const viewUrl = createRestUrl('/rest/v1/v_categories_budget', params);
    const response = await fetch(viewUrl, { headers, signal });
    if (response.status === 404) {
      categoriesViewUnavailable = true;
      if (!categoriesFallbackWarned) {
        console.warn('v_categories_budget missing — using fallback /categories');
        categoriesFallbackWarned = true;
      }
    } else if (!response.ok) {
      throw await parsePostgrestError(response, 'Gagal memuat kategori pengeluaran');
    } else {
      const data = ((await response.json()) ?? []) as Record<string, unknown>[];
      return data.map((row) =>
        mapCategoryRecordToExpense({
          id: String(row.id ?? ''),
          user_id: typeof row.user_id === 'string' ? row.user_id : userId,
          name: String(row.name ?? ''),
          type: 'expense',
          inserted_at: typeof row.inserted_at === 'string' ? row.inserted_at : undefined,
          group_name: (row.group_name as string | null | undefined) ?? null,
          order_index: parseOrderIndex((row as any).order_index),
        })
      );
    }
  }

  const fallbackUrl = createRestUrl('/rest/v1/categories', params);
  const fallbackResponse = await fetch(fallbackUrl, { headers, signal });
  if (fallbackResponse.status === 404) {
    throw new Error('Endpoint kategori belum tersedia');
  }
  if (!fallbackResponse.ok) {
    throw await parsePostgrestError(fallbackResponse, 'Gagal memuat kategori pengeluaran');
  }
  const fallbackData = ((await fallbackResponse.json()) ?? []) as Record<string, unknown>[];
  return fallbackData.map((row) =>
    mapCategoryRecordToExpense({
      id: String(row.id ?? ''),
      user_id: typeof row.user_id === 'string' ? row.user_id : userId,
      name: String(row.name ?? ''),
      type: 'expense',
      inserted_at: typeof row.inserted_at === 'string' ? row.inserted_at : undefined,
      group_name: (row.group_name as string | null | undefined) ?? null,
      order_index: parseOrderIndex((row as any).order_index),
    })
  );
}

export async function listExpenseCategories(
  userId: string,
  signal?: AbortSignal
): Promise<ExpenseCategory[]> {
  try {
    return await fetchExpenseCategoriesRemote(userId, signal);
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw error;
  }
}

export async function listBudgets(period: string): Promise<BudgetRow[]> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);
  const currentBudgets = await fetchBudgetsForPeriod(userId, period);
  const existingCategoryIds = new Set(
    currentBudgets
      .map((row) => row.category_id)
      .filter((value): value is string => Boolean(value))
  );

  const previousPeriod = getPreviousPeriod(period);
  if (!previousPeriod) {
    return currentBudgets;
  }

  const previousBudgets = await fetchBudgetsForPeriod(userId, previousPeriod);
  const toCarryOver = previousBudgets.filter(
    (row) => row.carryover_enabled && row.category_id && !existingCategoryIds.has(row.category_id)
  );

  if (!toCarryOver.length) {
    return currentBudgets;
  }

  const results = await Promise.allSettled(
    toCarryOver.map((row) =>
      upsertBudget({
        category_id: row.category_id as string,
        period,
        amount_planned: Number(row.amount_planned ?? 0),
        carryover_enabled: true,
        notes: row.notes ?? undefined,
      })
    )
  );

  const hasSuccess = results.some((result) => result.status === 'fulfilled');
  if (!hasSuccess) {
    return currentBudgets;
  }

  return fetchBudgetsForPeriod(userId, period);
}

export async function computeSpent(period: string): Promise<Record<string, number>> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);
  const { start, end } = getMonthRange(period);
  const { data, error } = await supabase
    .from('transactions')
    .select('category_id, amount, date, to_account_id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .eq('type', 'expense')
    .is('to_account_id', null)
    .gte('date', start)
    .lt('date', end);
  if (error) throw error;
  const totals: Record<string, number> = {};
  for (const row of (data ?? []) as any[]) {
    const categoryId = row?.category_id as string | null;
    if (!categoryId) continue;
    const amount = Number(row?.amount ?? 0);
    if (!Number.isFinite(amount)) continue;
    totals[categoryId] = (totals[categoryId] ?? 0) + amount;
  }
  return totals;
}

export async function listWeeklyBudgets(period: string): Promise<WeeklyBudgetsResult> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);

  const { start: monthStart, end: monthEndExclusive } = getMonthRange(period);
  const monthEndExclusiveDate = toUtcDateOnly(monthEndExclusive);
  const monthEndInclusive = new Date(monthEndExclusiveDate);
  monthEndInclusive.setUTCDate(monthEndInclusive.getUTCDate() - 1);

  const [budgetResult, txResult] = await Promise.all([
    supabase
      .from('budgets_weekly')
      .select(
        'id,user_id,category_id,amount_planned,notes,week_start,created_at,updated_at,category:categories(id,name,type)'
      )
      .eq('user_id', userId)
      .gte('week_start', monthStart)
      .lt('week_start', monthEndExclusive)
      .order('week_start', { ascending: true }),
    supabase
      .from('transactions')
      .select('category_id, amount, date')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .eq('type', 'expense')
      .is('to_account_id', null)
      .gte('date', monthStart)
      .lt('date', monthEndExclusive),
  ]);

  if (budgetResult.error) throw budgetResult.error;
  if (txResult.error) throw txResult.error;

  const budgets = ((budgetResult.data ?? []) as WeeklyBudgetRow[]).map((row) => ({
    ...row,
    week_start: normalizeWeekStart(row.week_start),
  }));

  const transactions = (txResult.data ?? []) as { category_id: string | null; amount: number; date: string }[];

  const transactionsByCategory = new Map<string, { amount: number; date: string }[]>();
  const categoryTotals = new Map<string, number>();

  for (const tx of transactions) {
    const categoryId = tx.category_id;
    if (!categoryId) continue;
    const amount = Number(tx.amount ?? 0);
    if (!Number.isFinite(amount)) continue;
    const list = transactionsByCategory.get(categoryId) ?? [];
    list.push({ amount, date: tx.date });
    transactionsByCategory.set(categoryId, list);
    categoryTotals.set(categoryId, (categoryTotals.get(categoryId) ?? 0) + amount);
  }

  const summaryMap = new Map<string, WeeklyBudgetCategorySummary>();

  const rows: WeeklyBudgetWithActual[] = budgets.map((budget) => {
    const planned = Number(budget.amount_planned ?? 0);
    const weekStartDate = toUtcDateOnly(budget.week_start);
    const weekExclusiveEnd = new Date(weekStartDate);
    weekExclusiveEnd.setUTCDate(weekExclusiveEnd.getUTCDate() + 7);
    const weekInclusiveEnd = new Date(weekExclusiveEnd);
    weekInclusiveEnd.setUTCDate(weekInclusiveEnd.getUTCDate() - 1);

    const effectiveWeekEnd = weekInclusiveEnd > monthEndInclusive ? monthEndInclusive : weekInclusiveEnd;
    const txList = transactionsByCategory.get(budget.category_id) ?? [];
    let actual = 0;
    for (const tx of txList) {
      const txDate = toUtcDateOnly(tx.date);
      if (txDate >= weekStartDate && txDate < weekExclusiveEnd) {
        actual += Number(tx.amount ?? 0);
      }
    }
    const remaining = planned - actual;
    const percentage = planned > 0 ? actual / planned : 0;

    const summary = summaryMap.get(budget.category_id) ?? {
      category_id: budget.category_id,
      category_name: budget.category?.name ?? null,
      category_type: budget.category?.type ?? null,
      planned: 0,
      actual: 0,
      remaining: 0,
      percentage: 0,
    };
    summary.planned += planned;
    summaryMap.set(budget.category_id, summary);

    return {
      ...budget,
      week_end: formatIsoDate(effectiveWeekEnd),
      actual,
      remaining,
      percentage,
    };
  });

  const summaries: WeeklyBudgetCategorySummary[] = Array.from(summaryMap.values()).map((summary) => {
    const actual = categoryTotals.get(summary.category_id) ?? 0;
    const remaining = summary.planned - actual;
    const percentage = summary.planned > 0 ? actual / summary.planned : 0;
    return {
      ...summary,
      actual,
      remaining,
      percentage,
    };
  });

  return { rows, summaries };
}

export async function upsertWeeklyBudget(input: UpsertWeeklyBudgetInput): Promise<void> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);

  try {
    await getUserToken();
  } catch (error) {
    if (error instanceof Error && error.message === 'Not signed in') {
      throw new Error('Silakan login untuk menyimpan anggaran');
    }
    throw error;
  }

  const payload = {
    id: input.id ?? undefined,
    user_id: userId,
    category_id: input.category_id,
    week_start: normalizeWeekStart(input.week_start),
    amount_planned: Number(input.amount_planned ?? 0),
    notes: input.notes ?? null,
  };

  const { error } = await supabase.from('budgets_weekly').upsert(payload, { onConflict: 'id' });
  if (error) {
    if (error.message === 'Unauthorized' || error.code === '401' || error.code === 'PGRST301') {
      throw new Error('Silakan login untuk menyimpan anggaran');
    }
    throw error;
  }
}

export async function deleteWeeklyBudget(id: UUID): Promise<void> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);
  const { error } = await supabase.from('budgets_weekly').delete().eq('user_id', userId).eq('id', id);
  if (error) throw error;
}

export async function listHighlightBudgets(): Promise<HighlightBudgetRecord[]> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);
  const { data, error } = await supabase
    .from('user_highlight_budgets')
    .select('id,budget_id,budget_type,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as HighlightBudgetRecord[];
}

function isHighlightLimitError(error: { code?: string; message?: string }): boolean {
  if (!error) return false;
  if (error.code === 'P0001' || error.code === '23514') return true;
  const message = (error.message ?? '').toLowerCase();
  return message.includes('max') || message.includes('maximum') || message.includes('limit');
}

export async function toggleHighlight({ type, id }: { type: BudgetType; id: UUID }): Promise<'added' | 'removed'> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);

  const { data: existing, error: selectError } = await supabase
    .from('user_highlight_budgets')
    .select('id')
    .eq('user_id', userId)
    .eq('budget_type', type)
    .eq('budget_id', id)
    .maybeSingle();

  if (selectError && selectError.code !== 'PGRST116') {
    throw selectError;
  }

  if (existing) {
    const { error } = await supabase
      .from('user_highlight_budgets')
      .delete()
      .eq('user_id', userId)
      .eq('id', existing.id);
    if (error) throw error;
    return 'removed';
  }

  const { error } = await supabase.from('user_highlight_budgets').insert({
    user_id: userId,
    budget_type: type,
    budget_id: id,
  });

  if (error) {
    if (isHighlightLimitError(error)) {
      const err = new Error('Maksimal 2 highlight');
      (err as { code?: string }).code = 'LIMIT_REACHED';
      throw err;
    }
    throw error;
  }

  return 'added';
}

export async function listHighlightedBudgetDetails(period: string): Promise<HighlightedBudgetDetail[]> {
  const highlights = await listHighlightBudgets();
  if (highlights.length === 0) {
    return [];
  }

  const [monthlyBudgets, spentMap, weeklyResult] = await Promise.all([
    listBudgets(period),
    computeSpent(period),
    listWeeklyBudgets(period),
  ]);

  const monthlyMerged = mergeBudgetsWithSpent(monthlyBudgets, spentMap);
  const monthlyMap = new Map<string, BudgetWithSpent>();
  for (const row of monthlyMerged) {
    monthlyMap.set(row.id, row);
  }

  const weeklyMap = new Map<string, WeeklyBudgetWithActual>();
  for (const row of weeklyResult.rows) {
    weeklyMap.set(row.id, row);
  }

  const weeklySummaryMap = new Map<string, WeeklyBudgetCategorySummary>();
  for (const summary of weeklyResult.summaries) {
    weeklySummaryMap.set(summary.category_id, summary);
  }

  const details: HighlightedBudgetDetail[] = [];

  for (const highlight of highlights.slice(0, 2)) {
    if (highlight.budget_type === 'monthly') {
      const monthly = monthlyMap.get(highlight.budget_id);
      if (!monthly) continue;
      details.push({
        highlight_id: highlight.id,
        budget_type: 'monthly',
        budget_id: monthly.id,
        category_id: monthly.category_id,
        category_name: monthly.category?.name ?? null,
        category_type: monthly.category?.type ?? null,
        planned: Number(monthly.amount_planned ?? 0),
        actual: Number(monthly.spent ?? 0),
        remaining: Number(monthly.remaining ?? 0),
        percentage: Number(monthly.amount_planned ?? 0) > 0 ? Number(monthly.spent ?? 0) / Number(monthly.amount_planned ?? 0) : 0,
        label: 'Bulanan',
      });
      continue;
    }

    const weekly = weeklyMap.get(highlight.budget_id);
    if (!weekly) continue;
    const summary = weeklySummaryMap.get(weekly.category_id);
    const planned = summary?.planned ?? Number(weekly.amount_planned ?? 0);
    const actual = summary?.actual ?? weekly.actual;
    const remaining = planned - actual;
    const percentage = planned > 0 ? actual / planned : 0;
    details.push({
      highlight_id: highlight.id,
      budget_type: 'weekly',
      budget_id: weekly.id,
      category_id: weekly.category_id,
      category_name: weekly.category?.name ?? null,
      category_type: weekly.category?.type ?? null,
      planned,
      actual,
      remaining,
      percentage,
      label: 'Mingguan',
    });
  }

  return details;
}

export async function upsertBudget(input: UpsertBudgetInput): Promise<void> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);

  // Pastikan benar-benar logged-in (punya token) sebelum menulis ke cloud
  try {
    await getUserToken();
  } catch (error) {
    if (error instanceof Error && error.message === 'Not signed in') {
      throw new Error('Silakan login untuk menyimpan anggaran');
    }
    throw error;
  }

  const payload = {
    p_category_id: input.category_id,
    p_amount_planned: Number(input.amount_planned ?? 0),
    p_period_month: toMonthStart(input.period), // 'YYYY-MM-01'
    p_carryover_enabled: Boolean(input.carryover_enabled),
    p_notes: input.notes ?? null,
  };

  const { error } = await supabase.rpc('bud_upsert', payload);
  if (error) {
    if (error.message === 'Unauthorized' || error.code === '401' || error.code === 'PGRST301') {
      throw new Error('Silakan login untuk menyimpan anggaran');
    }
    const msg = (error.message || '').toLowerCase();
    if (error.code === '404' || msg.includes('bud_upsert')) {
      throw new Error('Fungsi bud_upsert belum tersedia, jalankan migrasi SQL di server');
    }
    throw error;
  }
}

export async function deleteBudget(id: UUID): Promise<void> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);
  const { error } = await supabase.from('budgets').delete().eq('user_id', userId).eq('id', id);
  if (error) throw error;
}

export function mergeBudgetsWithSpent(budgets: BudgetRow[], spentMap: Record<string, number>): BudgetWithSpent[] {
  return budgets.map((budget) => {
    const spent = spentMap[budget.category_id] ?? 0;
    return {
      ...budget,
      spent,
      remaining: Number(budget.amount_planned ?? 0) - spent,
    };
  });
}

export function buildSummary(rows: BudgetWithSpent[]): BudgetSummary {
  const planned = rows.reduce((acc, row) => acc + Number(row.amount_planned ?? 0), 0);
  const spent = rows.reduce((acc, row) => acc + Number(row.spent ?? 0), 0);
  const remaining = planned - spent;
  const percentage = planned > 0 ? Math.min(spent / planned, 1) : 0;
  return {
    planned,
    spent,
    remaining,
    percentage,
  };
}
