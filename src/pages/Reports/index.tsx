import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import Page from '../../layout/Page';
import PageHeader from '../../layout/PageHeader';
import Card, { CardBody, CardHeader } from '../../components/Card';
import KpiCard from '../../components/KpiCard';
import Skeleton from '../../components/Skeleton';
import { useDataMode, useRepo } from '../../context/DataContext';
import { formatCurrency } from '../../lib/format';
import { downloadCsv, toCsv } from '../../lib/export/csv';

const CURRENT_MONTH = new Date().toISOString().slice(0, 7);

const MONTH_LABEL =
  typeof Intl !== 'undefined'
    ? new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' })
    : undefined;

type RawRecord = Record<string, any>;

type NormalizedTransaction = {
  id?: string | number;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  date: string;
  accountKey: string;
  accountName: string;
  categoryKey: string;
  categoryName: string;
  merchant: string;
  notes: string;
};

type ReportFilters = {
  period: 'month' | 'custom';
  month: string;
  from: string;
  to: string;
  account: string;
  category: string;
  search: string;
};

function toMonthLabel(month: string) {
  if (!month) return '';
  try {
    const [year, monthIndex] = month.split('-').map((value) => Number.parseInt(value, 10));
    if (!year || !monthIndex) return month;
    const date = new Date(year, monthIndex - 1, 1);
    return MONTH_LABEL ? MONTH_LABEL.format(date) : month;
  } catch {
    return month;
  }
}

