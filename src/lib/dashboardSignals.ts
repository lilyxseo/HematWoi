import { supabase } from './supabase';

const MONTH_FORMAT = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' });
const NUMBER_FORMAT = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

export interface MerchantRepeatSignal {
  merchant: string;
  count: number;
  total: number;
}

export interface BudgetStatusSignal {
  category: string;
  pct: number;
}

export interface CashflowSignal {
  month: string;
  amount: number;
}

export interface WeeklyTopSignal {
  category: string;
  total: number;
}

export interface LargeTransactionSignal {
  merchant: string;
  amount: number;
}

export interface DashboardSignals {
  weeklyRepeats: MerchantRepeatSignal[];
  nearBudget: BudgetStatusSignal[];
  overBudget: BudgetStatusSignal[];
  largeTransaction: LargeTransactionSignal | null;
  netCashflow: CashflowSignal | null;
  weeklyTop: WeeklyTopSignal | null;
}

export const EMPTY_SIGNALS: DashboardSignals = {
  weeklyRepeats: [],
  nearBudget: [],
  overBudget: [],
  largeTransaction: null,
  netCashflow: null,
  weeklyTop: null,
};

interface FetchOptions {
  limit?: number;
  optional?: boolean;
  orderBy?: string;
  ascending?: boolean;
}

const LARGE_TX_THRESHOLD = 500_000;

export async function getDashboardSignals(): Promise<DashboardSignals> {
  try {
    const [weeklyMerchantRows, largeExpenseRows, cashflowRows, weeklyTopRows, budgetStatusRows] =
      await Promise.all([
        fetchView('v_tx_weekly_merchant', { limit: 12 }),
        fetchView('v_tx_large_expenses_month', { limit: 10 }),
        fetchView('v_tx_monthly_cashflow', { limit: 6 }),
        fetchView('v_tx_weekly_top_category', { limit: 6 }),
        fetchView('v_budget_status_month', { limit: 20, optional: true }),
      ]);

    const weeklyRepeats = mapWeeklyRepeats(weeklyMerchantRows);
    const largeTransaction = mapLargeTransaction(largeExpenseRows);
    const netCashflow = mapCashflow(cashflowRows);
    const weeklyTop = mapWeeklyTop(weeklyTopRows);
    const { nearBudget, overBudget } = mapBudgetStatus(budgetStatusRows);

    return {
      weeklyRepeats,
      nearBudget,
      overBudget,
      largeTransaction,
      netCashflow,
      weeklyTop,
    };
  } catch (error) {
    return { ...EMPTY_SIGNALS };
  }
}

async function fetchView(name: string, options: FetchOptions = {}): Promise<any[]> {
  const { limit, optional = false, orderBy, ascending = false } = options;
  try {
    let query = supabase.from(name).select('*');
    if (orderBy) {
      query = query.order(orderBy, { ascending });
    }
    if (typeof limit === 'number') {
      query = query.limit(limit);
    }
    const { data, error } = await query;
    if (error) {
      if (optional) return [];
      throw error;
    }
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (optional) return [];
    throw err;
  }
}

function mapWeeklyRepeats(rows: any[]): MerchantRepeatSignal[] {
  return rows
    .map((row) => {
      const merchant = pickString(row, ['merchant', 'merchant_name', 'name', 'title']);
      const count = pickNumber(row, ['count', 'tx_count', 'transaction_count']);
      const total = pickNumber(row, ['total', 'total_amount', 'amount', 'sum']);
      if (!merchant || count < 2 || total <= 0) return null;
      return { merchant, count, total };
    })
    .filter(Boolean)
    .sort((a, b) => b!.total - a!.total)
    .map((item) => ({
      merchant: item!.merchant,
      count: item!.count,
      total: item!.total,
    }));
}

