import { supabase } from './supabase';
import { getCurrentUserId } from './session';

export interface ExpenseCategory {
  id: string;
  user_id: string;
  type: 'income' | 'expense';
  name: string;
  inserted_at: string | null;
  group_name: string | null;
  order_index: number | null;
}

export interface BudgetRecord {
  id: string;
  user_id: string;
  category_id: string | null;
  amount_planned: number;
  carryover_enabled: boolean;
  notes: string | null;
  period_month: string;
  created_at: string | null;
  updated_at: string | null;
  category?: {
    id: string;
    name: string;
    type?: 'income' | 'expense';
  } | null;
}

export interface SpentByCategoryMap {
  [categoryId: string]: number;
}

export interface BudgetUpsertInput {
  id?: string;
  period: string; // YYYY-MM
  categoryId: string;
  amountPlanned: number;
  carryoverEnabled: boolean;
  notes?: string;
  userId?: string;
}

function ensurePeriodMonth(period: string): string {
  if (!period) throw new Error('Periode wajib diisi');
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) return `${period.slice(0, 7)}-01`;
  if (/^\d{4}-\d{2}$/.test(period)) return `${period}-01`;
  throw new Error('Format periode tidak valid. Gunakan YYYY-MM');
}

function getNextMonth(periodMonth: string): string {
  const [yearRaw, monthRaw] = periodMonth.split('-');
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    throw new Error('Periode tidak valid');
  }
  const base = new Date(Date.UTC(year, month - 1, 1));
  base.setUTCMonth(base.getUTCMonth() + 1);
  return base.toISOString().slice(0, 10);
}

export async function listCategoriesExpense(userId?: string): Promise<ExpenseCategory[]> {
  const uid = userId ?? (await getCurrentUserId());
  if (!uid) throw new Error('Pengguna belum masuk');
  const { data, error } = await supabase
    .from('categories')
    .select('id,user_id,type,name,inserted_at,"group" as group_name,order_index')
    .eq('user_id', uid)
    .eq('type', 'expense')
    .order('order_index', { ascending: true, nullsFirst: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    user_id: String(row.user_id),
    type: (row.type ?? 'expense') as 'income' | 'expense',
    name: String(row.name ?? ''),
    inserted_at: row.inserted_at ?? null,
    group_name: row.group_name ?? null,
    order_index: row.order_index ?? null,
  }));
}

export async function listBudgets(period: string, userId?: string): Promise<BudgetRecord[]> {
  const uid = userId ?? (await getCurrentUserId());
  if (!uid) throw new Error('Pengguna belum masuk');
  const periodMonth = ensurePeriodMonth(period);
  const { data, error } = await supabase
    .from('budgets')
    .select(
      'id,user_id,category_id,amount_planned,carryover_enabled,notes,period_month,created_at,updated_at,category:categories(id,name,type)'
    )
    .eq('user_id', uid)
    .eq('period_month', periodMonth)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    user_id: String(row.user_id),
    category_id: row.category_id ?? null,
    amount_planned: Number(row.amount_planned ?? 0),
    carryover_enabled: Boolean(row.carryover_enabled),
    notes: row.notes ?? null,
    period_month: row.period_month ?? periodMonth,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    category: row.category
      ? {
          id: String(row.category.id),
          name: String(row.category.name ?? ''),
          type: (row.category.type ?? 'expense') as 'income' | 'expense',
        }
      : null,
  }));
}

export async function computeSpentByCategory(period: string, userId?: string): Promise<SpentByCategoryMap> {
  const uid = userId ?? (await getCurrentUserId());
  if (!uid) throw new Error('Pengguna belum masuk');
  const periodMonth = ensurePeriodMonth(period);
  const endExclusive = getNextMonth(periodMonth);
  const { data, error } = await supabase
    .from('transactions')
    .select('category_id, amount, date')
    .eq('user_id', uid)
    .eq('type', 'expense')
    .is('deleted_at', null)
    .gte('date', periodMonth)
    .lt('date', endExclusive);
  if (error) throw error;
  const totals: SpentByCategoryMap = {};
  for (const row of data ?? []) {
    const amount = Number(row.amount ?? 0);
    const key = row.category_id ? String(row.category_id) : '__uncategorized__';
    totals[key] = (totals[key] ?? 0) + (Number.isFinite(amount) ? amount : 0);
  }
  return totals;
}

function isMissingFunctionError(error: { code?: string; message?: string }): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  if (code === '42883') return true;
  const message = (error.message ?? '').toLowerCase();
  return message.includes('bud_upsert') && message.includes('function') && message.includes('does not exist');
}

export async function upsertBudget(input: BudgetUpsertInput): Promise<void> {
  const periodMonth = ensurePeriodMonth(input.period);
  const payload = {
    budget_id: input.id ?? null,
    category_id: input.categoryId,
    amount_planned: input.amountPlanned,
    period_month: periodMonth,
    carryover_enabled: input.carryoverEnabled,
    notes: input.notes ?? null,
  };
  const { error } = await supabase.rpc('bud_upsert', payload);
  if (error && !isMissingFunctionError(error)) {
    throw error;
  }
  if (!error) return;
  const uid = input.userId ?? (await getCurrentUserId());
  if (!uid) throw new Error('Pengguna belum masuk');
  const { error: fallbackError } = await supabase
    .from('budgets')
    .upsert(
      {
        id: input.id ?? undefined,
        user_id: uid,
        category_id: input.categoryId,
        amount_planned: input.amountPlanned,
        period_month: periodMonth,
        carryover_enabled: input.carryoverEnabled,
        notes: input.notes ?? null,
      },
      { onConflict: 'user_id,category_id,period_month' }
    );
  if (fallbackError) throw fallbackError;
}

export async function deleteBudget(id: string): Promise<void> {
  if (!id) throw new Error('ID anggaran tidak valid');
  const { error } = await supabase.from('budgets').delete().eq('id', id);
  if (error) throw error;
}