function getMonthRange(month: string) {
  const [year, monthIndex] = month.split('-').map((value) => Number.parseInt(value, 10));
  if (!year || !monthIndex) {
    return { from: `${CURRENT_MONTH}-01`, to: `${CURRENT_MONTH}-01` };
  }
  const lastDay = new Date(year, monthIndex, 0).getDate();
  return {
    from: `${month}-${String(1).padStart(2, '0')}`,
    to: `${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

function normalizeDate(value: any) {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (typeof value === 'string') {
    if (value.length >= 10) return value.slice(0, 10);
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    return new Date().toISOString().slice(0, 10);
  }
  try {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  } catch {
    /* noop */
  }
  return new Date().toISOString().slice(0, 10);
}

function getKey(value: any) {
  if (value == null) return null;
  if (typeof value === 'object') {
    return value.id ?? value.uuid ?? null;
  }
  return value;
}

function getCategoryName(record: RawRecord, categoriesById: Map<string | number, string>) {
  const directName =
    record.category_name ||
    record.categoryName ||
    record.category_label ||
    record.category?.name ||
    record.category?.label;
  if (typeof directName === 'string' && directName.trim().length) {
    return directName;
  }
  const key = getKey(
    record.category_id ?? record.categoryId ?? record.category_uuid ?? record.category
  );
  if (key != null && categoriesById.has(key)) {
    return categoriesById.get(key) ?? 'Lainnya';
  }
  return 'Lainnya';
}

function getAccountName(record: RawRecord) {
  const directName =
    record.account_name ||
    record.accountName ||
    record.account_label ||
    record.account?.name ||
    record.account?.label;
  if (typeof directName === 'string' && directName.trim().length) {
    return directName;
  }
  return 'Tanpa akun';
}

function normaliseTransactions(
  transactions: RawRecord[] = [],
  categoriesById: Map<string | number, string>
): NormalizedTransaction[] {
  return transactions
    .map((tx) => {
      const rawDate =
        tx.date ||
        tx.transaction_date ||
        tx.created_at ||
        tx.posted_at ||
        tx.createdAt;
      const date = normalizeDate(rawDate);
      const typeValue = (tx.type || tx.transaction_type || '').toString();
      let type: NormalizedTransaction['type'];
      if (typeValue === 'income' || typeValue === 'expense' || typeValue === 'transfer') {
        type = typeValue;
      } else if (Number(tx.amount) < 0) {
        type = 'expense';
      } else {
        type = 'income';
      }
      const amount = Math.abs(Number(tx.amount) || 0);
      const categoryKey = getKey(
        tx.category_id ?? tx.categoryId ?? tx.category_uuid ?? tx.category
      );
      const accountKey = getKey(
        tx.account_id ?? tx.accountId ?? tx.account_uuid ?? tx.account
      );
      return {
        id: tx.id ?? tx.uuid ?? tx._id,
        amount,
        type,
        date,
        accountKey: accountKey != null ? String(accountKey) : 'none',
        accountName: getAccountName(tx),
        categoryKey: categoryKey != null ? String(categoryKey) : 'none',
        categoryName: getCategoryName(tx, categoriesById),
        merchant:
          tx.merchant?.name ||
          tx.merchant_name ||
          tx.merchantName ||
          tx.merchant ||
          '',
        notes: tx.notes || tx.note || tx.title || '',
      };
    })
    .filter((tx) => Boolean(tx));
}

function buildMonths(transactions: NormalizedTransaction[]) {
  const unique = new Set<string>();
  transactions.forEach((tx) => {
    if (tx.date) unique.add(tx.date.slice(0, 7));
  });
  const list = Array.from(unique).sort((a, b) => b.localeCompare(a));
  if (!list.length) {
    return [CURRENT_MONTH];
  }
  if (!list.includes(CURRENT_MONTH)) {
    list.unshift(CURRENT_MONTH);
  }
  return list;
}

function getFiltersFromParams(params: URLSearchParams): ReportFilters {
  const month = params.get('month') ?? CURRENT_MONTH;
  const period = params.get('period') === 'custom' ? 'custom' : 'month';
  const fallbackRange = getMonthRange(month);
  return {
    period,
    month,
    from: params.get('from') ?? fallbackRange.from,
    to: params.get('to') ?? fallbackRange.to,
    account: params.get('account') ?? 'all',
    category: params.get('category') ?? 'all',
    search: params.get('search') ?? '',
  };
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0%';
  return `${(value * 100).toFixed(1)}%`;
}

export default function ReportsPage() {
  const repo = useRepo();
  const { mode } = useDataMode();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filters = useMemo(() => getFiltersFromParams(searchParams), [searchParams]);

  const transactionsQuery = useQuery<RawRecord[]>({
    queryKey: ['reports', 'transactions', mode],
    queryFn: async () => {
      const rows = await repo.transactions.list();
      return Array.isArray(rows) ? rows : [];
    },
    staleTime: 5 * 60_000,
  });

  const categoriesQuery = useQuery<RawRecord[]>({
    queryKey: ['reports', 'categories', mode],
    queryFn: async () => {
      const rows = await repo.categories.list();
      return Array.isArray(rows) ? rows : [];
    },
    staleTime: 5 * 60_000,
  });

  const categoriesById = useMemo(() => {
    const map = new Map<string | number, string>();
    (categoriesQuery.data ?? []).forEach((cat: RawRecord) => {
      const key = getKey(cat.id ?? cat.uuid ?? cat.category_id ?? cat.key);
      if (key != null) {
        map.set(key, cat.name || cat.label || cat.title || 'Tanpa nama');
      }
    });
    return map;
  }, [categoriesQuery.data]);

  const normalizedTransactions = useMemo(
    () => normaliseTransactions(transactionsQuery.data ?? [], categoriesById),
    [transactionsQuery.data, categoriesById]
  );

  const availableMonths = useMemo(
    () => buildMonths(normalizedTransactions),
    [normalizedTransactions]
  );

  useEffect(() => {
    if (!availableMonths.includes(filters.month)) {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        params.set('month', availableMonths[0] || CURRENT_MONTH);
        return params;
      });
    }
  }, [availableMonths, filters.month, setSearchParams]);

  const accountOptions = useMemo(() => {
    const map = new Map<string, string>();
    normalizedTransactions.forEach((tx) => {
      if (!tx.accountKey || !tx.accountName) return;
      if (!map.has(tx.accountKey)) {
        map.set(tx.accountKey, tx.accountName || 'Tanpa akun');
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [normalizedTransactions]);

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    (categoriesQuery.data ?? []).forEach((cat) => {
      const key = getKey(cat.id ?? cat.uuid ?? cat.category_id ?? cat.key);
      if (key != null) {
        map.set(String(key), cat.name || cat.label || cat.title || 'Tanpa nama');
      }
    });
    normalizedTransactions.forEach((tx) => {
      if (!map.has(tx.categoryKey)) {
        map.set(tx.categoryKey, tx.categoryName || 'Lainnya');
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [categoriesQuery.data, normalizedTransactions]);

  const updateFilters = useCallback(
    (patch: Partial<ReportFilters>) => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        const current = getFiltersFromParams(params);
        const next = { ...current, ...patch };
        params.set('month', next.month);
        if (next.period === 'custom') {
          params.set('period', 'custom');
          params.set('from', next.from);
          params.set('to', next.to);
        } else {
          params.delete('period');
          params.delete('from');
          params.delete('to');
        }
        if (next.account && next.account !== 'all') {
          params.set('account', next.account);
        } else {
          params.delete('account');
        }
        if (next.category && next.category !== 'all') {
          params.set('category', next.category);
        } else {
          params.delete('category');
        }
        if (next.search) {
          params.set('search', next.search);
        } else {
          params.delete('search');
        }
        return params;
      });
    },
    [setSearchParams]
  );

  const effectiveRange = useMemo(() => {
    if (filters.period === 'custom') {
      return {
        from: filters.from,
        to: filters.to,
      };
    }
    return getMonthRange(filters.month);
  }, [filters]);

  const filteredTransactions = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return normalizedTransactions.filter((tx) => {
      if (tx.date < effectiveRange.from || tx.date > effectiveRange.to) return false;
      if (filters.account !== 'all' && tx.accountKey !== filters.account) return false;
      if (filters.category !== 'all' && tx.categoryKey !== filters.category) return false;
      if (query) {
        const haystack = `${tx.merchant} ${tx.notes}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [normalizedTransactions, filters, effectiveRange]);

  const sortedTransactions = useMemo(
    () => [...filteredTransactions].sort((a, b) => b.date.localeCompare(a.date)),
    [filteredTransactions]
  );

  useEffect(() => {
    setPage(1);
  }, [filters, pageSize]);

  const totalPages = Math.max(1, Math.ceil(sortedTransactions.length / pageSize));
  const startIndex = (page - 1) * pageSize;
  const pagedTransactions = sortedTransactions.slice(startIndex, startIndex + pageSize);

  const incomeTotal = useMemo(
    () =>
      filteredTransactions
        .filter((tx) => tx.type === 'income')
        .reduce((sum, tx) => sum + tx.amount, 0),
    [filteredTransactions]
  );

  const expenseTotal = useMemo(
    () =>
      filteredTransactions
        .filter((tx) => tx.type === 'expense')
        .reduce((sum, tx) => sum + tx.amount, 0),
    [filteredTransactions]
  );

  const netTotal = incomeTotal - expenseTotal;
  const savingsRate = incomeTotal > 0 ? netTotal / incomeTotal : 0;

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    filteredTransactions.forEach((tx) => {
      if (tx.type !== 'expense') return;
      map.set(tx.categoryName, (map.get(tx.categoryName) || 0) + tx.amount);
    });
    const sorted = Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
    const top = sorted.slice(0, 10);
    const remaining = sorted.slice(10);
    const othersTotal = remaining.reduce((sum, item) => sum + item.amount, 0);
    if (othersTotal > 0) {
      top.push({ category: 'Others', amount: othersTotal });
    }
    return top;
  }, [filteredTransactions]);

  const topCategory = categoryBreakdown[0];

  const breakdownRows = useMemo(() => {
    return categoryBreakdown.map((item) => ({
      ...item,
      share: expenseTotal > 0 ? (item.amount / expenseTotal) * 100 : 0,
    }));
  }, [categoryBreakdown, expenseTotal]);

  const handleExportCsv = useCallback(() => {
    const metaLines = [
      `# Period: ${effectiveRange.from} to ${effectiveRange.to}`,
      `# Account: ${
        filters.account === 'all'
          ? 'All'
          : accountOptions.find((item) => item.id === filters.account)?.name || 'Unknown'
      }`,
      `# Category: ${
        filters.category === 'all'
          ? 'All'
          : categoryOptions.find((item) => item.id === filters.category)?.name || 'Unknown'
      }`,
      `# Search: ${filters.search || '-'}`,
    ];

    const txCsv = toCsv(sortedTransactions, [
      { key: 'date', header: 'date' },
      { key: 'accountName', header: 'account' },
      { key: 'categoryName', header: 'category' },
      { key: 'merchant', header: 'merchant' },
      { key: 'notes', header: 'notes' },
      { key: 'amount', header: 'amount' },
      { key: 'type', header: 'type' },
    ]);

    const breakdownCsv = toCsv(breakdownRows, [
      { key: 'category', header: 'category' },
      { key: 'amount', header: 'amount' },
      {
        key: 'share',
        header: 'share_percent',
        value: (row) => row.share.toFixed(2),
      },
    ]);

    const csvContent = [metaLines.join('\n'), '', txCsv, '', breakdownCsv].join('\n');
    const csvWithBom = `\uFEFF${csvContent}`;
    const filename = `hematwoi_report_${effectiveRange.from}_to_${effectiveRange.to}.csv`;
    downloadCsv(filename, csvWithBom);
  }, [effectiveRange, filters, accountOptions, categoryOptions, sortedTransactions, breakdownRows]);

  const handleReset = useCallback(() => {
    updateFilters({
      period: 'month',
      month: CURRENT_MONTH,
      from: getMonthRange(CURRENT_MONTH).from,
      to: getMonthRange(CURRENT_MONTH).to,
      account: 'all',
      category: 'all',
      search: '',
    });
  }, [updateFilters]);

  const isLoading = transactionsQuery.isLoading || categoriesQuery.isLoading;
  const isError = transactionsQuery.isError || categoriesQuery.isError;
  const errorMessage =
    (transactionsQuery.error as Error | undefined)?.message ||
    (categoriesQuery.error as Error | undefined)?.message ||
    'Gagal memuat data laporan.';

  return (
    <Page>
      <PageHeader
        title="Reports"
        description="Analisa transaksi dengan filter fleksibel, ringkasan KPI, dan export CSV siap pakai."
      >
        <button type="button" className="btn" onClick={handleExportCsv}>
          Export CSV
        </button>
      </PageHeader>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Filter" subtext="Atur periode dan segmentasi laporan." />
          <CardBody>
            <div className="grid gap-4 lg:grid-cols-4">
              <label className="space-y-1 text-sm text-muted">
                <span className="text-xs font-semibold uppercase tracking-wide">Periode</span>
                <select
                  className="input"
                  value={filters.period}
                  onChange={(event) => {
                    const nextPeriod = event.target.value === 'custom' ? 'custom' : 'month';
                    if (nextPeriod === 'custom') {
                      const range = getMonthRange(filters.month);
                      updateFilters({
                        period: 'custom',
                        from: filters.from || range.from,
                        to: filters.to || range.to,
                      });
                    } else {
                      updateFilters({ period: 'month' });
                    }
                  }}
                >
                  <option value="month">Bulan</option>
                  <option value="custom">Custom range</option>
                </select>
              </label>

              <label className="space-y-1 text-sm text-muted">
                <span className="text-xs font-semibold uppercase tracking-wide">Bulan</span>
                <select
                  className="input"
                  value={filters.month}
                  onChange={(event) => {
                    const nextMonth = event.target.value || CURRENT_MONTH;
                    if (filters.period === 'custom') {
                      const range = getMonthRange(nextMonth);
                      updateFilters({
                        month: nextMonth,
                        from: filters.from || range.from,
                        to: filters.to || range.to,
                      });
                    } else {
                      updateFilters({ month: nextMonth });
                    }
                  }}
                >
                  {availableMonths.map((month) => (
                    <option key={month} value={month}>
                      {toMonthLabel(month)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm text-muted">
                <span className="text-xs font-semibold uppercase tracking-wide">Dari</span>
                <input
                  type="date"
                  className="input"
                  value={filters.from}
                  onChange={(event) => updateFilters({ from: event.target.value })}
                  disabled={filters.period !== 'custom'}
                />
              </label>

              <label className="space-y-1 text-sm text-muted">
                <span className="text-xs font-semibold uppercase tracking-wide">Sampai</span>
                <input
                  type="date"
                  className="input"
                  value={filters.to}
                  onChange={(event) => updateFilters({ to: event.target.value })}
                  disabled={filters.period !== 'custom'}
                />
              </label>

              <label className="space-y-1 text-sm text-muted">
                <span className="text-xs font-semibold uppercase tracking-wide">Akun</span>
                <select
                  className="input"
                  value={filters.account}
                  onChange={(event) => updateFilters({ account: event.target.value })}
                >
                  <option value="all">Semua akun</option>
                  {accountOptions.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm text-muted">
                <span className="text-xs font-semibold uppercase tracking-wide">Kategori</span>
                <select
                  className="input"
                  value={filters.category}
                  onChange={(event) => updateFilters({ category: event.target.value })}
                >
                  <option value="all">Semua kategori</option>
                  {categoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm text-muted lg:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide">
                  Search (merchant / notes)
                </span>
                <input
                  type="search"
                  className="input"
                  value={filters.search}
                  onChange={(event) => updateFilters({ search: event.target.value })}
                  placeholder="Cari merchant atau catatan..."
                />
              </label>

              <div className="flex items-end">
                <button type="button" className="btn btn-secondary" onClick={handleReset}>
                  Reset filter
                </button>
              </div>
            </div>
          </CardBody>
        </Card>

        {isError ? (
          <div
            role="alert"
            className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            {errorMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-48 md:col-span-2" />
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <KpiCard label="Total Income" value={formatCurrency(incomeTotal)} variant="income" />
              <KpiCard label="Total Expense" value={formatCurrency(expenseTotal)} variant="expense" />
              <KpiCard
                label="Net"
                value={formatCurrency(netTotal)}
                variant={netTotal >= 0 ? 'success' : 'danger'}
              />
              <KpiCard label="Savings Rate" value={formatPercent(savingsRate)} variant="brand" />
              <KpiCard
                label="Top Category"
                value={
                  topCategory
                    ? `${topCategory.category} • ${formatCurrency(topCategory.amount)}`
                    : '—'
                }
                variant="brand"
              />
            </section>

            <Card>
              <CardHeader
                title="Detail Transaksi"
                subtext={`Periode ${effectiveRange.from} sampai ${effectiveRange.to}`}
                actions={
                  <div className="text-xs text-muted">
                    {sortedTransactions.length} transaksi
                  </div>
                }
              />
              <CardBody>
                {sortedTransactions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border-subtle p-6 text-center text-sm text-muted">
                    Tidak ada transaksi yang cocok dengan filter ini.
                  </div>
                ) : (
                  <div className="table-wrap overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-surface-1 sticky top-0">
                        <tr className="text-left">
                          <th className="p-2">Tanggal</th>
                          <th className="p-2">Akun</th>
                          <th className="p-2">Kategori</th>
                          <th className="p-2">Merchant</th>
                          <th className="p-2">Catatan</th>
                          <th className="p-2 text-right">Jumlah</th>
                          <th className="p-2">Tipe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedTransactions.map((tx) => (
                          <tr key={tx.id ?? `${tx.date}-${tx.notes}`} className="even:bg-surface-1/40">
                            <td className="p-2 whitespace-nowrap">{tx.date}</td>
                            <td className="p-2">{tx.accountName || '—'}</td>
                            <td className="p-2">{tx.categoryName || '—'}</td>
                            <td className="p-2">{tx.merchant || '—'}</td>
                            <td className="p-2">{tx.notes || '—'}</td>
                            <td
                              className={`p-2 text-right font-semibold ${
                                tx.type === 'income'
                                  ? 'text-success'
                                  : tx.type === 'expense'
                                    ? 'text-danger'
                                    : 'text-text'
                              }`}
                            >
                              {formatCurrency(tx.amount)}
                            </td>
                            <td className="p-2 capitalize">{tx.type}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                      <div>
                        Menampilkan {startIndex + 1}-{Math.min(startIndex + pageSize, sortedTransactions.length)} dari{' '}
                        {sortedTransactions.length}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          className="rounded-md border px-2 py-1"
                          value={pageSize}
                          onChange={(event) => setPageSize(Number(event.target.value))}
                        >
                          {[25, 50, 100].map((size) => (
                            <option key={size} value={size}>
                              {size}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                          disabled={page === 1}
                        >
                          Sebelumnya
                        </button>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                          disabled={page === totalPages}
                        >
                          Berikutnya
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Expense by Category" subtext="Top 10 kategori + Others" />
              <CardBody>
                {breakdownRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border-subtle p-6 text-center text-sm text-muted">
                    Belum ada pengeluaran pada periode ini.
                  </div>
                ) : (
                  <div className="table-wrap overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-surface-1">
                        <tr className="text-left">
                          <th className="p-2">Kategori</th>
                          <th className="p-2 text-right">Amount</th>
                          <th className="p-2 text-right">Share %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {breakdownRows.map((row) => (
                          <tr key={row.category} className="even:bg-surface-1/40">
                            <td className="p-2">{row.category}</td>
                            <td className="p-2 text-right">{formatCurrency(row.amount)}</td>
                            <td className="p-2 text-right">{row.share.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </Page>
  );
}
