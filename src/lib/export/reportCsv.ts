type PeriodFilters = {
  preset: 'month' | 'custom';
  month: string;
  start: string;
  end: string;
};

export type ReportFilters = {
  period: PeriodFilters;
  accounts: string[];
  categories: string[];
  includeSubcategories: boolean;
  includeTransfers: boolean;
  includePending: boolean;
  search: string;
};

type CategorySource = Record<string, any>;
type AccountSource = Record<string, any>;
type TransactionSource = Record<string, any>;

type NormalizedCategory = {
  id: string;
  name: string;
  parentId: string | null;
};

type NormalizedAccount = {
  id: string;
  name: string;
};

type NormalizedTransaction = {
  id: string;
  date: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  accountId: string | null;
  accountName: string;
  categoryId: string | null;
  categoryName: string;
  notes: string;
  tags: string;
  createdAt: string;
  updatedAt: string;
  isPending: boolean;
  isTransfer: boolean;
};

export type ReportSummary = {
  period_start: string;
  period_end: string;
  total_income: number;
  total_expense: number;
  net: number;
  savings_rate: number;
  avg_daily_expense: number;
  largest_expense_amount: number;
  largest_expense_date: string;
  top_category_name: string;
  top_category_amount: number;
  top_category_share: number;
  cashflow_volatility: number;
};

export type CategoryReportRow = {
  category_id: string;
  category_name: string;
  parent_category: string;
  total_income: number;
  total_expense: number;
  net: number;
  transaction_count: number;
  average_amount: number;
  share_of_total_expense: number;
};

export type DailyReportRow = {
  date: string;
  income: number;
  expense: number;
  net: number;
  cumulative_net: number;
};

export type TransactionReportRow = {
  transaction_id: string;
  date: string;
  account_name: string;
  category_name: string;
  notes: string;
  amount: number;
  type: string;
  tags?: string;
  created_at?: string;
  updated_at?: string;
};

export type ReportData = {
  summary: ReportSummary;
  categories: CategoryReportRow[];
  daily: DailyReportRow[];
  transactions: TransactionReportRow[];
  meta: {
    periodStart: string;
    periodEnd: string;
    days: number;
  };
};

type CsvColumn<T> = {
  key: keyof T;
  header: string;
};

function toIsoDate(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') {
    if (value.length >= 10) return value.slice(0, 10);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10);
  }
  try {
    const parsed = new Date(value as string);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function safeString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return String(value);
}

function normalizeCategory(categories: CategorySource[]): NormalizedCategory[] {
  return categories
    .map((cat) => {
      const id = safeString(cat.id ?? cat.uuid ?? cat.category_id ?? cat.key);
      if (!id) return null;
      const parentId = safeString(cat.parent_id ?? cat.parentId ?? cat.parent?.id ?? cat.parent_category_id);
      return {
        id,
        name: safeString(cat.name ?? cat.label ?? cat.title ?? 'Tanpa nama'),
        parentId: parentId || null,
      };
    })
    .filter((cat): cat is NormalizedCategory => Boolean(cat));
}

function normalizeAccounts(accounts: AccountSource[]): NormalizedAccount[] {
  return accounts
    .map((acc) => {
      const id = safeString(acc.id ?? acc.uuid ?? acc.account_id ?? acc.key);
      if (!id) return null;
      return {
        id,
        name: safeString(acc.name ?? acc.title ?? acc.label ?? 'Tanpa nama'),
      };
    })
    .filter((acc): acc is NormalizedAccount => Boolean(acc));
}

function detectPending(tx: TransactionSource): boolean {
  const status = String(tx.status ?? '').toLowerCase();
  if (status === 'pending') return true;
  const rawPending = tx.pending ?? tx.is_pending ?? tx.isPending;
  if (typeof rawPending === 'boolean') return rawPending;
  const cleared = tx.cleared ?? tx.is_cleared ?? tx.isCleared;
  if (typeof cleared === 'boolean') return !cleared;
  return false;
}

function detectTransfer(tx: TransactionSource, type: string): boolean {
  if (type === 'transfer') return true;
  return Boolean(tx.transfer_group_id ?? tx.transferGroupId ?? tx.parent_id ?? tx.parentId);
}

