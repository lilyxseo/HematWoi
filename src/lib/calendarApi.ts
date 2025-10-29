import { formatISO, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from 'date-fns';
import { supabase } from './supabase';

export type CalendarTransactionType = 'income' | 'expense';

export interface CalendarFilters {
  includeIncome: boolean;
  categoryIds: string[];
  accountIds: string[];
  minAmount: number | null;
  maxAmount: number | null;
  search: string;
}

export interface CalendarDayAggregate {
  expenseTotal: number;
  incomeTotal: number;
  transactionCount: number;
}

export interface MonthAggregatesResult {
  days: Record<string, CalendarDayAggregate>;
  totals: { expense: number; income: number; net: number };
  previousTotals: { expense: number; income: number; net: number };
  mom: { expense: number | null; income: number | null; net: number | null };
  stats: { p80: number; maxExpense: number };
}

export interface DayTransactionCategory {
  id: string;
  name: string;
  color?: string | null;
}

export interface DayTransactionAccount {
  id: string;
  name: string;
}

export interface DayTransactionRow {
  id: string;
  date: string;
  type: CalendarTransactionType;
  amount: number;
  note: string | null;
  merchant: string | null;
  receiptUrl: string | null;
  category: DayTransactionCategory | null;
  account: DayTransactionAccount | null;
}

export interface DayTransactionsResult {
  transactions: DayTransactionRow[];
  totals: { expense: number; income: number };
}

type RawTransactionRow = {
  id?: string;
  date?: string;
  type?: string;
  amount?: number | string | null;
  category_id?: string | null;
  account_id?: string | null;
  title?: string | null;
  notes?: string | null;
  note?: string | null;
  merchant?: { name?: string | null } | null;
  merchant_id?: string | null;
  merchant_name?: string | null;
  receipt_url?: string | null;
  account?: { id?: string | null; name?: string | null } | null;
  category?: { id?: string | null; name?: string | null; color?: string | null } | null;
};

function ensureArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0))).map((item) => item.trim());
}

function sanitizeAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseFloat(value.replace(/[^0-9.,-]/g, '').replace(/,/g, '.'));
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return null;
}

export function normalizeFiltersInput(filters?: Partial<CalendarFilters> | null): CalendarFilters {
  const includeIncome = Boolean(filters?.includeIncome);
  const categoryIds = ensureArray(filters?.categoryIds);
  const accountIds = ensureArray(filters?.accountIds);
  const minAmount = sanitizeAmount(filters?.minAmount ?? null);
  const maxAmount = sanitizeAmount(filters?.maxAmount ?? null);
  const search = typeof filters?.search === 'string' ? filters.search.trim() : '';

  let normalizedMin = minAmount;
  let normalizedMax = maxAmount;
  if (normalizedMin !== null && normalizedMax !== null && normalizedMin > normalizedMax) {
    [normalizedMin, normalizedMax] = [normalizedMax, normalizedMin];
  }

  return {
    includeIncome,
    categoryIds,
    accountIds,
    minAmount: normalizedMin,
    maxAmount: normalizedMax,
    search,
  };
}

export function serializeFiltersKey(filters: CalendarFilters): string {
  const normalized = normalizeFiltersInput(filters);
  return JSON.stringify({
    includeIncome: normalized.includeIncome,
    categoryIds: [...normalized.categoryIds].sort(),
    accountIds: [...normalized.accountIds].sort(),
    minAmount: normalized.minAmount,
    maxAmount: normalized.maxAmount,
    search: normalized.search,
  });
}

function applyFilters(query: any, filters: CalendarFilters) {
  let next = query.eq('deleted_at', null);

  const allowedTypes: CalendarTransactionType[] = filters.includeIncome ? ['expense', 'income'] : ['expense'];
  if (allowedTypes.length === 1) {
    next = next.eq('type', allowedTypes[0]);
  } else {
    next = next.in('type', allowedTypes);
  }

  if (filters.categoryIds.length > 0) {
    next = next.in('category_id', filters.categoryIds);
  }

  if (filters.accountIds.length > 0) {
    next = next.in('account_id', filters.accountIds);
  }

  if (filters.minAmount !== null) {
    next = next.gte('amount', filters.minAmount);
  }

  if (filters.maxAmount !== null) {
    next = next.lte('amount', filters.maxAmount);
  }

  return next;
}

function matchesSearch(row: RawTransactionRow, term: string): boolean {
  if (!term) return true;
  const lowered = term.toLowerCase();
  const candidates: Array<string | null | undefined> = [
    row.title,
    row.note,
    row.notes,
    row.merchant?.name,
    row.merchant_name,
  ];
  return candidates.some((value) => typeof value === 'string' && value.toLowerCase().includes(lowered));
}

function mapAggregateRows(rows: RawTransactionRow[]): RawTransactionRow[] {
  return rows.filter((row) => typeof row.date === 'string' && row.type && row.amount !== null);
}

function computeMom(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function percentile(values: number[], percent: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * percent;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sorted[lower];
  }
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

async function fetchRange(
  userId: string,
  startIso: string,
  endIso: string,
  filters: CalendarFilters,
): Promise<RawTransactionRow[]> {
  const base = supabase
    .from('transactions')
    .select(`id, date, type, amount, category_id, account_id, title, notes, note, receipt_url, merchant:merchant_id(name)`)
    .eq('user_id', userId)
    .gte('date', startIso)
    .lte('date', endIso)
    .order('date', { ascending: true });

  const query = applyFilters(base, filters);
  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || 'Gagal memuat data kalender');
  }
  return (data ?? []).filter((row) => matchesSearch(row, filters.search));
}

