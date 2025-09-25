import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../lib/session';

export interface BudgetCategory {
  id: string;
  user_id: string;
  type: 'income' | 'expense';
  name: string;
  inserted_at: string | null;
  group_name: string | null;
  order_index: number | null;
}

export interface BudgetRow {
  id: string;
  user_id: string;
  category_id: string | null;
  amount_planned: number;
  carryover_enabled: boolean;
  notes: string | null;
  period_month: string;
  created_at: string;
  updated_at: string;
  category?: {
    id: string;
    name: string;
  } | null;
}

export interface BudgetWithSpent extends BudgetRow {
  spent: number;
}

export interface BudgetSummary {
  planned: number;
  spent: number;
  remaining: number;
  percentage: number;
}

export interface BudgetInput {
  id?: string;
  period: string; // YYYY-MM
  category_id: string;
  amount_planned: number;
  carryover_enabled: boolean;
  notes?: string;
}

function ensurePeriodDate(periodYYYYMM: string): string {
  if (!periodYYYYMM) {
    throw new Error('Periode wajib diisi');
  }
  if (periodYYYYMM.length === 7) {
    return `${periodYYYYMM}-01`;
  }
  return periodYYYYMM;
}

export async function listCategoriesExpense(): Promise<BudgetCategory[]> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Tidak dapat menemukan user');

  const { data, error } = await supabase
    .from('categories')
    .select('id,user_id,type,name,inserted_at,group_name:group,order_index')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .order('order_index', { ascending: true, nullsFirst: true })
    .order('name', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    type: row.type,
    name: row.name,
    inserted_at: row.inserted_at ?? null,
    group_name: row.group_name ?? null,
    order_index: row.order_index ?? null,
  }));
}

export async function listBudgets(periodYYYYMM: string): Promise<BudgetRow[]> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Tidak dapat menemukan user');

  const period_month = ensurePeriodDate(periodYYYYMM);

  const { data, error } = await supabase
    .from('budgets')
    .select('id,user_id,category_id,amount_planned,carryover_enabled,notes,period_month,created_at,updated_at,category:categories(id,name)')
    .eq('user_id', userId)
    .eq('period_month', period_month)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    category_id: row.category_id,
    amount_planned: Number(row.amount_planned ?? 0),
    carryover_enabled: Boolean(row.carryover_enabled),
    notes: row.notes ?? null,
    period_month: row.period_month,
    created_at: row.created_at,
    updated_at: row.updated_at,
    category: row.category ?? null,
  }));
}

function getPeriodRange(periodMonth: string): { from: string; to: string } {
  const date = new Date(`${ensurePeriodDate(periodMonth)}T00:00:00`);
  const from = date.toISOString().slice(0, 10);
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  const to = next.toISOString().slice(0, 10);
  return { from, to };
}

export async function computeSpent(periodMonth: string): Promise<Record<string, number>> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Tidak dapat menemukan user');

  const { from, to } = getPeriodRange(periodMonth);

  const { data, error } = await supabase
    .from('transactions')
    .select('category_id, amount, date')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .eq('type', 'expense')
    .gte('date', from)
    .lt('date', to);

  if (error) throw error;

  const totals: Record<string, number> = {};
  for (const row of data ?? []) {
    const categoryId = row.category_id;
    if (!categoryId) continue;
    const amount = Number(row.amount ?? 0);
    totals[categoryId] = (totals[categoryId] ?? 0) + amount;
  }
  return totals;
}

export function buildSummary(rows: BudgetWithSpent[]): BudgetSummary {
  const planned = rows.reduce((acc, item) => acc + item.amount_planned, 0);
  const spent = rows.reduce((acc, item) => acc + item.spent, 0);
  const remaining = planned - spent;
  const percentage = planned > 0 ? Math.min(spent / planned, 1) : 0;
  return { planned, spent, remaining, percentage };
}

export async function upsertBudget(input: BudgetInput): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Tidak dapat menemukan user');

  const period_month = ensurePeriodDate(input.period);

  const payload = {
    category_id: input.category_id,
    amount_planned: input.amount_planned,
    period_month,
    carryover_enabled: input.carryover_enabled,
    notes: input.notes ?? null,
  };

  const { error } = await supabase.rpc('bud_upsert', payload);
  if (error) throw error;
}

export async function deleteBudget(id: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Tidak dapat menemukan user');

  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw error;
}

export async function assembleBudgets(period: string): Promise<BudgetWithSpent[]> {
  const [budgets, spentMap] = await Promise.all([listBudgets(period), computeSpent(period)]);
  return budgets.map((row) => ({
    ...row,
    spent: row.category_id ? spentMap[row.category_id] ?? 0 : 0,
  }));
}
