import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  Calendar,
  CalendarCheck2,
  CalendarClock,
  History,
  PiggyBank,
  Plus,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import Page from '../../layout/Page';
import Section from '../../layout/Section';
import PageHeader from '../../layout/PageHeader';
import { useToast } from '../../context/ToastContext';
import { useBudgets } from '../../hooks/useBudgets';
import {
  deleteBudget,
  listCategoriesExpense,
  upsertBudget,
  type BudgetWithSpent,
  type ExpenseCategory,
} from '../../lib/budgetApi';
import { formatCurrency } from '../../lib/format';
import SummaryCards from './components/SummaryCards';
import BudgetTable from './components/BudgetTable';
import BudgetFormModal, { type BudgetFormValues } from './components/BudgetFormModal';

const SEGMENTS = [
  {
    value: 'current',
    label: 'Bulan ini',
    description: 'Pantau pengeluaran aktif',
    icon: CalendarCheck2,
  },
  {
    value: 'previous',
    label: 'Bulan lalu',
    description: 'Bandingkan dengan periode lalu',
    icon: History,
  },
  {
    value: 'custom',
    label: 'Custom',
    description: 'Pilih periode sendiri',
    icon: CalendarClock,
  },
] as const;

type SegmentValue = (typeof SEGMENTS)[number]['value'];

