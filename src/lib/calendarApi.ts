import { supabase } from "./supabase";

export type CalendarType = "income" | "expense" | "transfer";

export interface CalendarFilters {
  includeIncome: boolean;
  categories: string[];
  accounts: string[];
  amountMin: number | null;
  amountMax: number | null;
  search: string;
}

export interface CalendarTransaction {
  id: string;
  transaction_date: string;
  type: CalendarType;
  amount: number;
  category_id: string | null;
  category_name: string | null;
  note: string | null;
  merchant_id: string | null;
  merchant_name: string | null;
  receipt_url: string | null;
  account_id: string | null;
  created_at: string | null;
}

export interface MonthTransactionsResult {
  transactions: CalendarTransaction[];
  previousExpenseTotal: number;
  previousIncomeTotal: number;
}

const TRANSACTION_COLUMNS =
  "id, transaction_date, type, amount, category_id, category_name, note, merchant_id, merchant_name, receipt_url, account_id, created_at";

function createTypeFilter(filters: CalendarFilters): CalendarType[] {
  return filters.includeIncome ? ["expense", "income"] : ["expense"];
}

function normalizeString(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  return String(value ?? "").trim() || null;
}

function normalizeTransaction(row: Record<string, any>): CalendarTransaction | null {
  const rawId = row?.id;
  const rawDate =
    row?.transaction_date ?? row?.date ?? row?.created_at ?? row?.posted_at ?? null;
  if (!rawId || !rawDate) {
    return null;
  }
  const typeSource = normalizeString(row?.type) ?? "";
  const normalizedType: CalendarType =
    typeSource === "income" || typeSource === "expense"
      ? (typeSource as CalendarType)
      : "transfer";

  const amountValue = Number(row?.amount ?? row?.nominal ?? 0);
  const categoryId = normalizeString(row?.category_id);
  const categoryName =
    normalizeString(row?.category_name) ?? normalizeString(row?.category);
  const note = normalizeString(row?.note ?? row?.notes ?? row?.title ?? row?.description);
  const merchantId = normalizeString(row?.merchant_id);
  const merchantName =
    normalizeString(row?.merchant_name) ??
    normalizeString(row?.merchant_label) ??
    normalizeString(row?.merchant);
  const receiptUrl = normalizeString(row?.receipt_url ?? row?.receiptUrl);
  const accountId = normalizeString(row?.account_id);
  const createdAt = normalizeString(row?.created_at);

  return {
    id: String(rawId),
    transaction_date: String(rawDate).slice(0, 19),
    type: normalizedType,
    amount: Number.isFinite(amountValue) ? amountValue : 0,
    category_id: categoryId,
    category_name: categoryName,
    note,
    merchant_id: merchantId,
    merchant_name: merchantName,
    receipt_url: receiptUrl,
    account_id: accountId,
    created_at: createdAt,
  };
}

function matchesClientFilters(
  transaction: CalendarTransaction,
  filters: CalendarFilters,
): boolean {
  const amountAbs = Math.abs(Number(transaction.amount) || 0);
  if (
    filters.amountMin != null &&
    Number.isFinite(filters.amountMin) &&
    amountAbs < filters.amountMin
  ) {
    return false;
  }
  if (
    filters.amountMax != null &&
    Number.isFinite(filters.amountMax) &&
    amountAbs > filters.amountMax
  ) {
    return false;
  }

  if (!filters.search) {
    return true;
  }
  const keyword = filters.search.toLocaleLowerCase("id-ID");
  const note = transaction.note?.toLocaleLowerCase("id-ID") ?? "";
  const merchant =
    transaction.merchant_name?.toLocaleLowerCase("id-ID") ??
    transaction.merchant_id?.toLocaleLowerCase("id-ID") ??
    "";
  return note.includes(keyword) || merchant.includes(keyword);
}

function normalizeTransactions(
  rows: Record<string, any>[] | null,
  filters: CalendarFilters,
): CalendarTransaction[] {
  if (!rows || rows.length === 0) {
    return [];
  }
  return rows
    .map((row) => normalizeTransaction(row))
    .filter((item): item is CalendarTransaction => Boolean(item))
    .filter((item) => matchesClientFilters(item, filters));
}

function applyServerFilters(
  query: any,
  filters: CalendarFilters,
) {
  const typeFilter = createTypeFilter(filters);
  if (typeFilter.length) {
    query = query.in("type", typeFilter);
  }
  if (filters.categories.length) {
    query = query.in("category_id", filters.categories);
  }
  if (filters.accounts.length) {
    query = query.in("account_id", filters.accounts);
  }
  return query;
}

export async function fetchMonthTransactions({
  startDate,
  endDate,
  previousStartDate,
  previousEndDate,
  filters,
  signal,
}: {
  startDate: string;
  endDate: string;
  previousStartDate: string;
  previousEndDate: string;
  filters: CalendarFilters;
  signal?: AbortSignal;
}): Promise<MonthTransactionsResult> {
  const currentQuery = applyServerFilters(
    supabase
      .from("transactions")
      .select(TRANSACTION_COLUMNS)
      .gte("transaction_date", startDate)
      .lte("transaction_date", endDate)
      .order("transaction_date", { ascending: true })
      .order("created_at", { ascending: true, nullsFirst: true }),
    filters,
  );

  const previousQuery = applyServerFilters(
    supabase
      .from("transactions")
      .select(TRANSACTION_COLUMNS)
      .gte("transaction_date", previousStartDate)
      .lte("transaction_date", previousEndDate)
      .order("transaction_date", { ascending: true }),
    filters,
  );

  const currentPromise = signal
    ? currentQuery.abortSignal(signal)
    : currentQuery;
  const previousPromise = signal
    ? previousQuery.abortSignal(signal)
    : previousQuery;

  const [currentResult, previousResult] = await Promise.all([
    currentPromise,
    previousPromise,
  ]);

  if (currentResult.error) {
    throw currentResult.error;
  }
  if (previousResult.error) {
    throw previousResult.error;
  }

  const transactions = normalizeTransactions(currentResult.data ?? [], filters);
  const previousTransactions = normalizeTransactions(
    previousResult.data ?? [],
    filters,
  );

  const previousExpenseTotal = previousTransactions
    .filter((item) => item.type === "expense")
    .reduce((total, item) => total + Math.abs(Number(item.amount) || 0), 0);

  const previousIncomeTotal = previousTransactions
    .filter((item) => item.type === "income")
    .reduce((total, item) => total + Math.abs(Number(item.amount) || 0), 0);

  return {
    transactions,
    previousExpenseTotal,
    previousIncomeTotal,
  };
}

export async function fetchDayTransactions({
  date,
  filters,
  signal,
}: {
  date: string;
  filters: CalendarFilters;
  signal?: AbortSignal;
}): Promise<CalendarTransaction[]> {
  const baseQuery = applyServerFilters(
    supabase
      .from("transactions")
      .select(TRANSACTION_COLUMNS)
      .eq("transaction_date", date)
      .order("transaction_date", { ascending: true })
      .order("created_at", { ascending: true, nullsFirst: true }),
    filters,
  );

  const query = signal ? baseQuery.abortSignal(signal) : baseQuery;
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return normalizeTransactions(data ?? [], filters);
}
