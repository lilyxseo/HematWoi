import { supabase, supabaseUrl, supabaseKey } from './supabase';
import { getCurrentUserId } from './session';
import { listCategories as listAllCategories } from './api-categories';

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

const isDevelopment = Boolean(
  (typeof import.meta !== 'undefined' && import.meta.env?.DEV) ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development')
);

const EXPENSE_CATEGORY_SELECT = 'id,user_id,type,name,inserted_at,group_name,order_index';

let categoriesViewUnavailable = false;
let categoriesViewWarningLogged = false;

export class BudgetRpcUnavailableError extends Error {
  status = 404;
  code = 'BUDGET_RPC_MISSING';

  constructor(message = 'Fungsi bud_upsert belum tersedia. Jalankan migrasi SQL di server.') {
    super(message);
    this.name = 'BudgetRpcUnavailableError';
  }
}

function getSupabaseRestConfig() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase belum dikonfigurasi.');
  }
  return { url: supabaseUrl, key: supabaseKey };
}

function buildSupabaseHeaders(asJson = false): Record<string, string> {
  const { key } = getSupabaseRestConfig();
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
  if (asJson) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch (error) {
    if (isDevelopment) {
      console.warn('[HW] Failed to parse JSON response', error);
    }
    return null;
  }
}

async function buildRestError(response: Response, fallback: string): Promise<Error> {
  const body = await readJson<{ message?: string }>(response);
  const message = typeof body?.message === 'string' && body.message.trim() ? body.message : fallback;
  const error = new Error(message);
  (error as { status?: number }).status = response.status;
  return error;
}

async function fetchExpenseCategoriesFromRest(userId: string): Promise<ExpenseCategory[]> {
  const { url } = getSupabaseRestConfig();
  const params = new URLSearchParams({
    select: EXPENSE_CATEGORY_SELECT,
    user_id: `eq.${userId}`,
    type: 'eq.expense',
    order: 'order_index.asc.nullsfirst,name.asc',
  });
  const headers = buildSupabaseHeaders();

  if (!categoriesViewUnavailable) {
    const response = await fetch(`${url}/rest/v1/v_categories_budget?${params}`, { headers });
    if (response.status === 404) {
      categoriesViewUnavailable = true;
      if (!categoriesViewWarningLogged) {
        categoriesViewWarningLogged = true;
        console.warn('v_categories_budget missing — using fallback /categories');
      }
    } else {
      if (!response.ok) {
        throw await buildRestError(response, 'Gagal memuat kategori pengeluaran.');
      }
      const payload = await readJson<ExpenseCategory[]>(response);
      return (payload ?? []).map((row) => mapCategoryRecordToExpense(row as any));
    }
  }

  const fallbackResponse = await fetch(`${url}/rest/v1/categories?${params}`, { headers });
  if (!fallbackResponse.ok) {
    throw await buildRestError(fallbackResponse, 'Gagal memuat kategori pengeluaran.');
  }
  const fallbackPayload = await readJson<ExpenseCategory[]>(fallbackResponse);
  return (fallbackPayload ?? []).map((row) => mapCategoryRecordToExpense(row as any));
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
    group_name: (category as { group_name?: string | null; group?: string | null }).group_name ??
      (category as { group?: string | null }).group ??
      null,
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

export function firstDayOfMonth(period: string): string {
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

function getMonthRange(period: string): { start: string; end: string } {
  const start = firstDayOfMonth(period);
  const [yearStr, monthStr] = start.split('-');
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    throw new Error('Periode tidak valid');
  }
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = `${nextYear.toString().padStart(4, '0')}-${nextMonth.toString().padStart(2, '0')}-01`;
  return { start, end };
}

export async function listCategoriesExpense(): Promise<ExpenseCategory[]> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);

  try {
    return await fetchExpenseCategoriesFromRest(userId);
  } catch (error) {
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
        group_name: (category as { group_name?: string | null; group?: string | null }).group_name ??
          (category as { group?: string | null }).group ??
          null,
      })
    );
}

export async function listBudgets(period: string): Promise<BudgetRow[]> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);
  const { data, error } = await supabase
    .from('budgets')
    .select(
      'id,user_id,category_id,amount_planned,carryover_enabled,notes,period_month,created_at,updated_at,category:categories(id,name)'
    )
    .eq('user_id', userId)
    .eq('period_month', firstDayOfMonth(period))
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BudgetRow[];
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
  for (const row of data ?? []) {
    const categoryId = row?.category_id as string | null;
    if (!categoryId) continue;
    const amount = Number(row?.amount ?? 0);
    if (!Number.isFinite(amount)) continue;
    totals[categoryId] = (totals[categoryId] ?? 0) + amount;
  }
  return totals;
}

export async function upsertBudget(input: UpsertBudgetInput): Promise<void> {
  const userId = await getCurrentUserId();
  ensureAuth(userId);
  const { url } = getSupabaseRestConfig();
  const body = {
    p_category_id: input.category_id,
    p_amount_planned: input.amount_planned,
    p_period_month: firstDayOfMonth(input.period),
    p_carryover_enabled: Boolean(input.carryover_enabled),
    p_notes: input.notes ?? null,
  };

  const response = await fetch(`${url}/rest/v1/rpc/bud_upsert`, {
    method: 'POST',
    headers: buildSupabaseHeaders(true),
    body: JSON.stringify(body),
  });

  if (response.status === 404) {
    throw new BudgetRpcUnavailableError();
  }

  if (!response.ok) {
    throw await buildRestError(response, 'Gagal menyimpan anggaran.');
  }

  if (response.status !== 204) {
    await readJson(response);
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