function mapLargeTransaction(rows: any[]): LargeTransactionSignal | null {
  const candidate = rows
    .map((row) => {
      const merchant = pickString(row, ['merchant', 'merchant_name', 'name', 'title']);
      const amount = Math.abs(pickNumber(row, ['amount', 'total', 'total_amount', 'value']));
      if (!merchant || amount < LARGE_TX_THRESHOLD) return null;
      return { merchant, amount };
    })
    .filter(Boolean)
    .sort((a, b) => b!.amount - a!.amount)[0];

  return candidate
    ? {
        merchant: candidate.merchant,
        amount: candidate.amount,
      }
    : null;
}

function mapCashflow(rows: any[]): CashflowSignal | null {
  let best: { month: string; amount: number; timestamp: number } | null = null;
  for (const row of rows) {
    const amount = pickNumber(row, ['net', 'net_amount', 'amount', 'total', 'balance']);
    const monthLabel = getMonthLabel(row);
    if (!monthLabel) continue;
    const ts = getMonthTimestamp(row);
    if (!best || (ts !== null && ts > best.timestamp)) {
      best = {
        month: monthLabel,
        amount,
        timestamp: ts ?? Number.MIN_SAFE_INTEGER,
      };
    }
  }
  if (!best) return null;
  return { month: best.month, amount: best.amount };
}

function mapWeeklyTop(rows: any[]): WeeklyTopSignal | null {
  const candidate = rows
    .map((row) => {
      const category = pickString(row, ['category', 'category_name', 'name', 'label']);
      const total = pickNumber(row, ['total', 'total_amount', 'amount', 'sum']);
      if (!category || total <= 0) return null;
      return { category, total };
    })
    .filter(Boolean)
    .sort((a, b) => b!.total - a!.total)[0];

  return candidate ? { category: candidate.category, total: candidate.total } : null;
}

function mapBudgetStatus(rows: any[]): { nearBudget: BudgetStatusSignal[]; overBudget: BudgetStatusSignal[] } {
  const nearBudget: BudgetStatusSignal[] = [];
  const overBudget: BudgetStatusSignal[] = [];

  for (const row of rows) {
    const category = pickString(row, ['category', 'category_name', 'name', 'label']);
    let pct = pickNumber(row, ['pct', 'percentage', 'ratio', 'utilization', 'usage']);
    if (!category || pct <= 0) continue;
    if (pct <= 1) {
      pct *= 100;
    }
    if (pct >= 100) {
      overBudget.push({ category, pct });
    } else if (pct >= 80) {
      nearBudget.push({ category, pct });
    }
  }

  overBudget.sort((a, b) => b.pct - a.pct);
  nearBudget.sort((a, b) => b.pct - a.pct);

  return { nearBudget, overBudget };
}

function pickString(row: Record<string, any>, keys: string[]): string {
  for (const key of keys) {
    const value = row?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function pickNumber(row: Record<string, any>, keys: string[]): number {
  for (const key of keys) {
    const value = row?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return 0;
}

function getMonthLabel(row: Record<string, any>): string | null {
  const directLabel = pickString(row, ['month_label', 'label']);
  if (directLabel) return directLabel;

  const candidates = [row?.month, row?.period, row?.month_start, row?.date];
  for (const value of candidates) {
    const date = coerceDate(value);
    if (date) {
      return MONTH_FORMAT.format(date);
    }
  }
  return null;
}

function getMonthTimestamp(row: Record<string, any>): number | null {
  const candidates = [row?.month, row?.period, row?.month_start, row?.date];
  for (const value of candidates) {
    const date = coerceDate(value);
    if (date) {
      return date.getTime();
    }
  }
  return null;
}

function coerceDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    const fromNumber = new Date(value);
    return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
  }
  if (typeof value === 'string') {
    if (!value.trim()) return null;
    const normalized = value.length === 7 ? `${value}-01` : value;
    const fromString = new Date(normalized);
    return Number.isNaN(fromString.getTime()) ? null : fromString;
  }
  return null;
}

export function formatCount(value: number): string {
  return NUMBER_FORMAT.format(Math.max(0, Math.round(value)));
}

export function formatAmount(value: number): string {
  return NUMBER_FORMAT.format(Math.max(0, Math.round(value)));
}
