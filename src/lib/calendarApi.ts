import { supabase } from './supabase';
import { getCurrentUserId } from './session';

export type CalendarFilters = {
  includeIncome: boolean;
  categories: string[];
  accountId?: string | null;
  amountMin?: number | null;
  amountMax?: number | null;
  search?: string | null;
};

export type CalendarTransaction = {
  id: string;
  date: string;
  type: 'income' | 'expense';
  amount: number;
  category_id: string | null;
  title: string | null;
  notes: string | null;
  account_id: string | null;
  merchant_id: string | null;
  receipt_url: string | null;
};

export type DayAggregate = {
  date: string;
  totalExpense: number;
  totalIncome: number;
  count: number;
};

export type MonthAggregateResult = {
  transactions: CalendarTransaction[];
  dayMap: Record<string, DayAggregate>;
  totalExpense: number;
  totalIncome: number;
  previousExpense: number;
  previousIncome: number;
};

export type PercentileSummary = {
  p80: number;
  p95: number;
  max: number;
};

export type MonthAggregatesResponse = MonthAggregateResult & {
  percentiles: PercentileSummary;
};

type FetchMonthParams = {
  startDate: string;
  endDate: string;
  previousStart: string;
  previousEnd: string;
  filters: CalendarFilters;
};

const BASE_SELECT =
  'id,date,type,amount,category_id,title,notes,account_id,merchant_id,receipt_url';

function sanitizeSearchTerm(term: string): string {
  return term.replace(/,/g, '\\,').trim();
}

function applyFilters(query: any, filters: CalendarFilters) {
  const { includeIncome, categories, accountId, amountMin, amountMax, search } = filters;

  if (includeIncome) {
    query = query.in('type', ['expense', 'income']);
  } else {
    query = query.eq('type', 'expense');
  }

  if (categories && categories.length) {
    const safe = categories.filter((value) => typeof value === 'string' && value.trim().length);
    if (safe.length) {
      query = query.in('category_id', safe);
    }
  }

  if (accountId && typeof accountId === 'string' && accountId.trim().length) {
    query = query.eq('account_id', accountId);
  }

  if (typeof amountMin === 'number' && Number.isFinite(amountMin)) {
    query = query.gte('amount', amountMin);
  }

  if (typeof amountMax === 'number' && Number.isFinite(amountMax)) {
    query = query.lte('amount', amountMax);
  }

  if (search && search.trim()) {
    const sanitized = sanitizeSearchTerm(search);
    if (sanitized) {
      const pattern = `%${sanitized}%`;
      query = query.or(`title.ilike.${pattern},notes.ilike.${pattern},merchant_id.ilike.${pattern}`);
    }
  }

  return query;
}

function buildDayMap(rows: CalendarTransaction[]): Record<string, DayAggregate> {
  const map: Record<string, DayAggregate> = {};

  for (const row of rows) {
    const key = row.date?.slice(0, 10) ?? '';
    if (!key) continue;
    if (!map[key]) {
      map[key] = {
        date: key,
        totalExpense: 0,
        totalIncome: 0,
        count: 0,
      };
    }
    const entry = map[key];
    entry.count += 1;
    if (row.type === 'expense') {
      entry.totalExpense += Number(row.amount ?? 0) || 0;
    } else if (row.type === 'income') {
      entry.totalIncome += Number(row.amount ?? 0) || 0;
    }
  }

  return map;
}

function computePercentiles(expenseByDay: number[]): PercentileSummary {
  if (!expenseByDay.length) {
    return { p80: 0, p95: 0, max: 0 };
  }
  const sorted = [...expenseByDay].sort((a, b) => a - b);
  const percentile = (p: number) => {
    if (sorted.length === 1) return sorted[0];
    const rank = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(rank);
    const upper = Math.ceil(rank);
    const weight = rank - lower;
    if (upper >= sorted.length) return sorted[sorted.length - 1];
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  };

  return {
    p80: percentile(80),
    p95: percentile(95),
    max: sorted[sorted.length - 1],
  };
}

