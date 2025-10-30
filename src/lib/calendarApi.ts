import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { supabase } from './supabase';
import { getCurrentUserId } from './session';

const DATE_FORMAT = 'yyyy-MM-dd';

export type CalendarTypeFilter = 'expense' | 'all';

export interface CalendarFilters {
  type: CalendarTypeFilter;
  categoryIds: string[];
  accountId: string | null;
  minAmount: number | null;
  maxAmount: number | null;
  search: string;
}

export interface NormalizedCalendarFilters {
  type: CalendarTypeFilter;
  types: ('expense' | 'income')[];
  categoryIds: string[];
  accountId: string | null;
  minAmount: number | null;
  maxAmount: number | null;
  search: string;
}

export interface DaySummary {
  date: string;
  expenseTotal: number;
  incomeTotal: number;
  count: number;
}

export interface MonthAggregatesData {
  monthStart: string;
  monthEnd: string;
  daySummaries: Record<string, DaySummary>;
  totals: {
    expense: number;
    income: number;
    net: number;
    previousExpense: number;
    momExpenseChange: number | null;
  };
  stats: {
    p80: number;
    p95: number;
    maxExpense: number;
  };
}

export interface CalendarTransactionRow {
  id: string;
  date: string;
  type: 'income' | 'expense';
  amount: number;
  title: string | null;
  notes: string | null;
  category_id: string | null;
  account_id: string | null;
  merchant_id: string | null;
  receipt_url: string | null;
  merchant_name: string | null;
}

function formatDate(value: Date): string {
  return format(value, DATE_FORMAT);
}

export function normalizeCalendarFilters(filters: CalendarFilters): NormalizedCalendarFilters {
  const type: CalendarTypeFilter = filters.type === 'all' ? 'all' : 'expense';
  const categorySet = new Set(
    (filters.categoryIds ?? [])
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter((value) => value.length > 0),
  );
  const categoryIds = Array.from(categorySet).sort();

  const accountId = filters.accountId ? String(filters.accountId) : null;

  const sanitizeAmount = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, Math.trunc(value));
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value.replace(/[^0-9.-]+/g, ''));
      if (Number.isFinite(parsed)) {
        return Math.max(0, Math.trunc(parsed));
      }
    }
    return null;
  };

  let minAmount = sanitizeAmount(filters.minAmount);
  let maxAmount = sanitizeAmount(filters.maxAmount);

  if (minAmount != null && maxAmount != null && minAmount > maxAmount) {
    const temp = minAmount;
    minAmount = maxAmount;
    maxAmount = temp;
  }

  const search = (filters.search ?? '').toString().trim().slice(0, 120);

  const types: ('expense' | 'income')[] = type === 'all' ? ['expense', 'income'] : ['expense'];

  return {
    type,
    types,
    categoryIds,
    accountId,
    minAmount,
    maxAmount,
    search,
  };
}

