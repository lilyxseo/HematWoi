import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { supabase } from './supabase';
import { getCurrentUserId } from './session';
import type { DebtStatus, DebtType } from './api-debts';

const DATE_FORMAT = 'yyyy-MM-dd';

export type CalendarTypeFilter = 'expense' | 'debt';
export type CalendarMode = 'transactions' | 'debts';

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
  mode: CalendarMode;
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
  mode: CalendarMode;
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

interface CalendarBaseRow {
  id: string;
  date: string;
  amount: number;
  title: string | null;
  notes: string | null;
  kind: 'transaction' | 'debt';
}

export interface CalendarTransactionRow extends CalendarBaseRow {
  kind: 'transaction';
  type: 'income' | 'expense';
  category_id: string | null;
  account_id: string | null;
  merchant_id: string | null;
  receipt_url: string | null;
  merchant_name: string | null;
}

export interface CalendarDebtRow extends CalendarBaseRow {
  kind: 'debt';
  type: 'debt';
  debt_type: DebtType;
  status: DebtStatus;
  due_date: string | null;
  party_name: string;
  original_amount: number;
  paid_total: number;
}

export type CalendarItemRow = CalendarTransactionRow | CalendarDebtRow;

function formatDate(value: Date): string {
  return format(value, DATE_FORMAT);
}

export function normalizeCalendarFilters(filters: CalendarFilters): NormalizedCalendarFilters {
  const type: CalendarTypeFilter = filters.type === 'debt' ? 'debt' : 'expense';
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

  const mode: CalendarMode = type === 'debt' ? 'debts' : 'transactions';

  const types: ('expense' | 'income')[] =
    mode === 'transactions' ? (type === 'expense' ? ['expense'] : ['expense']) : [];

  return {
    type,
    mode,
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
    kind: 'transaction',
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

function mapDebt(row: Record<string, any>): CalendarDebtRow | null {
  const amount = Number.parseFloat(row.amount ?? 0) || 0;
  const paidTotal = Number.parseFloat(row.paid_total ?? 0) || 0;
  const remaining = Math.max(0, amount - paidTotal);
  const due = row.due_date ? new Date(row.due_date) : null;
  const fallbackDate = row.date ? new Date(row.date) : null;
  const effectiveDate = due && !Number.isNaN(due.getTime())
    ? due
    : fallbackDate && !Number.isNaN(fallbackDate.getTime())
    ? fallbackDate
    : null;
  if (!effectiveDate) {
    return null;
  }
  return {
    id: String(row.id),
    date: formatDate(effectiveDate),
    kind: 'debt',
    type: 'debt',
    amount: remaining,
    title: row.title ?? null,
    notes: row.notes ?? null,
    debt_type: (row.type as DebtType) ?? 'debt',
    status: (row.status as DebtStatus) ?? 'ongoing',
    due_date: row.due_date ?? null,
    party_name: row.party_name ?? '',
    original_amount: amount,
    paid_total: paidTotal,
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

  if (filters.mode === 'debts') {
    return fetchMonthDebtAggregates(month, userId);
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
        mode: 'transactions',
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

async function fetchMonthDebtAggregates(
  month: Date,
  userId: string,
): Promise<MonthAggregatesData> {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const startStr = formatDate(monthStart);
  const endStr = formatDate(monthEnd);
  const rangeStart = `${startStr}T00:00:00Z`;
  const rangeEnd = `${endStr}T23:59:59Z`;

  const { data, error } = await supabase
    .from('debts')
    .select('id, type, party_name, title, date, due_date, amount, paid_total, status, notes')
    .eq('user_id', userId)
    .in('status', ['ongoing', 'overdue'])
    .or(
      `and(due_date.gte.${rangeStart},due_date.lte.${rangeEnd}),and(due_date.is.null,date.gte.${rangeStart},date.lte.${rangeEnd})`,
    )
    .order('due_date', { ascending: true, nullsLast: false })
    .order('date', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Gagal memuat hutang bulan ini.');
  }

  const rows = (data ?? [])
    .map(mapDebt)
    .filter((row): row is CalendarDebtRow => row != null);

  const daySummaries: Record<string, DaySummary> = {};
  let totalDebt = 0;

  for (const row of rows) {
    const key = row.date;
    if (!key) continue;
    const summary =
      daySummaries[key] ?? {
        date: key,
        expenseTotal: 0,
        incomeTotal: 0,
        count: 0,
        mode: 'debts',
      };
    summary.count += 1;
    summary.expenseTotal += row.amount;
    daySummaries[key] = summary;
    totalDebt += row.amount;
  }

  const dailyDebtValues = Object.values(daySummaries)
    .map((item) => item.expenseTotal)
    .filter((value) => value > 0);

  const maxExpense = dailyDebtValues.length ? Math.max(...dailyDebtValues) : 0;
  const p80 = computePercentile(dailyDebtValues, 0.8);
  const p95 = computePercentile(dailyDebtValues, 0.95);

  let previousExpense = 0;
  try {
    const prevStart = startOfMonth(subMonths(monthStart, 1));
    const prevEnd = endOfMonth(subMonths(monthStart, 1));
    const prevStartStr = formatDate(prevStart);
    const prevEndStr = formatDate(prevEnd);
    const prevRangeStart = `${prevStartStr}T00:00:00Z`;
    const prevRangeEnd = `${prevEndStr}T23:59:59Z`;

    const { data: prevRows, error: prevError } = await supabase
      .from('debts')
      .select('amount, paid_total, due_date, date')
      .eq('user_id', userId)
      .in('status', ['ongoing', 'overdue'])
      .or(
        `and(due_date.gte.${prevRangeStart},due_date.lte.${prevRangeEnd}),and(due_date.is.null,date.gte.${prevRangeStart},date.lte.${prevRangeEnd})`,
      );

    if (prevError) throw prevError;

    previousExpense = (prevRows ?? []).reduce((acc, row) => {
      const amount = Number.parseFloat(row?.amount ?? 0) || 0;
      const paid = Number.parseFloat(row?.paid_total ?? 0) || 0;
      return acc + Math.max(0, amount - paid);
    }, 0);
  } catch (prevError) {
    console.warn('[calendar] Failed to fetch previous month debt totals', prevError);
    previousExpense = 0;
  }

  return {
    monthStart: startStr,
    monthEnd: endStr,
    daySummaries,
    totals: {
      expense: totalDebt,
      income: 0,
      net: -totalDebt,
      previousExpense,
      momExpenseChange: null,
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
): Promise<CalendarItemRow[]> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Anda harus masuk untuk melihat detail transaksi.');
  }

  if (filters.mode === 'debts') {
    return fetchDayDebts(date, userId);
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

async function fetchDayDebts(date: string, userId: string): Promise<CalendarDebtRow[]> {
  const normalizedDate = date.slice(0, 10);
  const dayStart = `${normalizedDate}T00:00:00Z`;
  const dayEnd = `${normalizedDate}T23:59:59Z`;

  const { data, error } = await supabase
    .from('debts')
    .select('id, type, party_name, title, date, due_date, amount, paid_total, status, notes')
    .eq('user_id', userId)
    .in('status', ['ongoing', 'overdue'])
    .or(
      `and(due_date.gte.${dayStart},due_date.lte.${dayEnd}),and(due_date.is.null,date.gte.${dayStart},date.lte.${dayEnd})`,
    )
    .order('due_date', { ascending: true, nullsLast: false })
    .order('date', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Gagal memuat hutang harian.');
  }

  return (data ?? [])
    .map(mapDebt)
    .filter((row): row is CalendarDebtRow => row != null);
}