function sumByType(rows: CalendarTransaction[]) {
  let expense = 0;
  let income = 0;
  for (const row of rows) {
    const amount = Number(row.amount ?? 0) || 0;
    if (row.type === 'expense') {
      expense += amount;
    } else if (row.type === 'income') {
      income += amount;
    }
  }
  return { expense, income };
}

export async function fetchMonthAggregates({
  startDate,
  endDate,
  previousStart,
  previousEnd,
  filters,
}: FetchMonthParams): Promise<MonthAggregatesResponse> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Harus login terlebih dahulu.');
  }

  const baseQuery = () =>
    supabase
      .from('transactions')
      .select(BASE_SELECT)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .neq('type', 'transfer');

  const currentQuery = applyFilters(
    baseQuery()
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('inserted_at', { ascending: true }),
    filters,
  );

  const previousQuery = applyFilters(
    baseQuery().gte('date', previousStart).lte('date', previousEnd),
    filters,
  );

  const [{ data: currentRows, error: currentError }, { data: previousRows, error: previousError }] =
    await Promise.all([currentQuery, previousQuery]);

  if (currentError) throw currentError;
  if (previousError) throw previousError;

  const rows = (currentRows ?? []) as CalendarTransaction[];
  const previous = (previousRows ?? []) as CalendarTransaction[];

  const dayMap = buildDayMap(rows);
  const { expense: totalExpense, income: totalIncome } = sumByType(rows);
  const { expense: previousExpense, income: previousIncome } = sumByType(previous);

  const percentiles = computePercentiles(
    Object.values(dayMap).map((item) => item.totalExpense),
  );

  return {
    transactions: rows,
    dayMap,
    totalExpense,
    totalIncome,
    previousExpense,
    previousIncome,
    percentiles,
  };
}

type FetchDayParams = {
  date: string;
  filters: CalendarFilters;
};

export async function fetchDayTransactions({
  date,
  filters,
}: FetchDayParams): Promise<CalendarTransaction[]> {
  if (!date) return [];
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Harus login terlebih dahulu.');
  }
  let query = supabase
    .from('transactions')
    .select(BASE_SELECT)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .eq('date', date)
    .in('type', filters.includeIncome ? ['expense', 'income'] : ['expense'])
    .neq('type', 'transfer')
    .order('date', { ascending: true })
    .order('inserted_at', { ascending: true });

  if (filters.categories && filters.categories.length) {
    const safe = filters.categories.filter((value) => typeof value === 'string' && value.trim().length);
    if (safe.length) {
      query = query.in('category_id', safe);
    }
  }

  if (filters.accountId && filters.accountId.trim().length) {
    query = query.eq('account_id', filters.accountId);
  }

  if (typeof filters.amountMin === 'number' && Number.isFinite(filters.amountMin)) {
    query = query.gte('amount', filters.amountMin);
  }

  if (typeof filters.amountMax === 'number' && Number.isFinite(filters.amountMax)) {
    query = query.lte('amount', filters.amountMax);
  }

  if (filters.search && filters.search.trim()) {
    const sanitized = sanitizeSearchTerm(filters.search);
    if (sanitized) {
      const pattern = `%${sanitized}%`;
      query = query.or(
        `title.ilike.${pattern},notes.ilike.${pattern},merchant_id.ilike.${pattern}`,
        { referencedTable: undefined }
      );
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CalendarTransaction[];
}

type AccountOption = {
  id: string;
  name: string;
};

export async function fetchAccounts(): Promise<AccountOption[]> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Harus login terlebih dahulu.');
  }
  const { data, error } = await supabase
    .from('accounts')
    .select('id,name')
    .eq('user_id', userId)
    .order('name', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as { id: string; name: string | null }[]).map((row) => ({
    id: row.id,
    name: row.name?.trim() || 'Tanpa nama',
  }));
}
