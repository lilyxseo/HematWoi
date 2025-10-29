import { format, startOfDay, addDays } from 'date-fns';
import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';
import { supabase } from './supabase';

export type CalendarTypeFilter = 'expense' | 'all';

export interface CalendarFilters {
  type: CalendarTypeFilter;
  categories: string[];
  accountIds: string[];
  minAmount?: number;
  maxAmount?: number;
  search?: string;
}

export interface RawTransactionRow {
  id: string;
  transaction_date: string;
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  category_id: string | null;
  note?: string | null;
  notes?: string | null;
  title?: string | null;
  merchant?: string | null;
  merchant_name?: string | null;
  merchant_id?: string | null;
  receipt_url?: string | null;
  account_id?: string | null;
}

export interface DayAggregate {
  date: string;
  expenseTotal: number;
  incomeTotal: number;
  transactionCount: number;
}

export interface MonthAggregateResult {
  days: Record<string, DayAggregate>;
  expenseTotal: number;
  incomeTotal: number;
  netTotal: number;
  expensePrevMonth: number;
  incomePrevMonth: number;
}

export interface DayTransactionsResult {
  date: string;
  transactions: RawTransactionRow[];
}

type QueryBuilder = PostgrestFilterBuilder<any, any, any>;

function formatDateKey(input: Date): string {
  return format(input, 'yyyy-MM-dd');
}

function escapeIlike(value: string): string {
  return value.replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function applyFilters(query: QueryBuilder, filters: CalendarFilters): QueryBuilder {
  const { type, categories, accountIds, minAmount, maxAmount, search } = filters;
  const normalizedType = type === 'all' ? ['expense', 'income'] : ['expense'];
  query = query.in('type', normalizedType);

  if (categories.length) {
    query = query.in('category_id', categories);
  }

  if (accountIds.length) {
    query = query.in('account_id', accountIds);
  }

  if (typeof minAmount === 'number' && Number.isFinite(minAmount)) {
    query = query.gte('amount', minAmount);
  }

  if (typeof maxAmount === 'number' && Number.isFinite(maxAmount)) {
    query = query.lte('amount', maxAmount);
  }

  if (search && search.trim()) {
    const escaped = escapeIlike(search.trim());
    const pattern = `%${escaped}%`;
    query = query.or(
      [
        `note.ilike.${pattern}`,
        `notes.ilike.${pattern}`,
        `title.ilike.${pattern}`,
        `merchant.ilike.${pattern}`,
        `merchant_name.ilike.${pattern}`,
      ].join(','),
    );
  }

  return query;
}

function aggregateRows(rows: RawTransactionRow[]): MonthAggregateResult {
  const days: Record<string, DayAggregate> = {};
  let expenseTotal = 0;
  let incomeTotal = 0;

  rows.forEach((row) => {
    if (!row.transaction_date) return;
    const key = row.transaction_date.slice(0, 10);
    if (!days[key]) {
      days[key] = {
        date: key,
        expenseTotal: 0,
        incomeTotal: 0,
        transactionCount: 0,
      };
    }

    const amount = Number(row.amount ?? 0) || 0;
    if (row.type === 'expense') {
      days[key]!.expenseTotal += amount;
      expenseTotal += amount;
    } else if (row.type === 'income') {
      days[key]!.incomeTotal += amount;
      incomeTotal += amount;
    }
    days[key]!.transactionCount += 1;
  });

  return {
    days,
    expenseTotal,
    incomeTotal,
    netTotal: incomeTotal - expenseTotal,
    expensePrevMonth: 0,
    incomePrevMonth: 0,
  };
}

export async function fetchMonthAggregates(options: {
  monthStart: Date;
  monthEnd: Date;
  filters: CalendarFilters;
}): Promise<MonthAggregateResult> {
  const { monthStart, monthEnd, filters } = options;
  const from = formatDateKey(monthStart);
  const to = formatDateKey(monthEnd);

  let baseQuery = supabase
    .from('transactions')
    .select(
      'id, transaction_date, type, amount, category_id, note, notes, title, merchant, merchant_name, merchant_id, receipt_url, account_id',
    )
    .gte('transaction_date', from)
    .lte('transaction_date', to)
    .order('transaction_date', { ascending: true });

  baseQuery = applyFilters(baseQuery, filters);
  const { data, error } = await baseQuery;
  if (error) {
    throw error;
  }

  const rows = (data ?? []) as RawTransactionRow[];
  const result = aggregateRows(rows);

  const prevStart = new Date(monthStart);
  prevStart.setMonth(prevStart.getMonth() - 1);
  prevStart.setDate(1);
  const prevEnd = new Date(prevStart);
  prevEnd.setMonth(prevEnd.getMonth() + 1);
  prevEnd.setDate(0);

  let prevQuery = supabase
    .from('transactions')
    .select('id, transaction_date, type, amount, category_id')
    .gte('transaction_date', formatDateKey(prevStart))
    .lte('transaction_date', formatDateKey(prevEnd));

  prevQuery = applyFilters(prevQuery, filters);
  const { data: prevData, error: prevError } = await prevQuery;
  if (prevError) {
    throw prevError;
  }
  const prevRows = (prevData ?? []) as RawTransactionRow[];
  const prevAggregate = aggregateRows(prevRows);

  return {
    ...result,
    expensePrevMonth: prevAggregate.expenseTotal,
    incomePrevMonth: prevAggregate.incomeTotal,
  };
}

export async function fetchDayTransactions(options: {
  date: Date;
  filters: CalendarFilters;
}): Promise<DayTransactionsResult> {
  const { date, filters } = options;
  const start = startOfDay(date);
  const nextDay = addDays(start, 1);

  let query = supabase
    .from('transactions')
    .select(
      'id, transaction_date, type, amount, category_id, note, notes, title, merchant, merchant_name, merchant_id, receipt_url, account_id',
    )
    .gte('transaction_date', format(start, 'yyyy-MM-dd'))
    .lt('transaction_date', format(nextDay, 'yyyy-MM-dd'))
    .order('transaction_date', { ascending: true });

  query = applyFilters(query, filters);
  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return {
    date: formatDateKey(start),
    transactions: (data ?? []) as RawTransactionRow[],
  };
}
