import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { Calendar, CalendarClock, History, Plus, RefreshCw, Wand2 } from 'lucide-react';
import Page from '../../layout/Page';
import Section from '../../layout/Section';
import PageHeader from '../../layout/PageHeader';
import { useToast } from '../../context/ToastContext';
import SummaryCards from './components/SummaryCards';
import BudgetTable from './components/BudgetTable';
import BudgetFormModal, { type BudgetFormValues } from './components/BudgetFormModal';
import { useBudgets } from '../../hooks/useBudgets';
import {
  deleteBudget,
  listCategoriesExpense,
  upsertBudget,
  type BudgetWithSpent,
  type ExpenseCategory,
} from '../../lib/budgetApi';

const SEGMENTS = [
  { value: 'current', label: 'Bulan ini' },
  { value: 'previous', label: 'Bulan lalu' },
  { value: 'custom', label: 'Custom' },
] as const;

type SegmentValue = (typeof SEGMENTS)[number]['value'];

const SEGMENT_ICONS: Record<SegmentValue, LucideIcon> = {
  current: CalendarClock,
  previous: History,
  custom: Wand2,
};

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

  return (
    <Page>
      <PageHeader
        title="Anggaran"
        description="Atur dan pantau alokasi pengeluaranmu tiap bulan."
      >
        <button
          type="button"
          onClick={refresh}
          className="hidden h-11 items-center gap-2 rounded-2xl border border-border bg-surface px-4 text-sm font-semibold text-text transition hover:border-brand/40 hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 md:inline-flex"
        >
          <RefreshCw className="h-4 w-4" />
          Segarkan
        </button>
        <button
          type="button"
          disabled={categoriesLoading}
          onClick={handleOpenCreate}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-brand px-5 text-sm font-semibold text-brand-foreground shadow transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          Tambah anggaran
        </button>
      </PageHeader>

      <Section first>
        <div className="relative overflow-hidden rounded-3xl border border-zinc-200/60 bg-gradient-to-br from-brand/5 via-white to-white p-6 shadow-lg ring-1 ring-black/5 dark:border-zinc-800/60 dark:from-brand/10 dark:via-zinc-950 dark:to-zinc-900/60 dark:ring-white/5">
          <div className="absolute -right-12 top-0 h-36 w-36 rounded-full bg-brand/20 opacity-60 blur-3xl dark:bg-brand/30" />
          <div className="absolute -bottom-14 left-6 h-32 w-32 rounded-full bg-sky-200/40 blur-3xl dark:bg-sky-500/20" />
          <div className="relative grid gap-6 lg:grid-cols-[1.25fr,0.75fr] lg:items-center">
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-900/60 dark:text-brand-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  Kontrol anggaran bulanan
                </p>
                <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                  Kelola alokasi dan pantau progres keuanganmu dengan mudah.
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Pilih periode yang ingin kamu evaluasi, lalu cek insight detail di bawah untuk mengambil keputusan lebih cepat.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {SEGMENTS.map(({ value, label }) => {
                  const active = value === segment;
                  const Icon = SEGMENT_ICONS[value];
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleSegmentChange(value)}
                      className={clsx(
                        'inline-flex h-12 items-center gap-2 rounded-full border px-5 text-sm font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                        active
                          ? 'border-transparent bg-brand text-brand-foreground shadow-md'
                          : 'border-white/70 bg-white/80 text-zinc-500 hover:border-brand/40 hover:bg-brand/10 hover:text-brand dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-300',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-3xl border border-white/70 bg-white/80 p-5 text-sm text-zinc-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-200">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Periode aktif
              </span>
              {segment === 'custom' ? (
                <label className="flex flex-col gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                  <span>Pilih bulan yang ingin dianalisis</span>
                  <input
                    type="month"
                    value={customPeriod}
                    onChange={(event) => handleCustomPeriodChange(event.target.value)}
                    className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    aria-label="Pilih periode custom"
                  />
                </label>
              ) : (
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/10 text-brand dark:bg-brand/20">
                    <Calendar className="h-5 w-5" />
                  </span>
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{toHumanReadable(period)}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Data ditampilkan berdasarkan transaksi pada periode tersebut.
                    </p>
                  </div>
                </div>
              )}
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

