import { useCallback, useEffect, useMemo, useState } from 'react';
import Page from '../../layout/Page';
import PageHeader from '../../layout/PageHeader';
import ReportFilters from '../../components/ReportFilters';
import KPITiles from '../../components/KPITiles';
import CategoryDonut from '../../components/CategoryDonut';
import MonthlyTrendChart from '../../components/MonthlyTrendChart';
import TopSpendsTable from '../../components/TopSpendsTable';
import HeatmapCalendar from '../../components/HeatmapCalendar';
import ExportReport from '../../components/ExportReport';
import Card, { CardBody, CardFooter, CardHeader } from '../../components/Card';
import Skeleton from '../../components/Skeleton';
import { useRepo } from '../../context/DataContext';
import { formatCurrency } from '../../lib/format';
import { onDataInvalidation } from '../../lib/dataInvalidation';
import { isTransactionDeleted } from '../../lib/transactionUtils';

const CURRENT_MONTH = new Date().toISOString().slice(0, 7);

const MONTH_LABEL =
  typeof Intl !== 'undefined'
    ? new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' })
    : undefined;

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

type RawRecord = Record<string, any>;

type NormalizedTransaction = {
  id?: string | number;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  date: string;
  month: string;
  categoryId?: string | number | null;
  categoryKey?: string | number | null;
  categoryName: string;
  note?: string;
};

type NormalizedBudget = {
  id?: string | number;
  categoryId?: string | number | null;
  categoryKey?: string | number | null;
  categoryName: string;
  cap: number;
  period: string | null;
};

function getCategoryKey(value: any) {
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
  const key = getCategoryKey(
    record.category_id ?? record.categoryId ?? record.category_uuid ?? record.category
  );
  if (key != null && categoriesById.has(key)) {
    return categoriesById.get(key) ?? 'Lainnya';
  }
  return 'Lainnya';
}

function normaliseTransactions(
  transactions: RawRecord[] = [],
  categoriesById: Map<string | number, string>
): NormalizedTransaction[] {
  return transactions
    .filter((tx) => !isTransactionDeleted(tx))
    .map((tx) => {
      const rawDate =
        tx.date ||
        tx.transaction_date ||
        tx.created_at ||
        tx.posted_at ||
        tx.createdAt;
      const isoDate = (() => {
        if (!rawDate) return new Date().toISOString();
        if (typeof rawDate === 'string') {
          if (rawDate.length >= 10) return rawDate;
          const parsed = new Date(rawDate);
          if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
          return new Date().toISOString();
        }
        try {
          const parsed = new Date(rawDate);
          if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
        } catch {
          /* noop */
        }
        return new Date().toISOString();
      })();
      const month = isoDate.slice(0, 7);
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
      const categoryKey = getCategoryKey(
        tx.category_id ?? tx.categoryId ?? tx.category_uuid ?? tx.category
      );
      return {
        id: tx.id ?? tx.uuid ?? tx._id,
        amount,
        type,
        date: isoDate,
        month,
        categoryId: tx.category_id ?? tx.categoryId ?? tx.category_uuid ?? null,
        categoryKey,
        categoryName: getCategoryName(tx, categoriesById),
        note: tx.note || tx.description || tx.title || '',
      };
    })
    .filter((tx) => Boolean(tx));
}

function normaliseBudgets(
  budgets: RawRecord[] = [],
  categoriesById: Map<string | number, string>
): NormalizedBudget[] {
  return budgets
    .map((item) => {
      const rawCap =
        item.amount_planned ??
        item.limit ??
        item.cap ??
        item.amount ??
        item.budget ??
        item.planned_amount ??
        0;
      const cap = Number(rawCap) || 0;
      const periodSource =
        item.period ??
        item.month ??
        item.for_month ??
        item.date ??
        item.created_at ??
        item.updated_at;
      const period = typeof periodSource === 'string' ? periodSource.slice(0, 7) : null;
      const key = getCategoryKey(
        item.category_id ?? item.categoryId ?? item.category_uuid ?? item.category
      );
      const name =
        item.category?.name ||
        item.category_name ||
        (key != null ? categoriesById.get(key) : null) ||
        'Tanpa kategori';
      return {
        id: item.id ?? item.uuid ?? item._id,
        categoryId: item.category_id ?? item.categoryId ?? item.category_uuid ?? null,
        categoryKey: key,
        categoryName: name,
        cap,
        period,
      };
    })
    .filter(Boolean);
}