function escapeIlikeTerm(term: string): string {
  return term.replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function applyCommonFilters(
  query: ReturnType<typeof supabase.from>,
  filters: NormalizedCalendarFilters,
) {
  let builder = query.in('type', filters.types);

  if (filters.categoryIds.length > 0) {
    builder = builder.in('category_id', filters.categoryIds);
  }

  if (filters.accountId) {
    builder = builder.eq('account_id', filters.accountId);
  }

  if (filters.minAmount != null) {
    builder = builder.gte('amount', filters.minAmount);
  }

  if (filters.maxAmount != null) {
    builder = builder.lte('amount', filters.maxAmount);
  }

  if (filters.search) {
    const like = `%${escapeIlikeTerm(filters.search)}%`;
    builder = builder.or(
      `title.ilike.${like},notes.ilike.${like},merchant.name.ilike.${like}`,
    );
  }

  return builder;
}

function mapTransaction(row: Record<string, any>): CalendarTransactionRow {
  const merchant = row?.merchant;
  return {
    id: String(row.id),
    date: String(row.date ?? '').slice(0, 10),
    type: row.type === 'income' ? 'income' : 'expense',
    amount: Number.parseFloat(row.amount ?? 0) || 0,
    title: row.title ?? null,
    notes: row.notes ?? null,
    category_id: row.category_id ?? null,
    account_id: row.account_id ?? null,
    merchant_id: row.merchant_id ?? null,
    receipt_url: row.receipt_url ?? null,
    merchant_name:
      merchant && typeof merchant === 'object'
        ? merchant.name ?? null
        : row.merchant_name ?? null,
  };
}

function computePercentile(values: number[], percentile: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * percentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sorted[lower];
  }
  const weight = index - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

export async function fetchMonthAggregates(
  month: Date,
  filters: NormalizedCalendarFilters,
): Promise<MonthAggregatesData> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Anda harus masuk untuk melihat kalender.');
  }

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

  const startStr = formatDate(monthStart);
  const endStr = formatDate(monthEnd);

  let query = supabase
    .from('transactions')
    .select(
      `id, date, type, amount, title, notes, category_id, account_id, merchant_id, receipt_url,
       merchant:merchant_id (id, name)`
    )
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('date', startStr)
    .lte('date', endStr)
    .order('date', { ascending: true })
    .order('id', { ascending: true });

  query = applyCommonFilters(query, filters);

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || 'Gagal memuat transaksi bulan ini.');
  }

  const rows = (data ?? []).map(mapTransaction);

  const daySummaries: Record<string, DaySummary> = {};
  let totalExpense = 0;
  let totalIncome = 0;

  for (const row of rows) {
    const key = row.date;
    if (!key) continue;
    const summary =
      daySummaries[key] ?? {
        date: key,
        expenseTotal: 0,
        incomeTotal: 0,
        count: 0,
      };
    summary.count += 1;
    if (row.type === 'expense') {
      summary.expenseTotal += row.amount;
      totalExpense += row.amount;
    } else if (row.type === 'income') {
      summary.incomeTotal += row.amount;
      totalIncome += row.amount;
    }
    daySummaries[key] = summary;
  }

  const dailyExpenseValues = Object.values(daySummaries)
    .map((item) => item.expenseTotal)
    .filter((value) => value > 0);

  const maxExpense = dailyExpenseValues.length
    ? Math.max(...dailyExpenseValues)
    : 0;
  const p80 = computePercentile(dailyExpenseValues, 0.8);
  const p95 = computePercentile(dailyExpenseValues, 0.95);

  let previousExpense = 0;
  try {
    const prevStart = startOfMonth(subMonths(monthStart, 1));
    const prevEnd = endOfMonth(subMonths(monthStart, 1));

    let prevQuery = supabase
      .from('transactions')
      .select('amount, type')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .gte('date', formatDate(prevStart))
      .lte('date', formatDate(prevEnd));

    prevQuery = applyCommonFilters(prevQuery, filters);

    const { data: prevRows, error: prevError } = await prevQuery;
    if (prevError) throw prevError;

    previousExpense = (prevRows ?? []).reduce((acc, row) => {
      if (row?.type === 'expense') {
        const amount = Number.parseFloat(row.amount ?? 0) || 0;
        return acc + amount;
      }
      return acc;
    }, 0);
  } catch (prevError) {
    console.warn('[calendar] Failed to fetch previous month totals', prevError);
    previousExpense = 0;
  }

  const net = totalIncome - totalExpense;
  const momExpenseChange = previousExpense > 0
    ? ((totalExpense - previousExpense) / previousExpense) * 100
    : totalExpense > 0
      ? 100
      : null;

  return {
    monthStart: startStr,
    monthEnd: endStr,
    daySummaries,
    totals: {
      expense: totalExpense,
      income: totalIncome,
      net,
      previousExpense,
      momExpenseChange,
    },
    stats: {
      p80,
      p95,
      maxExpense,
    },
  };
}

export async function fetchDayTransactions(
  date: string,
  filters: NormalizedCalendarFilters,
): Promise<CalendarTransactionRow[]> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Anda harus masuk untuk melihat detail transaksi.');
  }

  const normalizedDate = date.slice(0, 10);

  let query = supabase
    .from('transactions')
    .select(
      `id, date, type, amount, title, notes, category_id, account_id, merchant_id, receipt_url,
       merchant:merchant_id (id, name)`
    )
    .eq('user_id', userId)
    .is('deleted_at', null)
    .eq('date', normalizedDate)
    .order('date', { ascending: true })
    .order('id', { ascending: true });

  query = applyCommonFilters(query, filters);

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || 'Gagal memuat transaksi harian.');
  }

  return (data ?? []).map(mapTransaction);
}
