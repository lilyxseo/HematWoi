import { supabase } from './supabase';
import { getCurrentUserId } from './session';
import { listCategories as listAllCategories } from './api-categories';

type EnvRecord = Record<string, string | undefined>;

const browserEnv = (typeof import.meta !== 'undefined' ? import.meta.env ?? {} : {}) as EnvRecord;
const nodeEnv =
  (typeof globalThis !== 'undefined' && (globalThis as any).process?.env
    ? (globalThis as any).process.env
    : {}) as EnvRecord;

const SUPABASE_URL =
  browserEnv.VITE_SUPABASE_URL ?? nodeEnv.VITE_SUPABASE_URL ?? browserEnv.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY =
  browserEnv.VITE_SUPABASE_PUBLISHABLE_KEY ??
  browserEnv.VITE_SUPABASE_ANON_KEY ??
  nodeEnv.VITE_SUPABASE_PUBLISHABLE_KEY ??
  nodeEnv.VITE_SUPABASE_ANON_KEY ??
  '';

type CategoryFallbackReason = 'view-missing';

let categoriesViewMissing = false;
let categoriesFallbackReason: CategoryFallbackReason | null = null;

const restBaseUrl = SUPABASE_URL ? SUPABASE_URL.replace(/\/+$, '') : '';

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

type RestCategoryRow = {
  id: string;
  user_id: string | null;
  type: string | null;
  name: string | null;
  inserted_at: string | null;
  group_name: string | null;
  order_index: number | string | null;
};

const FALLBACK_CATEGORY_INSERTED_AT = '1970-01-01T00:00:00.000Z';

const isDevelopment = Boolean(
  (typeof import.meta !== 'undefined' && import.meta.env?.DEV) ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development')
);

function sbHeaders(asJson = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (SUPABASE_ANON_KEY) {
    headers.apikey = SUPABASE_ANON_KEY;
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }
  if (asJson) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

async function buildRestError(scope: string, response: Response): Promise<Error> {
  let payload: any = null;
  try {
    payload = await response.json();
  } catch (err) {
    if (isDevelopment) {
      console.warn(`[HW][${scope}] failed to parse error payload`, err);
    }
  }
  const message = payload?.message || `HTTP ${response.status}`;
  const error = new Error(message);
  (error as any).status = response.status;
  if (payload) {
    (error as any).details = payload;
  }
  return error;
}

export function consumeCategoriesFallbackNotice(): CategoryFallbackReason | null {
  const reason = categoriesFallbackReason;
  categoriesFallbackReason = null;
  return reason;
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

function toNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
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
  const normalized = (period ?? '').trim();
  if (!normalized) {
    throw new Error('Periode harus dalam format YYYY-MM');
  }
  const segments = normalized.split('-');
  if (segments.length < 2) {
    throw new Error('Periode harus dalam format YYYY-MM');
  }
  const [yearStr, monthStr] = segments;
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    throw new Error('Periode harus dalam format YYYY-MM');
  }
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-01`;
}

function toMonthStart(period: string): string {
  const normalized = (period ?? '').trim();
  if (!normalized) {
    throw new Error('Periode tidak valid');
  }
  if (normalized.length >= 7) {
    return firstDayOfMonth(normalized.slice(0, 7));
  }
  return firstDayOfMonth(normalized);
}

function getMonthRange(period: string): { start: string; end: string } {
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

export async function listExpenseCategories(uid: string): Promise<ExpenseCategory[]> {
  if (!uid) {
    return [];
  }
  if (!restBaseUrl || !SUPABASE_ANON_KEY) {
    throw new Error('Konfigurasi Supabase REST belum tersedia.');
  }

  const params = new URLSearchParams({
    select: 'id,user_id,type,name,inserted_at,group_name,order_index',
    user_id: `eq.${uid}`,
    type: 'eq.expense',
    order: 'order_index.asc.nullsfirst,name.asc',
  });
  const restEndpoint = `${restBaseUrl}/rest/v1`;

  if (!categoriesViewMissing) {
    const response = await fetch(`${restEndpoint}/v_categories_budget?${params.toString()}`, {
      headers: sbHeaders(),
    });
    if (response.status === 404) {
      categoriesViewMissing = true;
      categoriesFallbackReason = 'view-missing';
    } else {
      if (!response.ok) {
        throw await buildRestError('listExpenseCategories', response);
      }
      const rows = (await response.json()) as RestCategoryRow[];
      return rows.map((row) =>
        mapCategoryRecordToExpense({
          id: String(row.id),
          user_id: row.user_id,
          name: row.name ?? '',
          type: row.type ?? 'expense',
          inserted_at: row.inserted_at,
          group_name: row.group_name,
          order_index: toNullableNumber(row.order_index),
        })
      );
    }
  }

  const fallbackResponse = await fetch(`${restEndpoint}/categories?${params.toString()}`, {
    headers: sbHeaders(),
  });
  if (!fallbackResponse.ok) {
    throw await buildRestError('listExpenseCategories', fallbackResponse);
  }
  const fallbackRows = (await fallbackResponse.json()) as RestCategoryRow[];
  return fallbackRows.map((row) =>
    mapCategoryRecordToExpense({
      id: String(row.id),
      user_id: row.user_id,
      name: row.name ?? '',
      type: row.type ?? 'expense',
      inserted_at: row.inserted_at,
      group_name: row.group_name,
      order_index: toNullableNumber(row.order_index),
    })
  );
}

export async function listCategoriesExpense(): Promise<ExpenseCategory[]> {
  let userId: string | null = null;
  try {
    userId = await getCurrentUserId();
    ensureAuth(userId);
  } catch (error) {
    if (isDevelopment) {
      console.warn('[HW] listCategoriesExpense auth fallback', error);
    }
  }

  if (userId) {
    try {
      return await listExpenseCategories(userId);
    } catch (error) {
      if (isDevelopment) {
        console.warn('[HW] listCategoriesExpense fallback', error);
      }
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
        inserted_at: (category as any).inserted_at ?? category.created_at ?? null,
        group_name: (category as any).group_name ?? null,
        order_index: (category as any).order_index ?? category.sort_order ?? null,
        sort_order: category.sort_order ?? null,
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
    .eq('period_month', toMonthStart(period))
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
    .select('category_id, amount, date')
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
  const body = {
    p_category_id: input.category_id,
    p_amount_planned: Number(input.amount_planned ?? 0),
    p_period_month: firstDayOfMonth(input.period),
    p_carryover_enabled: Boolean(input.carryover_enabled),
    p_notes: input.notes ?? null,
  };

  if (!restBaseUrl || !SUPABASE_ANON_KEY) {
    const { error } = await supabase.rpc('bud_upsert', body);
    if (error) throw error;
    return;
  }

  const response = await fetch(`${restBaseUrl}/rest/v1/rpc/bud_upsert`, {
    method: 'POST',
    headers: sbHeaders(true),
    body: JSON.stringify(body),
  });

  if (response.status === 404) {
    const error: Error & { code?: string; status?: number } = new Error(
      'Fungsi bud_upsert belum tersedia. Jalankan migrasi SQL di server.'
    );
    error.code = 'RPC_NOT_FOUND';
    error.status = 404;
    throw error;
  }

  if (!response.ok) {
    throw await buildRestError('upsertBudget', response);
  }

  try {
    await response.json();
  } catch {
    // Ignore bodies without JSON content
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