function buildMonths(transactions: NormalizedTransaction[]) {
  const unique = new Set<string>();
  transactions.forEach((tx) => {
    if (tx.month) unique.add(tx.month);
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

function computeDailyBreakdown(
  transactions: NormalizedTransaction[],
  month: string
): { date: string; income: number; expense: number; balance: number }[] {
  if (!month) return [];
  const [year, monthIndex] = month.split('-').map((value) => Number.parseInt(value, 10));
  if (!year || !monthIndex) return [];
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  const map = new Map<string, { income: number; expense: number }>();
  transactions.forEach((tx) => {
    if (tx.month !== month) return;
    if (tx.type === 'transfer') return;
    const day = tx.date.slice(8, 10);
    const entry = map.get(day) || { income: 0, expense: 0 };
    if (tx.type === 'income') {
      entry.income += tx.amount;
    } else if (tx.type === 'expense') {
      entry.expense += tx.amount;
    }
    map.set(day, entry);
  });
  const rows = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = String(day).padStart(2, '0');
    const entry = map.get(key) || { income: 0, expense: 0 };
    rows.push({
      date: `${month}-${key}`,
      income: entry.income,
      expense: entry.expense,
      balance: entry.income - entry.expense,
    });
  }
  return rows;
}

function computeMonthlyTrend(transactions: NormalizedTransaction[]) {
  const map = new Map<
    string,
    { income: number; expense: number; net: number; month: string }
  >();
  transactions.forEach((tx) => {
    if (!tx.month || tx.type === 'transfer') return;
    const entry = map.get(tx.month) || { income: 0, expense: 0, net: 0, month: tx.month };
    if (tx.type === 'income') {
      entry.income += tx.amount;
      entry.net += tx.amount;
    } else if (tx.type === 'expense') {
      entry.expense += tx.amount;
      entry.net -= tx.amount;
    }
    map.set(tx.month, entry);
  });
  return Array.from(map.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6)
    .map((entry) => ({
      month: toMonthLabel(entry.month),
      net: entry.net,
      income: entry.income,
      expense: entry.expense,
    }));
}

function computeBudgetsForMonth(
  budgets: NormalizedBudget[],
  transactions: NormalizedTransaction[],
  month: string
) {
  return budgets
    .filter((budget) => !budget.period || budget.period === month)
    .map((budget) => {
      const used = transactions
        .filter((tx) => {
          if (tx.type !== 'expense') return false;
          if (tx.month !== month) return false;
          if (budget.categoryKey != null) {
            return String(tx.categoryKey) === String(budget.categoryKey);
          }
          return tx.categoryName === budget.categoryName;
        })
        .reduce((sum, tx) => sum + tx.amount, 0);
      const remaining = Math.max(0, budget.cap - used);
      const progress = budget.cap > 0 ? Math.min(1, used / budget.cap) : 0;
      return {
        id: budget.id,
        category: budget.categoryName,
        cap: budget.cap,
        used,
        remaining,
        progress,
      };
    });
}

export default function ReportsPage() {
  const repo = useRepo();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<RawRecord[]>([]);
  const [categories, setCategories] = useState<RawRecord[]>([]);
  const [budgets, setBudgets] = useState<RawRecord[]>([]);
  const [month, setMonth] = useState<string>(CURRENT_MONTH);
  const [comparePrev, setComparePrev] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [focusedTransaction, setFocusedTransaction] = useState<NormalizedTransaction | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const load = async () => {
      try {
        const [txRows, categoryRows, budgetRows] = await Promise.all([
          repo.transactions.list(),
          repo.categories.list(),
          Promise.resolve()
            .then(() => repo.budgets.list())
            .catch((err) => {
              console.warn('[Reports] Failed to load budgets', err);
              return [];
            }),
        ]);
        if (!active) return;
        setTransactions(Array.isArray(txRows) ? txRows : []);
        setCategories(Array.isArray(categoryRows) ? categoryRows : []);
        setBudgets(Array.isArray(budgetRows) ? budgetRows : []);
      } catch (err: any) {
        if (!active) return;
        const message = err?.message || 'Gagal memuat data laporan';
        setError(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [repo, refreshToken]);

  useEffect(() => {
    return onDataInvalidation((detail) => {
      if (!detail) return;
      if (['transactions', 'categories', 'budgets'].includes(detail.entity)) {
        setRefreshToken((token) => token + 1);
      }
    });
  }, []);

  const categoriesById = useMemo(() => {
    const map = new Map<string | number, string>();
    categories.forEach((cat: RawRecord) => {
      const key = getCategoryKey(cat.id ?? cat.uuid ?? cat.category_id ?? cat.key);
      if (key != null) {
        map.set(key, cat.name || cat.label || cat.title || 'Tanpa nama');
      }
    });
    return map;
  }, [categories]);

  const normalizedTransactions = useMemo(
    () => normaliseTransactions(transactions, categoriesById),
    [transactions, categoriesById]
  );

  const availableMonths = useMemo(
    () => buildMonths(normalizedTransactions),
    [normalizedTransactions]
  );

  useEffect(() => {
    if (!availableMonths.includes(month)) {
      setMonth(availableMonths[0] || CURRENT_MONTH);
    }
  }, [availableMonths, month]);

  const normalizedBudgets = useMemo(
    () => normaliseBudgets(budgets, categoriesById),
    [budgets, categoriesById]
  );

  const filteredTransactions = useMemo(
    () => normalizedTransactions.filter((tx) => tx.month === month && tx.type !== 'transfer'),
    [normalizedTransactions, month]
  );

  const dailyBreakdown = useMemo(
    () => computeDailyBreakdown(normalizedTransactions, month),
    [normalizedTransactions, month]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    window.__hw_kpiSeries = {
      income: dailyBreakdown.map((d) => d.income),
      expense: dailyBreakdown.map((d) => d.expense),
      balance: dailyBreakdown.map((d) => d.balance),
    };
    return () => {
      if (window.__hw_kpiSeries) {
        delete window.__hw_kpiSeries;
      }
    };
  }, [dailyBreakdown]);

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

  const prevMonth = useMemo(() => {
    const [year, monthIndex] = month.split('-').map((value) => Number.parseInt(value, 10));
    if (!year || !monthIndex) return null;
    const prev = new Date(year, monthIndex - 2, 1);
    const key = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    return availableMonths.includes(key) ? key : null;
  }, [month, availableMonths]);

  const prevTransactions = useMemo(
    () =>
      prevMonth
        ? normalizedTransactions.filter((tx) => tx.month === prevMonth && tx.type !== 'transfer')
        : [],
    [normalizedTransactions, prevMonth]
  );

  const prevIncome = useMemo(
    () =>
      prevTransactions
        .filter((tx) => tx.type === 'income')
        .reduce((sum, tx) => sum + tx.amount, 0),
    [prevTransactions]
  );

  const prevExpense = useMemo(
    () =>
      prevTransactions
        .filter((tx) => tx.type === 'expense')
        .reduce((sum, tx) => sum + tx.amount, 0),
    [prevTransactions]
  );

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    filteredTransactions.forEach((tx) => {
      if (tx.type !== 'expense') return;
      map.set(tx.categoryName, (map.get(tx.categoryName) || 0) + tx.amount);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  useEffect(() => {
    if (typeof import.meta === 'undefined' || !import.meta.env?.DEV) return;
    console.debug('[distribusi-kategori:reports]', {
      queryKey: null,
      txCount: filteredTransactions.length,
    });
  }, [filteredTransactions.length]);

  const monthlyTrend = useMemo(
    () => computeMonthlyTrend(normalizedTransactions),
    [normalizedTransactions]
  );

  const budgetsForMonth = useMemo(
    () => computeBudgetsForMonth(normalizedBudgets, normalizedTransactions, month),
    [normalizedBudgets, normalizedTransactions, month]
  );

  const insights = useMemo(() => {
    const totalDays = dailyBreakdown.length;
    const noSpendDays = dailyBreakdown.filter((d) => d.expense === 0).length;
    const activeDays = dailyBreakdown.filter((d) => d.expense > 0).length;
    const avgExpense = activeDays ? expenseTotal / activeDays : 0;
    const bestDay = dailyBreakdown.reduce((best, current) => {
      if (!best) return current;
      return current.balance > best.balance ? current : best;
    }, dailyBreakdown[0]);
    const heaviestDay = dailyBreakdown.reduce((worst, current) => {
      if (!worst) return current;
      return current.expense > worst.expense ? current : worst;
    }, dailyBreakdown[0]);
    const topCategory = categoryBreakdown[0];
    return [
      {
        title: 'Hari tanpa pengeluaran',
        value: `${noSpendDays} dari ${totalDays} hari`,
        description:
          'Jumlah hari dalam periode ini ketika tidak ada pengeluaran yang tercatat.',
      },
      {
        title: 'Pengeluaran rata-rata aktif',
        value: activeDays ? formatCurrency(avgExpense) : '—',
        description:
          'Rata-rata pengeluaran pada hari ketika ada transaksi keluar.',
      },
      {
        title: 'Kategori terbesar',
        value: topCategory ? `${topCategory.name} • ${formatCurrency(topCategory.value)}` : '—',
        description:
          'Kategori pengeluaran dengan nominal tertinggi pada bulan ini.',
      },
      {
        title: 'Hari paling hemat',
        value: bestDay ? `${bestDay.date} • ${formatCurrency(bestDay.balance)}` : '—',
        description:
          'Selisih pemasukan dan pengeluaran terbaik dalam satu hari.',
      },
      {
        title: 'Hari pengeluaran tertinggi',
        value: heaviestDay ? `${heaviestDay.date} • ${formatCurrency(heaviestDay.expense)}` : '—',
        description:
          'Total pengeluaran terbesar yang terjadi dalam satu hari pada periode ini.',
      },
    ];
  }, [dailyBreakdown, expenseTotal, categoryBreakdown]);

  const handleRefresh = useCallback(() => {
    setRefreshToken((token) => token + 1);
  }, []);

  const handleTransactionFocus = useCallback((tx: NormalizedTransaction) => {
    setFocusedTransaction(tx);
  }, []);

  return (
    <Page>
      <PageHeader
        title="Reports"
        description="Pantau performa keuangan bulanan dengan ringkasan visual dan insight yang dapat diekspor."
      >
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleRefresh}
          disabled={loading}
        >
          Muat ulang
        </button>
      </PageHeader>

      <div className="space-y-6">
        <ReportFilters
          month={month}
          months={availableMonths}
          onChange={(value: string) => setMonth(value || CURRENT_MONTH)}
          comparePrev={comparePrev}
          onToggleCompare={setComparePrev}
        />

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-72 md:col-span-2" />
          </div>
        ) : (
          <>
            <section id="report-capture" className="space-y-6">
              <KPITiles
                income={incomeTotal}
                expense={expenseTotal}
                prevIncome={comparePrev ? prevIncome : 0}
                prevExpense={comparePrev ? prevExpense : 0}
              />

              <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <MonthlyTrendChart data={monthlyTrend} />
                <CategoryDonut data={categoryBreakdown} />
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <TopSpendsTable data={filteredTransactions} onSelect={handleTransactionFocus} />
                <Card className="flex min-h-[360px] flex-col">
                  <CardHeader
                    title="Insight Cepat"
                    subtext="Temuan utama berdasarkan transaksi bulan ini"
                  />
                  <CardBody>
                    <ul className="space-y-3">
                      {insights.map((item) => (
                        <li key={item.title} className="rounded-2xl bg-surface-alt/70 p-4">
                          <p className="text-xs uppercase tracking-wide text-muted">{item.title}</p>
                          <p className="text-sm font-semibold text-text">{item.value}</p>
                          <p className="text-xs text-muted/90">{item.description}</p>
                        </li>
                      ))}
                    </ul>
                  </CardBody>
                  {focusedTransaction ? (
                    <CardFooter>
                      <div className="space-y-1 text-xs text-muted/90">
                        <p className="font-semibold text-text">Transaksi terpilih</p>
                        <p>
                          {focusedTransaction.note || 'Tanpa catatan'} • {focusedTransaction.categoryName}
                        </p>
                        <p>
                          {new Date(focusedTransaction.date).toLocaleDateString('id-ID')} •{' '}
                          {formatCurrency(focusedTransaction.amount)}
                        </p>
                      </div>
                    </CardFooter>
                  ) : null}
                </Card>
              </div>

              <HeatmapCalendar month={month} txs={filteredTransactions} />
            </section>

            <ExportReport
              month={month}
              kpi={{
                income: incomeTotal,
                expense: expenseTotal,
                balance: incomeTotal - expenseTotal,
                savings: incomeTotal > 0 ? (incomeTotal - expenseTotal) / incomeTotal : 0,
              }}
              byCategory={categoryBreakdown.map((item) => ({
                category: item.name,
                total: item.value,
              }))}
              byDay={dailyBreakdown.map((item) => ({
                date: item.date,
                income: item.income,
                expense: item.expense,
              }))}
              budgetsForMonth={budgetsForMonth}
            />
          </>
        )}
      </div>
    </Page>
  );
}

declare global {
  interface Window {
    __hw_kpiSeries?: {
      income: number[];
      expense: number[];
      balance: number[];
    };
  }
}