function formatPeriod(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function getCurrentPeriod() {
  return formatPeriod(new Date());
}

function getPreviousPeriod() {
  const now = new Date();
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return formatPeriod(previous);
}

function toHumanReadable(period: string): string {
  const [year, month] = period.split('-').map((value) => Number.parseInt(value, 10));
  if (!year || !month) return period;
  const formatter = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' });
  return formatter.format(new Date(year, month - 1, 1));
}

function isoToPeriod(isoDate: string | null | undefined): string {
  if (!isoDate) return getCurrentPeriod();
  return isoDate.slice(0, 7);
}

const DEFAULT_FORM_VALUES: BudgetFormValues = {
  period: getCurrentPeriod(),
  category_id: '',
  amount_planned: 0,
  carryover_enabled: false,
  notes: '',
};

export default function BudgetsPage() {
  const { addToast } = useToast();
  const [segment, setSegment] = useState<SegmentValue>('current');
  const [customPeriod, setCustomPeriod] = useState<string>(getCurrentPeriod());
  const [period, setPeriod] = useState<string>(getCurrentPeriod());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetWithSpent | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const { rows, summary, loading, error, refresh } = useBudgets(period);

  useEffect(() => {
    let active = true;
    setCategoriesLoading(true);
    listCategoriesExpense()
      .then((data) => {
        if (!active) return;
        setCategories(data);
      })
      .catch((err) => {
        if (!active) return;
        const message = err instanceof Error ? err.message : 'Gagal memuat kategori';
        addToast(message, 'error');
      })
      .finally(() => {
        if (!active) return;
        setCategoriesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [addToast]);

  useEffect(() => {
    if (!error) return;
    addToast(error, 'error');
  }, [error, addToast]);

  useEffect(() => {
    if (segment === 'current') {
      setPeriod(getCurrentPeriod());
    } else if (segment === 'previous') {
      setPeriod(getPreviousPeriod());
    } else {
      setPeriod(customPeriod || getCurrentPeriod());
    }
  }, [segment, customPeriod]);

  const initialFormValues = useMemo<BudgetFormValues>(() => {
    if (editing) {
      return {
        period: isoToPeriod(editing.period_month),
        category_id: editing.category_id ?? '',
        amount_planned: Number(editing.amount_planned ?? 0),
        carryover_enabled: editing.carryover_enabled,
        notes: editing.notes ?? '',
      };
    }
    return { ...DEFAULT_FORM_VALUES, period };
  }, [editing, period]);

  const handleSegmentChange = (value: SegmentValue) => {
    setSegment(value);
  };

  const handleCustomPeriodChange = (value: string) => {
    setCustomPeriod(value);
    setPeriod(value || getCurrentPeriod());
  };

  const handleOpenCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const handleEdit = (row: BudgetWithSpent) => {
    setEditing(row);
    setModalOpen(true);
  };

  const handleDelete = async (row: BudgetWithSpent) => {
    const confirmed = window.confirm(`Hapus anggaran untuk ${row.category?.name ?? 'kategori ini'}?`);
    if (!confirmed) return;
    try {
      setSubmitting(true);
      await deleteBudget(row.id);
      await refresh();
      addToast('Anggaran dihapus', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus anggaran';
      addToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleCarryover = async (row: BudgetWithSpent, carryover: boolean) => {
    try {
      await upsertBudget({
        category_id: row.category_id,
        period: isoToPeriod(row.period_month),
        amount_planned: Number(row.amount_planned ?? 0),
        carryover_enabled: carryover,
        notes: row.notes ?? undefined,
      });
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memperbarui carryover';
      addToast(message, 'error');
    }
  };

  const handleSubmit = async (values: BudgetFormValues) => {
    try {
      setSubmitting(true);
      await upsertBudget({
        category_id: values.category_id,
        period: values.period,
        amount_planned: Number(values.amount_planned),
        carryover_enabled: values.carryover_enabled,
        notes: values.notes ? values.notes : undefined,
      });
      setModalOpen(false);
      setEditing(null);
      addToast('Anggaran tersimpan', 'success');
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan anggaran';
      addToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const normalizedPercentage = Math.min(Math.max(summary.percentage, 0), 1);
  const progressPercent = Math.round(normalizedPercentage * 100);
  const overspent = summary.remaining < 0;
  const highlightMessage = overspent
    ? 'Pengeluaran sudah melampaui batas anggaran. Tinjau kategori terbesar untuk kembali aman.'
    : progressPercent >= 80
      ? 'Anggaran tinggal sedikit. Fokus pada kebutuhan prioritas agar tetap terkontrol.'
      : 'Pengeluaranmu masih stabil. Pertahankan ritme baik ini sampai akhir periode.';

  const heroStats = [
    {
      label: 'Dialokasikan',
      value: formatCurrency(summary.planned, 'IDR'),
      hint: 'Total batas belanja periode ini.',
      icon: Wallet,
    },
    {
      label: 'Terpakai',
      value: formatCurrency(summary.spent, 'IDR'),
      hint: `${progressPercent}% dari anggaran telah digunakan.`,
      icon: TrendingUp,
    },
    {
      label: 'Sisa anggaran',
      value: formatCurrency(summary.remaining, 'IDR'),
      hint: overspent
        ? 'Belanja melebihi anggaran, segera atur ulang pos pengeluaran.'
        : 'Masih ada ruang untuk kebutuhan prioritas.',
      icon: PiggyBank,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Anggaran"
        description="Atur dan pantau alokasi pengeluaranmu tiap bulan."
      >
        <button
          type="button"
          onClick={refresh}
          className="hidden h-11 items-center gap-2 rounded-full border border-white/40 bg-white/70 px-5 text-sm font-semibold text-zinc-600 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 md:inline-flex dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-200"
        >
          <RefreshCw className="h-4 w-4" />
          Segarkan
        </button>
        <button
          type="button"
          disabled={categoriesLoading}
          onClick={handleOpenCreate}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-brand via-sky-500 to-emerald-500 px-6 text-sm font-semibold text-brand-foreground shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60 dark:from-brand dark:via-sky-500 dark:to-emerald-500"
        >
          <Plus className="h-4 w-4" />
          Tambah anggaran
        </button>
      </PageHeader>

      <Section first>
        <div className="relative overflow-hidden rounded-[32px] border border-white/30 bg-gradient-to-br from-brand/10 via-sky-50 to-emerald-50 shadow-xl ring-1 ring-black/5 dark:border-white/10 dark:from-brand/20 dark:via-zinc-950/60 dark:to-emerald-500/10 dark:ring-white/10">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-24 top-[-120px] h-72 w-72 rounded-full bg-brand/20 blur-3xl dark:bg-brand/30"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 bottom-[-140px] h-80 w-80 rounded-full bg-emerald-200/40 blur-3xl dark:bg-emerald-500/20"
          />
          <div className="relative flex flex-col gap-8 rounded-[30px] bg-white/70 p-6 backdrop-blur-md dark:bg-zinc-950/70 md:p-10">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-brand shadow-sm dark:border-white/10 dark:bg-zinc-900/60 dark:text-brand">
                  <Sparkles className="h-3.5 w-3.5" />
                  Mode anggaran pintar
                </div>
                <div className="space-y-4">
                  <h2 className="text-3xl font-semibold leading-tight text-zinc-900 dark:text-zinc-50 md:text-4xl">
                    Kontrol pengeluaranmu lebih mudah dan cantik.
                  </h2>
                  <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-300">
                    Rencanakan batas belanja, pantau progres, dan dapatkan insight setiap periode untuk membantu kamu tetap di jalur mencapai tujuan finansial.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  {heroStats.map(({ label, value, hint, icon: StatIcon }) => (
                    <div
                      key={label}
                      className="relative overflow-hidden rounded-2xl border border-white/40 bg-white/80 p-4 text-left shadow-md transition hover:-translate-y-0.5 hover:border-brand/40 hover:bg-white/90 dark:border-white/10 dark:bg-zinc-900/70 dark:hover:border-brand/30"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</span>
                        <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-brand/10 text-brand dark:bg-brand/20">
                          <StatIcon className="h-4 w-4" />
                        </span>
                      </div>
                      <p className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
                      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-white/40 bg-white/70 px-4 py-3 text-sm text-zinc-600 shadow-sm dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-300">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand/10 text-brand dark:bg-brand/20">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <p className="leading-relaxed">{highlightMessage}</p>
                </div>
              </div>

              <div className="flex flex-col gap-5 rounded-[28px] border border-white/40 bg-white/80 p-6 text-sm text-zinc-600 shadow-lg backdrop-blur md:max-w-sm dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-200">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Periode aktif</span>
                  <span className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand dark:border-brand/40 dark:bg-brand/20">
                    {toHumanReadable(period)}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/15 text-brand shadow-sm dark:bg-brand/25">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Total anggaran periode</p>
                    <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                      {formatCurrency(summary.planned, 'IDR')}
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/40 bg-white/70 p-3 shadow-sm dark:border-white/10 dark:bg-zinc-950/60">
                    <p className="text-[0.7rem] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Terpakai</p>
                    <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatCurrency(summary.spent, 'IDR')}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/40 bg-white/70 p-3 shadow-sm dark:border-white/10 dark:bg-zinc-950/60">
                    <p className="text-[0.7rem] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Sisa</p>
                    <p
                      className={clsx(
                        'mt-1 text-sm font-semibold',
                        overspent ? 'text-rose-500 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-400',
                      )}
                    >
                      {formatCurrency(summary.remaining, 'IDR')}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Pilih periode</p>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                      {SEGMENTS.map(({ value, label, description, icon: SegmentIcon }) => {
                        const active = value === segment;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => handleSegmentChange(value)}
                            className={clsx(
                              'group relative flex min-w-[150px] flex-1 items-start gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50',
                              active
                                ? 'border-brand/60 bg-white/90 shadow-md dark:border-brand/40 dark:bg-zinc-900/80'
                                : 'border-white/40 bg-white/60 hover:border-brand/40 hover:bg-white/80 dark:border-white/10 dark:bg-zinc-900/70 dark:hover:border-brand/30',
                            )}
                          >
                            <span
                              className={clsx(
                                'flex h-10 w-10 items-center justify-center rounded-2xl bg-brand/10 text-brand transition-all dark:bg-brand/20',
                                active ? 'scale-105 shadow-sm' : 'opacity-80',
                              )}
                            >
                              <SegmentIcon className="h-4 w-4" />
                            </span>
                            <span className="flex flex-col gap-1">
                              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{label}</span>
                              <span className="text-xs text-zinc-500 dark:text-zinc-400">{description}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {segment === 'custom' ? (
                      <label className="flex w-full items-center gap-3 rounded-2xl border border-brand/40 bg-brand/5 px-4 py-3 text-xs font-medium uppercase tracking-wide text-brand shadow-sm dark:border-brand/30 dark:bg-brand/10">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/80 text-brand dark:bg-zinc-900/60">
                          <CalendarClock className="h-4 w-4" />
                        </span>
                        <span className="flex flex-1 flex-col gap-1 text-left text-[0.7rem] text-brand/80 dark:text-brand/70">
                          Periode custom
                          <input
                            type="month"
                            value={customPeriod}
                            onChange={(event) => handleCustomPeriodChange(event.target.value)}
                            className="h-9 rounded-xl border border-transparent bg-white/90 px-3 text-sm font-semibold text-zinc-900 shadow-sm outline-none transition focus:border-brand/40 focus:ring-2 focus:ring-brand/30 dark:bg-zinc-950/80 dark:text-zinc-100"
                            aria-label="Pilih periode custom"
                          />
                        </span>
                      </label>
                    ) : (
                      <div className="flex w-full items-center gap-3 rounded-2xl border border-white/40 bg-white/70 px-4 py-3 text-sm font-medium text-zinc-600 shadow-sm dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-200">
                        <Calendar className="h-4 w-4" />
                        <span>{toHumanReadable(period)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <SummaryCards summary={summary} loading={loading} />
      </Section>

      {error ? (
        <Section>
          <div className="rounded-2xl border border-rose-200/70 bg-rose-50/70 p-4 text-sm text-rose-600 shadow-sm dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
            Terjadi kesalahan saat memuat data anggaran. Silakan coba lagi.
          </div>
        </Section>
      ) : null}

      <Section>
        <BudgetTable
          rows={rows}
          loading={loading || submitting}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleCarryover={handleToggleCarryover}
        />
      </Section>

      <BudgetFormModal
        open={modalOpen}
        title={editing ? 'Edit anggaran' : 'Tambah anggaran'}
        categories={categories}
        initialValues={initialFormValues}
        submitting={submitting}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />
    </Page>
  );
}

