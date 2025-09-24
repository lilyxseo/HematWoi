import { supabase } from './supabase';

export interface BudgetMonthRow {
  id: string;
  category_id: string | null;
  amount_planned: number | null;
  period_month: string;
  current_spent: number | null;
  name?: string | null;
  notes?: string | null;
  carryover_enabled?: boolean | null;
}

function normalizeMonthISO(input: string): string {
  if (!input) {
    throw new Error('Format bulan tidak valid');
  }
  const base = input.length === 7 ? `${input}-01` : input;
  const parsed = new Date(`${base}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Format bulan tidak valid');
  }
  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

export async function listBudgetsByMonth(userId: string, monthISO: string) {
  const periodMonth = normalizeMonthISO(monthISO);
  const { data, error } = await supabase
    .from('budgets')
    .select('id, category_id, amount_planned, period_month, current_spent, name, notes, carryover_enabled')
    .eq('user_id', userId)
    .eq('period_month', periodMonth)
    .order('category_id', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as BudgetMonthRow[];
}
