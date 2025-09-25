import { supabase } from './supabase';
import { getCurrentUserId } from './session';
import { listCategories as listAllCategories } from './api-categories';

const browserEnv = typeof import.meta !== 'undefined' ? import.meta.env ?? {} : {};
const nodeEnv =
  typeof process !== 'undefined' && process.env ? process.env : {};

const SUPABASE_URL =
  (browserEnv.VITE_SUPABASE_URL ?? nodeEnv.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
const SUPABASE_KEY =
  browserEnv.VITE_SUPABASE_PUBLISHABLE_KEY ??
  browserEnv.VITE_SUPABASE_ANON_KEY ??
  nodeEnv.VITE_SUPABASE_PUBLISHABLE_KEY ??
  nodeEnv.VITE_SUPABASE_ANON_KEY ??
  '';

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

const REST_ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/rest/v1` : '';

let categoriesViewUnavailable = false;
let categoriesFallbackWarned = false;
let budgetRpcUnavailableNotified = false;

function ensureRestConfig() {
  if (!REST_ENDPOINT || !SUPABASE_KEY) {
    throw new Error('Konfigurasi Supabase belum tersedia.');
  }
}

function sbHeaders(json = false): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    Accept: 'application/json',
  };
  if (json) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

async function parseErrorMessage(response: Response): Promise<string | null> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return null;
  }
  try {
    const payload = (await response.json()) as { message?: unknown; error?: unknown };
    const message = payload?.message ?? payload?.error;
    return typeof message === 'string' && message.trim() ? message : null;
  } catch (error) {
    if (isDevelopment) {
      console.warn('[HW] parseErrorMessage', error);
    }
    return null;
  }
}

async function throwRestError(response: Response, fallbackMessage: string): Promise<never> {
  const message = (await parseErrorMessage(response)) ?? `${fallbackMessage} (HTTP ${response.status})`;
  const error = new Error(message);
  (error as { status?: number }).status = response.status;
  throw error;
}

const isDevelopment = Boolean(
  (typeof import.meta !== 'undefined' && import.meta.env?.DEV) ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development')
);

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

function normalizeExpenseCategoryRow(row: Partial<ExpenseCategory> & Record<string, unknown>): ExpenseCategory {
  const rawOrder = row.order_index ?? (row as { sort_order?: unknown }).sort_order ?? null;
  let orderIndex: number | null = null;
  if (rawOrder != null) {
    const parsed = Number(rawOrder);
    orderIndex = Number.isFinite(parsed) ? parsed : null;
  }

  const inserted = typeof row.inserted_at === 'string' && row.inserted_at.trim()
    ? row.inserted_at
    : FALLBACK_CATEGORY_INSERTED_AT;

  return {
    id: String(row.id ?? ''),
    user_id: typeof row.user_id === 'string' && row.user_id ? row.user_id : 'local',
    type: 'expense',
    name: typeof row.name === 'string' ? row.name : '',
    inserted_at: inserted,
    group_name: typeof row.group_name === 'string' && row.group_name.trim()
      ? row.group_name
      : null,
    order_index: orderIndex,
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

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const formatted = formatter.format(new Date(Date.UTC(year, month - 1, 1)));
  return formatted;
}

function getMonthRange(period: string): { start: string; end: string } {
  const startDate = firstDayOfMonth(period);
  const start = new Date(`${startDate}T00:00:00.000Z`);
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

export async function listCategoriesExpense(): Promise<ExpenseCategory[]> {
  async function listFromRest(): Promise<ExpenseCategory[]> {
    const userId = await getCurrentUserId();
    ensureAuth(userId);
    return listExpenseCategories(userId);
  }

  async function fetchFromCloud(): Promise<ExpenseCategory[]> {
    return listFromRest();
  }

  try {
    const rows = await fetchFromCloud();
    if (rows.length > 0) {
      return rows;
    }
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

export async function listExpenseCategories(uid: string): Promise<ExpenseCategory[]> {
  if (!uid) {
    throw new Error('Pengguna belum masuk.');
  }

  ensureRestConfig();

  const params = new URLSearchParams({
    select: 'id,user_id,type,name,inserted_at,group_name,order_index',
    user_id: `eq.${uid}`,
    type: 'eq.expense',
    order: 'order_index.asc.nullsfirst,name.asc',
  });

  const resource = categoriesViewUnavailable ? 'categories' : 'v_categories_budget';
  const response = await fetch(`${REST_ENDPOINT}/${resource}?${params.toString()}`, {
    headers: sbHeaders(),
  });

  if (response.status === 404 && !categoriesViewUnavailable) {
    categoriesViewUnavailable = true;
    if (!categoriesFallbackWarned) {
      console.warn('v_categories_budget missing — using fallback /categories');
      categoriesFallbackWarned = true;
    }
    return listExpenseCategories(uid);
  }

  if (!response.ok) {
    await throwRestError(response, 'Gagal memuat kategori pengeluaran');
  }

  const rows = (await response.json()) as Array<Partial<ExpenseCategory> & Record<string, unknown>>;
  return (rows ?? []).map((row) => normalizeExpenseCategoryRow(row));
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
  ensureRestConfig();

  const body = {
    p_category_id: input.category_id,
    p_amount_planned: input.amount_planned,
    p_period_month: firstDayOfMonth(input.period),
    p_carryover_enabled: Boolean(input.carryover_enabled),
    p_notes: input.notes ?? null,
  };

  const response = await fetch(`${REST_ENDPOINT}/rpc/bud_upsert`, {
    method: 'POST',
    headers: sbHeaders(true),
    body: JSON.stringify(body),
  });

  if (response.status === 404) {
    if (!budgetRpcUnavailableNotified) {
      if (isDevelopment) {
        console.warn('[HW] RPC bud_upsert missing');
      }
      budgetRpcUnavailableNotified = true;
    }
    const error = new Error(
      'Fungsi bud_upsert belum tersedia. Jalankan migrasi SQL di server.'
    );
    (error as { status?: number }).status = 404;
    throw error;
  }

  if (!response.ok) {
    await throwRestError(response, 'Gagal menyimpan anggaran');
  }

  const hasJsonBody =
    (response.headers.get('content-type') ?? '').includes('application/json');
  if (hasJsonBody) {
    await response.json().catch(() => null);
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

