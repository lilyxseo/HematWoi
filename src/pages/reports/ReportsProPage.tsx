import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Calendar,
  ChevronDown,
  Download,
  Loader2,
  Search,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Page from '../../layout/Page';
import PageHeader from '../../layout/PageHeader';
import Card, { CardBody, CardHeader } from '../../components/Card';
import ChartCard from '../../components/dashboard/ChartCard';
import CategoryDot from '../../components/transactions/CategoryDot';
import HeatmapCalendar from '../../components/HeatmapCalendar';
import { useRepo } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { listAccounts } from '../../lib/api';
import {
  buildCsvFiles,
  buildReportData,
  buildSingleCsv,
  exportZipCsv,
  type ReportFilters,
} from '../../lib/export/reportCsv';

const DEFAULT_TAB = 'categories';

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function currentMonthValue() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

const DEFAULT_FILTERS: ReportFilters = {
  period: {
    preset: 'month',
    month: currentMonthValue(),
    start: '',
    end: '',
  },
  accounts: [],
  categories: [],
  includeSubcategories: false,
  includeTransfers: false,
  includePending: true,
  search: '',
};

function parseSearchParams(params: URLSearchParams) {
  const allowedTabs = new Set([
    'categories',
    'merchants',
    'daily',
    'transactions',
  ]);
  const preset = params.get('range') === 'custom' ? 'custom' : 'month';
  const month = params.get('month') || currentMonthValue();
  const start = params.get('start') || new Date().toISOString().slice(0, 10);
  const end = params.get('end') || new Date().toISOString().slice(0, 10);
  const accounts = params.get('accounts')
    ? params
        .get('accounts')!
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    : [];
  const categories = params.get('categories')
    ? params
        .get('categories')!
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    : [];
  const includeTransfers = params.get('transfers') === '1';
  const includePending = params.get('pending') !== '0';
  const includeSubcategories = params.get('sub') === '1';
  const search = params.get('search') || '';
  const rawTab = params.get('tab') || DEFAULT_TAB;
  const tab = allowedTabs.has(rawTab) ? rawTab : DEFAULT_TAB;
  return {
    filter: {
      period: {
        preset,
        month,
        start,
        end,
      },
      accounts,
      categories,
      includeSubcategories,
      includeTransfers,
      includePending,
      search,
    } satisfies ReportFilters,
    tab,
  };
}

function serializeFilter(
  params: URLSearchParams,
  filter: ReportFilters,
  tab: string,
) {
  const next = new URLSearchParams(params);
  const apply = (key: string, value: string, defaultValue = '') => {
    if (!value || value === defaultValue) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  };

  apply('range', filter.period.preset, DEFAULT_FILTERS.period.preset);
  if (filter.period.preset === 'month') {
    apply('month', filter.period.month, DEFAULT_FILTERS.period.month);
    next.delete('start');
    next.delete('end');
  } else {
    apply('start', filter.period.start, '');
    apply('end', filter.period.end, '');
    next.delete('month');
  }

  if (filter.accounts.length) {
    next.set('accounts', filter.accounts.join(','));
  } else {
    next.delete('accounts');
  }

  if (filter.categories.length) {
    next.set('categories', filter.categories.join(','));
  } else {
    next.delete('categories');
  }

  apply('transfers', filter.includeTransfers ? '1' : '', '');
  apply('pending', filter.includePending ? '' : '0', '');
  apply('sub', filter.includeSubcategories ? '1' : '', '');
  apply('search', filter.search.trim(), '');
  apply('tab', tab, DEFAULT_TAB);

  return next;
}

function toInputDate(value?: string) {
  if (!value) return '';
  return value.slice(0, 10);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0%';
  return `${(value * 100).toFixed(1)}%`;
}

