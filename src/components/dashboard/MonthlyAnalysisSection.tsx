import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Card, { CardHeader } from '../Card';
import SectionHeader from '../SectionHeader';
import Select from '../ui/Select';
import Skeleton from '../Skeleton';
import ProgressTiny from './ProgressTiny';
import { formatMoney } from '../../lib/format';
import useMonthlyCategorySpending from '../../hooks/useMonthlyCategorySpending';

type SortKey = 'largest' | 'smallest' | 'name-asc' | 'percent-largest';

const SORT_OPTIONS = [
  { value: 'largest', label: 'Terbesar' },
  { value: 'smallest', label: 'Terkecil' },
  { value: 'name-asc', label: 'Nama A–Z' },
  { value: 'percent-largest', label: 'Persentase terbesar' },
] as const;

const FALLBACK_COLORS = ['#dc2626', '#f97316', '#facc15', '#10b981', '#38bdf8', '#6366f1', '#a855f7'];

function resolveColor(inputColor: string | null | undefined, index: number) {
  if (typeof inputColor === 'string' && inputColor.trim()) return inputColor;
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function MonthlyAnalysisSkeleton() {
  return (
    <div className="grid gap-4 sm:gap-6 lg:grid-cols-2 lg:gap-8">
      <Card>
        <CardHeader
          title="Pengeluaran berdasarkan kategori"
          subtext="Ringkasan kategori untuk bulan ini"
          actions={<Skeleton className="h-9 w-40" />}
        />
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Grafik pengeluaran per kategori"
          subtext="Top kategori bulan ini"
        />
        <Skeleton className="h-[300px] w-full" />
      </Card>
    </div>
  );
}

function MonthlyAnalysisEmptyState() {
  return (
    <Card className="p-0">
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <p className="text-sm text-muted">Belum ada pengeluaran bulan ini</p>
        <Link
          to="/transactions/add"
          className="btn btn-primary"
        >
          Tambah transaksi
        </Link>
      </div>
    </Card>
  );
}

export default function MonthlyAnalysisSection() {
  const [sortBy, setSortBy] = useState<SortKey>('largest');
  const { items, totalExpense, isLoading, authLoading } = useMonthlyCategorySpending();

  const sortedItems = useMemo(() => {
    const next = [...items];
    if (sortBy === 'smallest') {
      next.sort((a, b) => a.amount - b.amount);
      return next;
    }
    if (sortBy === 'name-asc') {
      next.sort((a, b) => a.name.localeCompare(b.name, 'id'));
      return next;
    }
    if (sortBy === 'percent-largest') {
      next.sort((a, b) => b.percentage - a.percentage);
      return next;
    }
    next.sort((a, b) => b.amount - a.amount);
    return next;
  }, [items, sortBy]);

  const displayList = useMemo(() => {
    const topEight = sortedItems.slice(0, 8);
    const remaining = sortedItems.slice(8);
    if (!remaining.length) return topEight;

    const othersAmount = remaining.reduce((sum, item) => sum + item.amount, 0);
    const othersPercentage = totalExpense > 0 ? othersAmount / totalExpense : 0;

    return [
      ...topEight,
      {
        categoryId: 'others',
        name: 'Lainnya',
        amount: othersAmount,
        percentage: othersPercentage,
        color: '#64748b',
      },
    ];
  }, [sortedItems, totalExpense]);

  const chartData = useMemo(() => {
    const base = [...items].sort((a, b) => b.amount - a.amount);
    const top = base.slice(0, 6);
    const remaining = base.slice(6);
    if (!remaining.length) return top;
    const otherAmount = remaining.reduce((sum, item) => sum + item.amount, 0);
    const otherPercentage = totalExpense > 0 ? otherAmount / totalExpense : 0;

    return [
      ...top,
      {
        categoryId: 'others',
        name: 'Lainnya',
        amount: otherAmount,
        percentage: otherPercentage,
        color: '#64748b',
      },
    ];
  }, [items, totalExpense]);

  if (authLoading || isLoading) {
    return (
      <section className="space-y-5 sm:space-y-7 lg:space-y-10 max-[400px]:space-y-4">
        <SectionHeader title="Analisis Bulanan" />
        <MonthlyAnalysisSkeleton />
      </section>
    );
  }

  if (!items.length) {
    return (
      <section className="space-y-5 sm:space-y-7 lg:space-y-10 max-[400px]:space-y-4">
        <SectionHeader title="Analisis Bulanan" />
        <MonthlyAnalysisEmptyState />
      </section>
    );
  }

  return (
    <section className="space-y-5 sm:space-y-7 lg:space-y-10 max-[400px]:space-y-4">
      <SectionHeader title="Analisis Bulanan" />

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2 lg:gap-8">
        <Card>
          <CardHeader
            title="Pengeluaran berdasarkan kategori"
            subtext="Ringkasan kategori untuk bulan ini"
            actions={
              <div className="w-[180px]">
                <Select
                  label="Urutkan"
                  options={SORT_OPTIONS as unknown as { value: string; label: string }[]}
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as SortKey)}
                />
              </div>
            }
          />

          <div className="space-y-3">
            {displayList.map((item, idx) => (
              <article key={item.categoryId} className="rounded-xl border border-border-subtle/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: resolveColor(item.color, idx) }}
                    />
                    <p className="truncate text-sm font-medium text-text">{item.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="hw-money text-sm font-semibold text-text">{formatMoney(item.amount, 'IDR')}</p>
                    <p className="text-xs text-muted">{(item.percentage * 100).toFixed(1)}%</p>
                  </div>
                </div>
                <ProgressTiny value={item.percentage} className="mt-2" />
              </article>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Grafik pengeluaran per kategori"
            subtext="Top kategori bulan ini"
          />
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={(value) => `${Math.round((Number(value) || 0) / 1000)}k`}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(148,163,184,0.12)' }}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid rgba(148,163,184,0.25)',
                    backgroundColor: 'rgba(15,23,42,0.92)',
                    color: '#e2e8f0',
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [formatMoney(Number(value) || 0, 'IDR'), 'Pengeluaran']}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-text-muted)' }} />
                <Bar dataKey="amount" name="Pengeluaran" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={entry.categoryId} fill={resolveColor(entry.color, index)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </section>
  );
}