function normalizeTransactions(
  transactions: TransactionSource[],
  categories: NormalizedCategory[],
  accounts: NormalizedAccount[],
): NormalizedTransaction[] {
  const categoryMap = new Map(categories.map((cat) => [cat.id, cat.name]));
  const accountMap = new Map(accounts.map((acc) => [acc.id, acc.name]));

  return transactions
    .map((tx) => {
      const id = safeString(tx.id ?? tx.uuid ?? tx._id);
      if (!id) return null;
      const rawDate =
        tx.date ??
        tx.transaction_date ??
        tx.posted_at ??
        tx.created_at ??
        tx.createdAt ??
        tx.inserted_at;
      const date = toIsoDate(rawDate);
      const rawAmount = Number(tx.amount ?? 0);
      const rawType = safeString(tx.type ?? tx.transaction_type);
      const type: NormalizedTransaction['type'] =
        rawType === 'income' || rawType === 'expense' || rawType === 'transfer'
          ? rawType
          : rawAmount < 0
            ? 'expense'
            : 'income';
      const amount = Math.abs(rawAmount);
      const categoryId = safeString(tx.category_id ?? tx.categoryId ?? tx.category?.id ?? tx.category_uuid);
      const accountId = safeString(tx.account_id ?? tx.accountId ?? tx.account?.id);
      const categoryName =
        safeString(tx.category_name ?? tx.category?.name ?? tx.category) ||
        (categoryId ? categoryMap.get(categoryId) ?? '' : '') ||
        'Tanpa kategori';
      const accountName =
        safeString(tx.account_name ?? tx.account?.name ?? tx.account) ||
        (accountId ? accountMap.get(accountId) ?? '' : '') ||
        'Tanpa akun';
      const notes = safeString(tx.notes ?? tx.note ?? tx.title ?? tx.description);
      const tagsValue = tx.tags ?? tx.tag_list ?? tx.labels ?? tx.label;
      const tags = Array.isArray(tagsValue) ? tagsValue.filter(Boolean).join('|') : safeString(tagsValue);
      const createdAt = toIsoDate(tx.created_at ?? tx.inserted_at ?? tx.createdAt ?? tx.insertedAt);
      const updatedAt = toIsoDate(tx.updated_at ?? tx.updatedAt);
      const isPending = detectPending(tx);
      const isTransfer = detectTransfer(tx, type);
      return {
        id,
        date,
        type,
        amount,
        accountId: accountId || null,
        accountName,
        categoryId: categoryId || null,
        categoryName,
        notes,
        tags,
        createdAt,
        updatedAt,
        isPending,
        isTransfer,
      };
    })
    .filter((tx): tx is NormalizedTransaction => Boolean(tx));
}

function normalizeFilters(filters: ReportFilters, categories: NormalizedCategory[]) {
  const month = filters.period.month;
  let start = filters.period.start;
  let end = filters.period.end;
  if (filters.period.preset === 'month') {
    if (month) {
      start = `${month}-01`;
      const [year, monthIndex] = month.split('-').map((value) => Number.parseInt(value, 10));
      const lastDay = Number.isFinite(year) && Number.isFinite(monthIndex)
        ? new Date(year, monthIndex, 0).getDate()
        : 31;
      end = `${month}-${String(lastDay).padStart(2, '0')}`;
    }
  }
  const categoryChildren = new Map<string, Set<string>>();
  categories.forEach((cat) => {
    if (!cat.parentId) return;
    const bucket = categoryChildren.get(cat.parentId) ?? new Set();
    bucket.add(cat.id);
    categoryChildren.set(cat.parentId, bucket);
  });
  return {
    start,
    end,
    categoryChildren,
  };
}

function isWithinRange(date: string, start: string, end: string) {
  if (!date) return false;
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

function computeDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
  const diff = endDate.getTime() - startDate.getTime();
  if (diff < 0) return 0;
  return Math.floor(diff / 86400000) + 1;
}