function downloadBlob(content: Blob, filename: string) {
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

type MultiSelectOption = {
  id: string;
  label: string;
  meta?: string;
  color?: string | null;
};

function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
  title,
  showSearch = false,
  renderPrefix,
}: {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  title: string;
  showSearch?: boolean;
  renderPrefix?: (option: MultiSelectOption) => JSX.Element | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!panelRef.current || !triggerRef.current) return;
      if (panelRef.current.contains(event.target as Node)) return;
      if (triggerRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const filteredOptions = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(term) ||
      option.meta?.toLowerCase().includes(term),
    );
  }, [options, query]);

  const summaryLabel = useMemo(() => {
    if (!selected.length) return placeholder;
    if (selected.length === 1) {
      const match = options.find((opt) => opt.id === selected[0]);
      return match?.label || placeholder;
    }
    return `${selected.length} dipilih`;
  }, [options, placeholder, selected]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange(Array.from(next));
  };

  return (
    <div className="relative w-full">
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-11 w-full items-center justify-between rounded-2xl bg-slate-900/60 px-4 text-sm font-medium text-slate-200 ring-2 ring-slate-800 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{summaryLabel}</span>
        <ChevronDown className="ml-3 h-4 w-4 text-slate-500" aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={panelRef}
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-30 mt-3 w-full overflow-hidden rounded-3xl bg-slate-900/95 text-slate-200 shadow-2xl ring-1 ring-slate-800 backdrop-blur"
        >
          <div className="flex items-center justify-between px-4 pb-3 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
            <button
              type="button"
              onClick={() => onChange([])}
              className="rounded-full px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              Reset
            </button>
          </div>
          {showSearch && (
            <div className="px-4 pb-3">
              <div className="flex items-center gap-2 rounded-2xl bg-slate-800/80 px-3">
                <Search className="h-4 w-4 flex-shrink-0 text-slate-500" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={`Cari ${title.toLowerCase()}`}
                  className="h-9 w-full bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
                />
              </div>
            </div>
          )}
          <div className="max-h-[240px] overflow-y-auto px-2 pb-4">
            {filteredOptions.length === 0 && (
              <p className="px-4 py-3 text-sm text-slate-400">Tidak ada data</p>
            )}
            {filteredOptions.map((option) => {
              const checked = selected.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggle(option.id)}
                  className={clsx(
                    'flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm transition',
                    checked
                      ? 'bg-[var(--accent)]/15 text-slate-50'
                      : 'text-slate-300 hover:bg-slate-800/80',
                  )}
                  role="option"
                  aria-selected={checked}
                >
                  <span className="flex items-center gap-3">
                    {renderPrefix ? renderPrefix(option) : null}
                    <span className="font-medium">{option.label}</span>
                  </span>
                  {checked && <span className="text-xs uppercase text-[var(--accent)]">Dipilih</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ReportTabs({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const tabs = [
    { id: 'categories', label: 'Category Breakdown' },
    { id: 'merchants', label: 'Merchant Breakdown' },
    { id: 'daily', label: 'Daily / Weekly Trends' },
    { id: 'transactions', label: 'Transactions (Report View)' },
  ];
  return (
    <div
      className="flex w-full flex-nowrap gap-2 overflow-x-auto pb-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700/70"
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={clsx(
            'whitespace-nowrap rounded-2xl px-4 py-2 text-sm font-semibold transition',
            value === tab.id
              ? 'bg-[var(--accent)] text-white shadow'
              : 'bg-slate-900/60 text-slate-300 hover:bg-slate-900',
          )}
          role="tab"
          aria-selected={value === tab.id}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-white/95 px-3 py-2 text-xs text-text shadow-lg dark:bg-slate-900/90">
      <div className="font-medium text-text">{label}</div>
      {payload.map((item: any) => (
        <div key={item.dataKey} className="text-slate-600 dark:text-slate-200">
          {item.name}: {currencyFormatter.format(item.value ?? 0)}
        </div>
      ))}
    </div>
  );
}

export default function ReportsProPage() {
  const repo = useRepo();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { filter, tab } = useMemo(() => parseSearchParams(searchParams), [searchParams]);
  const [activeTab, setActiveTab] = useState(tab);
  const scrollRestoreRef = useRef<number | null>(null);
  const [exportMode, setExportMode] = useState<'zip' | 'single'>('zip');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [merchantSort, setMerchantSort] = useState<'total' | 'count' | 'last'>('total');
  const [merchantPage, setMerchantPage] = useState(1);
  const [transactionPage, setTransactionPage] = useState(1);
  const [focusedCategory, setFocusedCategory] = useState<string | null>(null);

  const transactionsQuery = useQuery({
    queryKey: ['reports-pro', 'transactions'],
    queryFn: () => repo.transactions.list(),
  });
  const categoriesQuery = useQuery({
    queryKey: ['reports-pro', 'categories'],
    queryFn: () => repo.categories.list(),
  });
  const accountsQuery = useQuery({
    queryKey: ['reports-pro', 'accounts'],
    queryFn: () => listAccounts(),
  });

  const reportData = useMemo(
    () =>
      buildReportData(filter, {
        transactions: transactionsQuery.data || [],
        categories: categoriesQuery.data || [],
        accounts: accountsQuery.data || [],
      }),
    [accountsQuery.data, categoriesQuery.data, filter, transactionsQuery.data],
  );

  useEffect(() => {
    setActiveTab(tab);
  }, [tab]);

  useEffect(() => {
    if (tab !== activeTab) {
      const params = serializeFilter(searchParams, filter, activeTab);
      setSearchParams(params, { replace: true });
    }
  }, [activeTab, filter, searchParams, setSearchParams, tab]);

  useEffect(() => {
    if (scrollRestoreRef.current == null) return;
    const top = scrollRestoreRef.current;
    scrollRestoreRef.current = null;
    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top, behavior: 'auto' });
    });
  }, [searchParams]);

  useEffect(() => {
    setMerchantPage(1);
    setTransactionPage(1);
  }, [filter, reportData.transactions.length]);

  const handleFilterChange = useCallback(
    (patch: Partial<ReportFilters>) => {
      const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;
      scrollRestoreRef.current = scrollY;
      const next = {
        ...filter,
        ...patch,
        period: {
          ...filter.period,
          ...(patch.period || {}),
        },
      };
      const params = serializeFilter(searchParams, next, activeTab);
      setSearchParams(params, { replace: true });
    },
    [activeTab, filter, searchParams, setSearchParams],
  );

  const handleTabChange = (next: string) => {
    setActiveTab(next);
  };

  const categoriesOptions = useMemo(() => {
    return (categoriesQuery.data || [])
      .map((cat: any) => ({
        id: String(cat.id ?? cat.uuid ?? cat.category_id ?? cat.key),
        label: String(cat.name ?? cat.label ?? cat.title ?? 'Tanpa nama'),
        meta: String(cat.type ?? ''),
        color: cat.color ?? null,
        parentId: cat.parent_id ?? cat.parentId ?? cat.parent?.id ?? null,
      }))
      .filter((cat) => Boolean(cat.id));
  }, [categoriesQuery.data]);

  const hasSubcategories = useMemo(
    () => categoriesOptions.some((cat) => Boolean(cat.parentId)),
    [categoriesOptions],
  );

  const accountOptions = useMemo(() => {
    return (accountsQuery.data || [])
      .map((acc: any) => ({
        id: String(acc.id ?? acc.uuid ?? acc.account_id ?? acc.key),
        label: String(acc.name ?? acc.title ?? acc.label ?? 'Tanpa nama'),
        meta: String(acc.type ?? ''),
      }))
      .filter((acc) => Boolean(acc.id));
  }, [accountsQuery.data]);

  const exportPreview = useMemo(
    () => ({
      transactions: reportData.transactions.length,
      categories: reportData.categories.length,
      merchants: reportData.merchants.length,
      daily: reportData.daily.length,
    }),
    [reportData],
  );

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    const filenameBase = `hematwoi_report_${reportData.meta.periodStart}_to_${reportData.meta.periodEnd}`;
    try {
      if (exportMode === 'zip') {
        await exportZipCsv();
      } else {
        const csv = buildSingleCsv(reportData);
        downloadBlob(
          new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
          `${filenameBase}.csv`,
        );
      }
      addToast('Export report berhasil', 'success');
    } catch (error) {
      if (exportMode === 'zip') {
        const csv = buildSingleCsv(reportData);
        downloadBlob(
          new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
          `${filenameBase}.csv`,
        );
        addToast('ZIP export tidak tersedia, fallback ke CSV tunggal.', 'info');
      } else {
        addToast('Gagal mengekspor report', 'error');
      }
    } finally {
      setExporting(false);
      setExportMenuOpen(false);
    }
  };

  const handleExportTransactions = () => {
    const filenameBase = `hematwoi_report_transactions_${reportData.meta.periodStart}_to_${reportData.meta.periodEnd}`;
    const csvFiles = buildCsvFiles(reportData);
    downloadBlob(
      new Blob([csvFiles.transactions], { type: 'text/csv;charset=utf-8;' }),
      `${filenameBase}.csv`,
    );
    addToast('Export transaksi report siap.', 'success');
  };

  const kpiCards = [
    {
      label: 'Income',
      value: currencyFormatter.format(reportData.summary.total_income),
      tone: 'text-emerald-400',
    },
    {
      label: 'Expense',
      value: currencyFormatter.format(reportData.summary.total_expense),
      tone: 'text-rose-400',
    },
    {
      label: 'Net',
      value: currencyFormatter.format(reportData.summary.net),
      tone: reportData.summary.net >= 0 ? 'text-emerald-400' : 'text-rose-400',
    },
    {
      label: 'Savings Rate',
      value: formatPercent(reportData.summary.savings_rate),
      tone: 'text-slate-100',
    },
    {
      label: 'Avg Daily Expense',
      value: currencyFormatter.format(reportData.summary.avg_daily_expense),
      tone: 'text-slate-100',
    },
    {
      label: 'Largest Expense',
      value: currencyFormatter.format(reportData.summary.largest_expense_amount),
      helper: `${reportData.summary.largest_expense_date || '-'} • ${
        reportData.summary.largest_expense_merchant || 'Tanpa merchant'
      }`,
      tone: 'text-slate-100',
    },
    {
      label: 'Top Category Share',
      value: `${reportData.summary.top_category_name || '-'} (${formatPercent(
        reportData.summary.top_category_share,
      )})`,
      tone: 'text-slate-100',
    },
    {
      label: 'Cashflow Volatility',
      value: currencyFormatter.format(reportData.summary.cashflow_volatility),
      tone: 'text-slate-100',
    },
  ];

  const merchantRows = useMemo(() => {
    const base = [...reportData.merchants];
    if (merchantSort === 'count') {
      base.sort((a, b) => b.transaction_count - a.transaction_count);
    } else if (merchantSort === 'last') {
      base.sort((a, b) => b.last_transaction_date.localeCompare(a.last_transaction_date));
    } else {
      base.sort((a, b) => b.total_expense - a.total_expense);
    }
    return base;
  }, [merchantSort, reportData.merchants]);

  const merchantPageSize = 10;
  const merchantPages = Math.max(1, Math.ceil(merchantRows.length / merchantPageSize));
  const pagedMerchants = merchantRows.slice(
    (merchantPage - 1) * merchantPageSize,
    merchantPage * merchantPageSize,
  );

  const transactionPageSize = 25;
  const transactionPages = Math.max(
    1,
    Math.ceil(reportData.transactions.length / transactionPageSize),
  );
  const pagedTransactions = reportData.transactions.slice(
    (transactionPage - 1) * transactionPageSize,
    transactionPage * transactionPageSize,
  );

  const categoryDetails = useMemo(() => {
    if (!focusedCategory) return null;
    const rows = reportData.transactions.filter(
      (tx) => tx.category_name === focusedCategory,
    );
    const topTransactions = rows
      .slice()
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
    return { rows, topTransactions };
  }, [focusedCategory, reportData.transactions]);

  const heatmapMonth = useMemo(() => {
    if (filter.period.preset === 'month') return filter.period.month;
    if (filter.period.start && filter.period.end) {
      const startMonth = filter.period.start.slice(0, 7);
      const endMonth = filter.period.end.slice(0, 7);
      if (startMonth === endMonth) return startMonth;
    }
    return '';
  }, [filter.period]);

  const loading =
    transactionsQuery.isLoading || categoriesQuery.isLoading || accountsQuery.isLoading;
  const error =
    transactionsQuery.error || categoriesQuery.error || accountsQuery.error;

  return (
    <Page>
      <PageHeader title="Reports Pro" description="Analisis detail cashflow dan breakdown laporan." />

      <section className="space-y-6">
        <Card className="space-y-5">
          <CardHeader
            title="Filter"
            subtext="Semua filter tersimpan di URL untuk dibagikan."
            actions={
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setExportMenuOpen((prev) => !prev)}
                    className="inline-flex h-11 w-full items-center justify-between gap-2 rounded-2xl bg-slate-900/60 px-4 text-sm font-semibold text-slate-200 ring-2 ring-slate-800 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:w-auto"
                    aria-haspopup="menu"
                    aria-expanded={exportMenuOpen}
                  >
                    <span className="flex items-center gap-2">
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                      {exportMode === 'zip'
                        ? 'Export (ZIP of CSVs)'
                        : 'Export Single CSV'}
                    </span>
                  </button>
                  {exportMenuOpen && (
                    <div className="absolute right-0 z-30 mt-2 w-full rounded-2xl bg-slate-950/95 p-2 text-sm text-slate-200 shadow-2xl ring-1 ring-slate-800 sm:w-64">
                      <button
                        type="button"
                        onClick={() => setExportMode('zip')}
                        className={clsx(
                          'flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition',
                          exportMode === 'zip'
                            ? 'bg-[var(--accent)]/15 text-white'
                            : 'hover:bg-slate-900/80',
                        )}
                      >
                        Export (ZIP of CSVs)
                        <span className="text-xs text-slate-400">butuh JSZip</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setExportMode('single')}
                        className={clsx(
                          'mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition',
                          exportMode === 'single'
                            ? 'bg-[var(--accent)]/15 text-white'
                            : 'hover:bg-slate-900/80',
                        )}
                      >
                        Export Single CSV (sections)
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={exporting || loading}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 text-sm font-semibold text-white shadow-lg shadow-[var(--accent)]/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Export CSV
                </button>
              </div>
            }
          />
          <CardBody>
            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
              <div className="space-y-2 rounded-2xl bg-slate-900/60 p-4 ring-1 ring-slate-800">
                <label className="text-xs font-semibold uppercase text-slate-400">
                  Periode
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      handleFilterChange({
                        period: { preset: 'month', month: filter.period.month, start: '', end: '' },
                      })
                    }
                    className={clsx(
                      'inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition',
                      filter.period.preset === 'month'
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-slate-950/60 text-slate-300 hover:bg-slate-900/80',
                    )}
                  >
                    <Calendar className="h-4 w-4" />
                    Month
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleFilterChange({
                        period: {
                          preset: 'custom',
                          month: '',
                          start: filter.period.start || new Date().toISOString().slice(0, 10),
                          end: filter.period.end || new Date().toISOString().slice(0, 10),
                        },
                      })
                    }
                    className={clsx(
                      'inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition',
                      filter.period.preset === 'custom'
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-slate-950/60 text-slate-300 hover:bg-slate-900/80',
                    )}
                  >
                    Custom Range
                  </button>
                </div>
                {filter.period.preset === 'month' ? (
                  <input
                    type="month"
                    value={filter.period.month}
                    onChange={(event) =>
                      handleFilterChange({
                        period: {
                          preset: 'month',
                          month: event.target.value,
                          start: '',
                          end: '',
                        },
                      })
                    }
                    className="h-11 w-full rounded-2xl bg-slate-950/60 px-4 text-sm text-slate-200 ring-1 ring-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="date"
                      value={toInputDate(filter.period.start)}
                      onChange={(event) =>
                        handleFilterChange({
                          period: {
                            preset: 'custom',
                            month: '',
                            start: event.target.value,
                            end: filter.period.end,
                          },
                        })
                      }
                      className="h-11 flex-1 rounded-2xl bg-slate-950/60 px-4 text-sm text-slate-200 ring-1 ring-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                    <input
                      type="date"
                      value={toInputDate(filter.period.end)}
                      onChange={(event) =>
                        handleFilterChange({
                          period: {
                            preset: 'custom',
                            month: '',
                            start: filter.period.start,
                            end: event.target.value,
                          },
                        })
                      }
                      className="h-11 flex-1 rounded-2xl bg-slate-950/60 px-4 text-sm text-slate-200 ring-1 ring-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                  </div>
                )}
              </div>
              <div className="space-y-4 rounded-2xl bg-slate-900/60 p-4 ring-1 ring-slate-800">
                <label className="text-xs font-semibold uppercase text-slate-400">
                  Akun
                </label>
                <MultiSelect
                  options={accountOptions}
                  selected={filter.accounts}
                  onChange={(next) => handleFilterChange({ accounts: next })}
                  placeholder="Semua akun"
                  title="Akun"
                  showSearch
                />
                <label className="text-xs font-semibold uppercase text-slate-400">
                  Kategori
                </label>
                <MultiSelect
                  options={categoriesOptions.map((option) => ({
                    id: option.id,
                    label: option.label,
                    meta: option.meta,
                    color: option.color,
                  }))}
                  selected={filter.categories}
                  onChange={(next) => handleFilterChange({ categories: next })}
                  placeholder="Semua kategori"
                  title="Kategori"
                  showSearch
                  renderPrefix={(option) => <CategoryDot color={option.color ?? undefined} />}
                />
                {hasSubcategories && (
                  <label className="flex items-center gap-3 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={filter.includeSubcategories}
                      onChange={(event) =>
                        handleFilterChange({ includeSubcategories: event.target.checked })
                      }
                      className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    />
                    Sertakan subkategori
                  </label>
                )}
              </div>
              <div className="space-y-4 rounded-2xl bg-slate-900/60 p-4 ring-1 ring-slate-800">
                <label className="text-xs font-semibold uppercase text-slate-400">
                  Toggles
                </label>
                <label className="flex items-center gap-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={filter.includeTransfers}
                    onChange={(event) =>
                      handleFilterChange({ includeTransfers: event.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  />
                  Include transfers
                </label>
                <label className="flex items-center gap-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={filter.includePending}
                    onChange={(event) =>
                      handleFilterChange({ includePending: event.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  />
                  Include pending / uncleared
                </label>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-slate-400">
                    Search
                  </label>
                  <div className="flex items-center gap-2 rounded-2xl bg-slate-950/60 px-3 ring-1 ring-slate-800">
                    <Search className="h-4 w-4 text-slate-500" />
                    <input
                      type="search"
                      value={filter.search}
                      onChange={(event) => handleFilterChange({ search: event.target.value })}
                      placeholder="Cari merchant/notes"
                      className="h-10 w-full bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
              Export akan berisi {exportPreview.transactions} transaksi, {exportPreview.categories}{' '}
              kategori, {exportPreview.merchants} merchant, dan {exportPreview.daily} baris harian.
              <span className="ml-2 text-xs text-slate-500">
                Amount di CSV menggunakan angka positif; kolom type menunjukkan income/expense.
              </span>
            </div>
            {error && (
              <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-500/30">
                Gagal memuat data. Coba refresh halaman.
              </div>
            )}
          </CardBody>
        </Card>

        <div className="grid gap-4 lg:grid-cols-4">
          {kpiCards.map((card) => (
            <Card key={card.label} className="flex flex-col gap-2 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {card.label}
              </p>
              <p className={clsx('text-lg font-semibold', card.tone)}>{card.value}</p>
              {card.helper && <p className="text-xs text-slate-400">{card.helper}</p>}
            </Card>
          ))}
        </div>

        <Card className="space-y-6">
          <CardHeader
            title="Detail Report"
            actions={
              <div className="w-full max-w-full overflow-x-auto">
                <ReportTabs value={activeTab} onChange={handleTabChange} />
              </div>
            }
          />
          <CardBody>
            {activeTab === 'categories' && (
              <div className="space-y-4">
                <div className="overflow-hidden rounded-3xl ring-1 ring-slate-800">
                  <table className="min-w-full divide-y divide-slate-800 text-sm">
                    <thead className="bg-slate-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs uppercase text-slate-400">
                          Category
                        </th>
                        <th className="px-4 py-3 text-right text-xs uppercase text-slate-400">
                          Income
                        </th>
                        <th className="px-4 py-3 text-right text-xs uppercase text-slate-400">
                          Expense
                        </th>
                        <th className="px-4 py-3 text-right text-xs uppercase text-slate-400">
                          Avg
                        </th>
                        <th className="px-4 py-3 text-right text-xs uppercase text-slate-400">
                          Count
                        </th>
                        <th className="px-4 py-3 text-right text-xs uppercase text-slate-400">
                          Share
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {reportData.categories.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                            Tidak ada data kategori pada rentang ini.
                          </td>
                        </tr>
                      )}
                      {reportData.categories.map((row) => (
                        <tr key={row.category_id} className="hover:bg-slate-900/60">
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() =>
                                setFocusedCategory(
                                  focusedCategory === row.category_name ? null : row.category_name,
                                )
                              }
                              className="text-left text-sm font-semibold text-slate-200 hover:underline"
                            >
                              {row.category_name}
                            </button>
                            {row.parent_category && (
                              <p className="text-xs text-slate-500">Parent: {row.parent_category}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-emerald-300">
                            {currencyFormatter.format(row.total_income)}
                          </td>
                          <td className="px-4 py-3 text-right text-rose-300">
                            {currencyFormatter.format(row.total_expense)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-200">
                            {currencyFormatter.format(row.average_amount)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-200">
                            {row.transaction_count}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-200">
                            {formatPercent(row.share_of_total_expense)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {focusedCategory && categoryDetails && (
                  <div className="rounded-3xl border border-slate-800 bg-slate-950/40 p-4">
                    <h4 className="text-sm font-semibold text-slate-200">
                      Detail {focusedCategory}
                    </h4>
                    {categoryDetails.topTransactions.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-400">Belum ada transaksi.</p>
                    ) : (
                      <div className="mt-3 space-y-2 text-sm text-slate-300">
                        {categoryDetails.topTransactions.map((tx) => (
                          <div
                            key={tx.transaction_id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-900/60 px-3 py-2"
                          >
                            <div>
                              <p className="font-semibold text-slate-200">
                                {tx.merchant_name || 'Tanpa merchant'}
                              </p>
                              <p className="text-xs text-slate-400">
                                {tx.date} • {tx.notes || 'Tanpa catatan'}
                              </p>
                            </div>
                            <div className="text-sm font-semibold text-rose-300">
                              {currencyFormatter.format(tx.amount)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'merchants' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-slate-400">
                    {merchantRows.length} merchant terdeteksi.
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-400">Sort:</span>
                    <select
                      value={merchantSort}
                      onChange={(event) => setMerchantSort(event.target.value as 'total' | 'count' | 'last')}
                      className="h-9 rounded-xl bg-slate-900/60 px-3 text-sm text-slate-200 ring-1 ring-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    >
                      <option value="total">Total expense</option>
                      <option value="count">Transaction count</option>
                      <option value="last">Last transaction date</option>
                    </select>
                  </div>
                </div>
                <div className="overflow-hidden rounded-3xl ring-1 ring-slate-800">
                  <table className="min-w-full divide-y divide-slate-800 text-sm">
                    <thead className="bg-slate-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs uppercase text-slate-400">
                          Merchant
                        </th>
                        <th className="px-4 py-3 text-right text-xs uppercase text-slate-400">
                          Total expense
                        </th>
                        <th className="px-4 py-3 text-right text-xs uppercase text-slate-400">
                          Count
                        </th>
                        <th className="px-4 py-3 text-right text-xs uppercase text-slate-400">
                          Average
                        </th>
                        <th className="px-4 py-3 text-right text-xs uppercase text-slate-400">
                          Last date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {pagedMerchants.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                            Tidak ada data merchant pada rentang ini.
                          </td>
                        </tr>
                      )}
                      {pagedMerchants.map((row) => (
                        <tr key={row.merchant_name} className="hover:bg-slate-900/60">
                          <td className="px-4 py-3 font-semibold text-slate-200">
                            {row.merchant_name || 'Tanpa merchant'}
                          </td>
                          <td className="px-4 py-3 text-right text-rose-300">
                            {currencyFormatter.format(row.total_expense)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-200">
                            {row.transaction_count}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-200">
                            {currencyFormatter.format(row.average_expense)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-200">
                            {row.last_transaction_date || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>
                    Page {merchantPage} of {merchantPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMerchantPage((prev) => Math.max(1, prev - 1))}
                      disabled={merchantPage === 1}
                      className="rounded-xl bg-slate-900/60 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => setMerchantPage((prev) => Math.min(merchantPages, prev + 1))}
                      disabled={merchantPage === merchantPages}
                      className="rounded-xl bg-slate-900/60 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'daily' && (
              <div className="space-y-6">
                <ChartCard
                  title="Cashflow Harian"
                  subtext="Income, expense, dan net per hari."
                  isEmpty={reportData.daily.length === 0}
                >
                  {({ height }: { height: number }) => (
                    <ResponsiveContainer width="100%" height={height}>
                      <AreaChart data={reportData.daily} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
                        <defs>
                          <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#34d399" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#fb7185" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#fb7185" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)' }} tickLine={false} />
                        <YAxis tick={{ fill: 'var(--text-muted)' }} tickLine={false} />
                        <Tooltip content={<TrendTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="income"
                          name="Income"
                          stroke="#34d399"
                          fill="url(#incomeFill)"
                          strokeWidth={2}
                        />
                        <Area
                          type="monotone"
                          dataKey="expense"
                          name="Expense"
                          stroke="#fb7185"
                          fill="url(#expenseFill)"
                          strokeWidth={2}
                        />
                        <Line dataKey="net" name="Net" stroke="#38bdf8" strokeWidth={2} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>

                {heatmapMonth && (
                  <HeatmapCalendar
                    month={heatmapMonth}
                    txs={reportData.transactions.map((tx) => ({
                      date: tx.date,
                      type: tx.type,
                      amount: tx.amount,
                    }))}
                  />
                )}

                <div className="overflow-hidden rounded-3xl ring-1 ring-slate-800">
                  <table className="min-w-full divide-y divide-slate-800 text-sm">
                    <thead className="bg-slate-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs uppercase text-slate-400">
                          Date
                        </th>
                        <th className="px-4 py-3 text-right text-xs uppercase text-slate-400">
                          Income
                        </th>
                        <th className="px-4 py-3 text-right text-xs uppercase text-slate-400">
                          Expense
                        </th>
                        <th className="px-4 py-3 text-right text-xs uppercase text-slate-400">
                          Net
                        </th>
                        <th className="px-4 py-3 text-right text-xs uppercase text-slate-400">
                          Cumulative
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {reportData.daily.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                            Tidak ada data harian pada rentang ini.
                          </td>
                        </tr>
                      )}
                      {reportData.daily.map((row) => (
                        <tr key={row.date} className="hover:bg-slate-900/60">
                          <td className="px-4 py-3 text-slate-200">{row.date}</td>
                          <td className="px-4 py-3 text-right text-emerald-300">
                            {currencyFormatter.format(row.income)}
                          </td>
                          <td className="px-4 py-3 text-right text-rose-300">
                            {currencyFormatter.format(row.expense)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-200">
                            {currencyFormatter.format(row.net)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-200">
                            {currencyFormatter.format(row.cumulative_net)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'transactions' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-slate-400">
                    {reportData.transactions.length} transaksi dalam report.
                  </p>
                  <button
                    type="button"
                    onClick={handleExportTransactions}
                    className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-900/60 px-3 text-xs font-semibold text-slate-200 ring-1 ring-slate-800 transition hover:text-white"
                  >
                    <Download className="h-4 w-4" />
                    Export Raw Transactions CSV
                  </button>
                </div>
                <div className="overflow-hidden rounded-3xl ring-1 ring-slate-800">
                  <table className="min-w-full divide-y divide-slate-800 text-sm">
                    <thead className="bg-slate-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs uppercase text-slate-400">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs uppercase text-slate-400">
                          Account
                        </th>
                        <th className="px-4 py-3 text-left text-xs uppercase text-slate-400">
                          Category
                        </th>
                        <th className="px-4 py-3 text-left text-xs uppercase text-slate-400">
                          Merchant
                        </th>
                        <th className="px-4 py-3 text-right text-xs uppercase text-slate-400">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-left text-xs uppercase text-slate-400">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs uppercase text-slate-400">
                          Notes
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {pagedTransactions.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                            Tidak ada transaksi pada rentang ini.
                          </td>
                        </tr>
                      )}
                      {pagedTransactions.map((row) => (
                        <tr key={row.transaction_id} className="hover:bg-slate-900/60">
                          <td className="px-4 py-3 text-slate-200">{row.date}</td>
                          <td className="px-4 py-3 text-slate-200">{row.account_name}</td>
                          <td className="px-4 py-3 text-slate-200">{row.category_name}</td>
                          <td className="px-4 py-3 text-slate-200">{row.merchant_name}</td>
                          <td
                            className={clsx(
                              'px-4 py-3 text-right font-semibold',
                              row.type === 'income' ? 'text-emerald-300' : 'text-rose-300',
                            )}
                          >
                            {currencyFormatter.format(row.amount)}
                          </td>
                          <td className="px-4 py-3 text-slate-200">{row.type}</td>
                          <td className="px-4 py-3 text-slate-400">
                            {row.notes || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>
                    Page {transactionPage} of {transactionPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTransactionPage((prev) => Math.max(1, prev - 1))}
                      disabled={transactionPage === 1}
                      className="rounded-xl bg-slate-900/60 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransactionPage((prev) => Math.min(transactionPages, prev + 1))}
                      disabled={transactionPage === transactionPages}
                      className="rounded-xl bg-slate-900/60 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat data report...
          </div>
        )}
      </section>
    </Page>
  );
}