function toDayKey(value: string): string | null {
  if (!value) return null;
  if (value.length >= 10) {
    return value.slice(0, 10);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatISO(date, { representation: 'date' });
}

export async function fetchMonthAggregates(params: {
  userId: string;
  month: Date;
  filters: CalendarFilters;
}): Promise<MonthAggregatesResult> {
  const { userId, month, filters: rawFilters } = params;
  if (!userId) {
    throw new Error('User belum masuk');
  }
  const filters = normalizeFiltersInput(rawFilters);
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const startIso = formatISO(monthStart, { representation: 'complete' });
  const endIso = formatISO(monthEnd, { representation: 'complete' });

  const rows = await fetchRange(userId, startIso, endIso, filters);
  const aggregates: Record<string, CalendarDayAggregate> = {};
  let totalExpense = 0;
  let totalIncome = 0;

  mapAggregateRows(rows).forEach((row) => {
    const key = toDayKey(row.date ?? '');
    if (!key) return;
    const amount = Number(row.amount ?? 0) || 0;
    if (!aggregates[key]) {
      aggregates[key] = { expenseTotal: 0, incomeTotal: 0, transactionCount: 0 };
    }
    const type = row.type === 'income' ? 'income' : 'expense';
    if (type === 'expense') {
      aggregates[key].expenseTotal += amount;
      totalExpense += amount;
    } else {
      aggregates[key].incomeTotal += amount;
      totalIncome += amount;
    }
    aggregates[key].transactionCount += 1;
  });

  const expenseValues = Object.values(aggregates)
    .map((item) => item.expenseTotal)
    .filter((value) => value > 0);
  const maxExpense = expenseValues.length ? Math.max(...expenseValues) : 0;
  const p80 = percentile(expenseValues, 0.8);

  const previousMonth = subMonths(monthStart, 1);
  const previousStartIso = formatISO(startOfMonth(previousMonth), { representation: 'complete' });
  const previousEndIso = formatISO(endOfMonth(previousMonth), { representation: 'complete' });
  const previousRows = await fetchRange(userId, previousStartIso, previousEndIso, filters);

  let previousExpense = 0;
  let previousIncome = 0;
  mapAggregateRows(previousRows).forEach((row) => {
    const amount = Number(row.amount ?? 0) || 0;
    if (row.type === 'income') {
      previousIncome += amount;
    } else {
      previousExpense += amount;
    }
  });

  const momExpense = computeMom(totalExpense, previousExpense);
  const momIncome = filters.includeIncome ? computeMom(totalIncome, previousIncome) : null;
  const currentNet = totalIncome - totalExpense;
  const previousNet = previousIncome - previousExpense;
  const momNet = computeMom(currentNet, previousNet);

  return {
    days: aggregates,
    totals: { expense: totalExpense, income: totalIncome, net: currentNet },
    previousTotals: { expense: previousExpense, income: previousIncome, net: previousNet },
    mom: { expense: momExpense, income: momIncome, net: momNet },
    stats: { p80, maxExpense },
  };
}

export async function fetchDayTransactions(params: {
  userId: string;
  date: string;
  filters: CalendarFilters;
}): Promise<DayTransactionsResult> {
  const { userId, date, filters: rawFilters } = params;
  if (!userId) {
    throw new Error('User belum masuk');
  }
  const filters = normalizeFiltersInput(rawFilters);
  const target = new Date(date);
  if (Number.isNaN(target.getTime())) {
    throw new Error('Tanggal tidak valid');
  }
  const startIso = formatISO(startOfDay(target));
  const endIso = formatISO(endOfDay(target));

  const base = supabase
    .from('transactions')
    .select(
      `id, date, type, amount, title, notes, note, receipt_url, category:category_id (id, name, color), account:account_id (id, name), merchant:merchant_id (name)`,
    )
    .eq('user_id', userId)
    .gte('date', startIso)
    .lte('date', endIso)
    .order('date', { ascending: false });

  const query = applyFilters(base, filters);
  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || 'Gagal memuat transaksi harian');
  }

  const filtered = (data ?? []).filter((row) => matchesSearch(row as RawTransactionRow, filters.search));

  const transactions: DayTransactionRow[] = filtered.map((row) => {
    const typed = row as RawTransactionRow;
    const amount = Number(typed.amount ?? 0) || 0;
    const type = typed.type === 'income' ? 'income' : 'expense';
    const category = typed.category?.id
      ? {
          id: String(typed.category.id),
          name: typed.category.name ?? '',
          color: typed.category.color ?? null,
        }
      : null;
    const account = typed.account?.id
      ? { id: String(typed.account.id), name: typed.account.name ?? '' }
      : null;
    const noteValue = typed.title ?? typed.note ?? typed.notes ?? '';
    const merchantName = typed.merchant?.name ?? typed.merchant_name ?? null;
    const fallbackId =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    return {
      id: typed.id ? String(typed.id) : fallbackId,
      date: typed.date ?? new Date().toISOString(),
      type,
      amount,
      note: typeof noteValue === 'string' ? noteValue : null,
      merchant: merchantName,
      receiptUrl: typed.receipt_url ?? null,
      category,
      account,
    };
  });

  let totalExpense = 0;
  let totalIncome = 0;
  transactions.forEach((transaction) => {
    if (transaction.type === 'income') {
      totalIncome += transaction.amount;
    } else {
      totalExpense += transaction.amount;
    }
  });

  return {
    transactions,
    totals: { expense: totalExpense, income: totalIncome },
  };
}