function formatCsvValue(value: unknown): string {
  const raw = safeString(value);
  if (raw === '') return '';
  const escaped = raw.replace(/"/g, '""');
  if (/[",\n\r]/.test(raw)) {
    return `"${escaped}"`;
  }
  return escaped;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((col) => formatCsvValue(col.header)).join(',');
  const lines = rows.map((row) =>
    columns
      .map((col) => formatCsvValue((row as Record<string, unknown>)[col.key as string]))
      .join(','),
  );
  return `\uFEFF${[header, ...lines].join('\n')}`;
}

export function buildReportData(
  filters: ReportFilters,
  dataSources: {
    transactions: TransactionSource[];
    categories: CategorySource[];
    accounts: AccountSource[];
  },
): ReportData {
  const normalizedCategories = normalizeCategory(dataSources.categories || []);
  const normalizedAccounts = normalizeAccounts(dataSources.accounts || []);
  const normalizedTransactions = normalizeTransactions(
    dataSources.transactions || [],
    normalizedCategories,
    normalizedAccounts,
  );

  const { start, end, categoryChildren } = normalizeFilters(filters, normalizedCategories);
  const days = computeDays(start, end);

  const categoryFilter = new Set(filters.categories || []);
  if (filters.includeSubcategories && categoryFilter.size > 0) {
    Array.from(categoryFilter).forEach((id) => {
      const children = categoryChildren.get(id);
      if (children) {
        children.forEach((childId) => categoryFilter.add(childId));
      }
    });
  }

  const accountFilter = new Set(filters.accounts || []);
  const searchValue = filters.search.trim().toLowerCase();

  const filteredTransactions = normalizedTransactions.filter((tx) => {
    if (!isWithinRange(tx.date, start, end)) return false;
    if (!filters.includeTransfers && tx.isTransfer) return false;
    if (!filters.includePending && tx.isPending) return false;
    if (accountFilter.size && tx.accountId && !accountFilter.has(tx.accountId)) return false;
    if (categoryFilter.size && tx.categoryId && !categoryFilter.has(tx.categoryId)) return false;
    if (categoryFilter.size && !tx.categoryId) return false;
    if (searchValue) {
      const haystack = [
        tx.notes,
        tx.accountName,
        tx.categoryName,
        tx.amount,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());
      if (!haystack.some((value) => value.includes(searchValue))) return false;
    }
    return true;
  });

  const totalIncome = filteredTransactions
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const totalExpense = filteredTransactions
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const net = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (totalIncome - totalExpense) / totalIncome : 0;
  const avgDailyExpense = days > 0 ? totalExpense / days : 0;

  const largestExpense = filteredTransactions
    .filter((tx) => tx.type === 'expense')
    .sort((a, b) => b.amount - a.amount)[0];

  const categoryMap = new Map<string, CategoryReportRow>();
  const parentNameMap = new Map(normalizedCategories.map((cat) => [cat.id, cat.parentId]));
  const categoryNameMap = new Map(normalizedCategories.map((cat) => [cat.id, cat.name]));
  const expenseTotal = totalExpense;

  filteredTransactions.forEach((tx) => {
    const categoryId = tx.categoryId ?? 'uncategorized';
    const categoryName = tx.categoryName || 'Tanpa kategori';
    const parentId = categoryId !== 'uncategorized' ? parentNameMap.get(categoryId) ?? null : null;
    const parentName = parentId ? categoryNameMap.get(parentId) ?? '' : '';
    const entry = categoryMap.get(categoryId) ?? {
      category_id: categoryId,
      category_name: categoryName,
      parent_category: parentName,
      total_income: 0,
      total_expense: 0,
      net: 0,
      transaction_count: 0,
      average_amount: 0,
      share_of_total_expense: 0,
    };
    if (tx.type === 'income') {
      entry.total_income += tx.amount;
      entry.net += tx.amount;
    } else if (tx.type === 'expense') {
      entry.total_expense += tx.amount;
      entry.net -= tx.amount;
    }
    entry.transaction_count += 1;
    entry.average_amount =
      entry.transaction_count > 0
        ? (entry.total_income + entry.total_expense) / entry.transaction_count
        : 0;
    categoryMap.set(categoryId, entry);
  });

  const categoryRows = Array.from(categoryMap.values()).map((row) => ({
    ...row,
    share_of_total_expense: expenseTotal > 0 ? row.total_expense / expenseTotal : 0,
  }));

  const topCategory = categoryRows.reduce(
    (acc, row) => (row.total_expense > acc.total_expense ? row : acc),
    {
      category_id: '',
      category_name: '',
      parent_category: '',
      total_income: 0,
      total_expense: 0,
      net: 0,
      transaction_count: 0,
      average_amount: 0,
      share_of_total_expense: 0,
    },
  );

  const dailyMap = new Map<string, { income: number; expense: number }>();
  filteredTransactions.forEach((tx) => {
    if (!tx.date) return;
    const entry = dailyMap.get(tx.date) ?? { income: 0, expense: 0 };
    if (tx.type === 'income') entry.income += tx.amount;
    if (tx.type === 'expense') entry.expense += tx.amount;
    dailyMap.set(tx.date, entry);
  });
  const dailyRows: DailyReportRow[] = [];
  if (start && end) {
    const totalDays = computeDays(start, end);
    for (let i = 0; i < totalDays; i += 1) {
      const current = new Date(`${start}T00:00:00Z`);
      current.setUTCDate(current.getUTCDate() + i);
      const dateKey = current.toISOString().slice(0, 10);
      const entry = dailyMap.get(dateKey) ?? { income: 0, expense: 0 };
      const netValue = entry.income - entry.expense;
      const previous = dailyRows[dailyRows.length - 1];
      const cumulative = (previous?.cumulative_net ?? 0) + netValue;
      dailyRows.push({
        date: dateKey,
        income: entry.income,
        expense: entry.expense,
        net: netValue,
        cumulative_net: cumulative,
      });
    }
  }

  const dailyNetValues = dailyRows.map((row) => row.net);
  const dailyMean =
    dailyNetValues.length > 0
      ? dailyNetValues.reduce((sum, value) => sum + value, 0) / dailyNetValues.length
      : 0;
  const dailyVariance =
    dailyNetValues.length > 0
      ? dailyNetValues.reduce((sum, value) => sum + Math.pow(value - dailyMean, 2), 0) /
        dailyNetValues.length
      : 0;
  const dailyStdDev = Math.sqrt(dailyVariance);

  const sortedTransactions = filteredTransactions
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  const transactionRows: TransactionReportRow[] = sortedTransactions.map((tx) => ({
    transaction_id: tx.id,
    date: tx.date,
    account_name: tx.accountName,
    category_name: tx.categoryName,
    notes: tx.notes,
    amount: tx.amount,
    type: tx.type,
    tags: tx.tags || undefined,
    created_at: tx.createdAt || undefined,
    updated_at: tx.updatedAt || undefined,
  }));

  return {
    summary: {
      period_start: start,
      period_end: end,
      total_income: totalIncome,
      total_expense: totalExpense,
      net,
      savings_rate: savingsRate,
      avg_daily_expense: avgDailyExpense,
      largest_expense_amount: largestExpense?.amount ?? 0,
      largest_expense_date: largestExpense?.date ?? '',
      top_category_name: topCategory?.category_name ?? '',
      top_category_amount: topCategory?.total_expense ?? 0,
      top_category_share: expenseTotal > 0 ? (topCategory?.total_expense ?? 0) / expenseTotal : 0,
      cashflow_volatility: dailyStdDev,
    },
    categories: categoryRows,
    daily: dailyRows,
    transactions: transactionRows,
    meta: {
      periodStart: start,
      periodEnd: end,
      days,
    },
  };
}

export async function exportZipCsv(): Promise<void> {
  throw new Error('JSZip tidak tersedia. Gunakan ekspor CSV tunggal.');
}

export function buildSingleCsv(reportData: ReportData): string {
  const sections: string[] = [];
  const stripBom = (value: string) => value.replace(/^\uFEFF/, '');
  const bom = '\uFEFF';

  sections.push(`${bom}# summary`);
  sections.push(
    stripBom(
      toCsv(
        [reportData.summary],
        [
          { key: 'period_start', header: 'period_start' },
          { key: 'period_end', header: 'period_end' },
          { key: 'total_income', header: 'total_income' },
          { key: 'total_expense', header: 'total_expense' },
          { key: 'net', header: 'net' },
          { key: 'savings_rate', header: 'savings_rate' },
          { key: 'avg_daily_expense', header: 'avg_daily_expense' },
          { key: 'largest_expense_amount', header: 'largest_expense_amount' },
          { key: 'largest_expense_date', header: 'largest_expense_date' },
          { key: 'top_category_name', header: 'top_category_name' },
          { key: 'top_category_amount', header: 'top_category_amount' },
          { key: 'top_category_share', header: 'top_category_share' },
        ],
      ),
    ),
  );

  sections.push('');
  sections.push('# categories');
  sections.push(
    stripBom(
      toCsv(reportData.categories, [
        { key: 'category_id', header: 'category_id' },
        { key: 'category_name', header: 'category_name' },
        { key: 'parent_category', header: 'parent_category' },
        { key: 'total_income', header: 'total_income' },
        { key: 'total_expense', header: 'total_expense' },
        { key: 'net', header: 'net' },
        { key: 'transaction_count', header: 'transaction_count' },
        { key: 'average_amount', header: 'average_amount' },
        { key: 'share_of_total_expense', header: 'share_of_total_expense' },
      ]),
    ),
  );

  sections.push('');
  sections.push('# daily');
  sections.push(
    stripBom(
      toCsv(reportData.daily, [
        { key: 'date', header: 'date' },
        { key: 'income', header: 'income' },
        { key: 'expense', header: 'expense' },
        { key: 'net', header: 'net' },
        { key: 'cumulative_net', header: 'cumulative_net' },
      ]),
    ),
  );

  const baseColumns: CsvColumn<TransactionReportRow>[] = [
    { key: 'transaction_id', header: 'transaction_id' },
    { key: 'date', header: 'date' },
    { key: 'account_name', header: 'account_name' },
    { key: 'category_name', header: 'category_name' },
    { key: 'notes', header: 'notes' },
    { key: 'amount', header: 'amount' },
    { key: 'type', header: 'type' },
  ];
  const optionalColumns: CsvColumn<TransactionReportRow>[] = [
    { key: 'tags', header: 'tags' },
    { key: 'created_at', header: 'created_at' },
    { key: 'updated_at', header: 'updated_at' },
  ];
  const hasOptional = (key: keyof TransactionReportRow) =>
    reportData.transactions.some((row) => Boolean(row[key]));
  const columns = [
    ...baseColumns,
    ...optionalColumns.filter((col) => hasOptional(col.key)),
  ];

  sections.push('');
  sections.push('# transactions');
  sections.push(stripBom(toCsv(reportData.transactions, columns)));

  return sections.join('\n');
}

export function buildCsvFiles(reportData: ReportData) {
  return {
    summary: toCsv(
      [reportData.summary],
      [
        { key: 'period_start', header: 'period_start' },
        { key: 'period_end', header: 'period_end' },
        { key: 'total_income', header: 'total_income' },
        { key: 'total_expense', header: 'total_expense' },
        { key: 'net', header: 'net' },
        { key: 'savings_rate', header: 'savings_rate' },
        { key: 'avg_daily_expense', header: 'avg_daily_expense' },
        { key: 'largest_expense_amount', header: 'largest_expense_amount' },
        { key: 'largest_expense_date', header: 'largest_expense_date' },
        { key: 'top_category_name', header: 'top_category_name' },
        { key: 'top_category_amount', header: 'top_category_amount' },
        { key: 'top_category_share', header: 'top_category_share' },
      ],
    ),
    categories: toCsv(reportData.categories, [
      { key: 'category_id', header: 'category_id' },
      { key: 'category_name', header: 'category_name' },
      { key: 'parent_category', header: 'parent_category' },
      { key: 'total_income', header: 'total_income' },
      { key: 'total_expense', header: 'total_expense' },
      { key: 'net', header: 'net' },
      { key: 'transaction_count', header: 'transaction_count' },
      { key: 'average_amount', header: 'average_amount' },
      { key: 'share_of_total_expense', header: 'share_of_total_expense' },
    ]),
    daily: toCsv(reportData.daily, [
      { key: 'date', header: 'date' },
      { key: 'income', header: 'income' },
      { key: 'expense', header: 'expense' },
      { key: 'net', header: 'net' },
      { key: 'cumulative_net', header: 'cumulative_net' },
    ]),
    transactions: (() => {
      const baseColumns: CsvColumn<TransactionReportRow>[] = [
        { key: 'transaction_id', header: 'transaction_id' },
        { key: 'date', header: 'date' },
        { key: 'account_name', header: 'account_name' },
        { key: 'category_name', header: 'category_name' },
        { key: 'notes', header: 'notes' },
        { key: 'amount', header: 'amount' },
        { key: 'type', header: 'type' },
      ];
      const optionalColumns: CsvColumn<TransactionReportRow>[] = [
        { key: 'tags', header: 'tags' },
        { key: 'created_at', header: 'created_at' },
        { key: 'updated_at', header: 'updated_at' },
      ];
      const hasOptional = (key: keyof TransactionReportRow) =>
        reportData.transactions.some((row) => Boolean(row[key]));
      const columns = [
        ...baseColumns,
        ...optionalColumns.filter((col) => hasOptional(col.key)),
      ];
      return toCsv(reportData.transactions, columns);
    })(),
  };
}
