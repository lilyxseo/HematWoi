import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Calendar, Plus, RefreshCw } from 'lucide-react';
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
  consumeCategoriesFallbackNotice,
  listCategoriesExpense,
  upsertBudget,
  type BudgetWithSpent,
  type ExpenseCategory,
} from '../../lib/budgetApi';
import useIsAdmin from '../../hooks/useIsAdmin';

const SEGMENTS = [
  { value: 'current', label: 'Bulan ini' },
  { value: 'previous', label: 'Bulan lalu' },
  { value: 'custom', label: 'Custom' },
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
  const [rpcHintShown, setRpcHintShown] = useState(false);

  const { rows, summary, loading, error, refresh } = useBudgets(period);
  const { isAdmin } = useIsAdmin();

  useEffect(() => {
    let active = true;
    setCategoriesLoading(true);
    listCategoriesExpense()
      .then((data) => {
        if (!active) return;
        setCategories(data);
        const fallbackReason = consumeCategoriesFallbackNotice();
        if (fallbackReason === 'view-missing') {
          addToast(
            'View v_categories_budget belum tersedia. Menggunakan fallback /categories.',
            'warning'
          );
        }
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

  const notifyBudgetError = useCallback(
    (err: unknown, fallback: string) => {
      const code = typeof err === 'object' && err ? (err as { code?: string }).code : undefined;
      const message = err instanceof Error ? err.message : fallback;
      if (code === 'RPC_NOT_FOUND') {
        addToast(message, 'error');
        if (isAdmin && !rpcHintShown) {
          addToast('Perlu menjalankan migrasi SQL untuk RPC bud_upsert.', 'warning');
          setRpcHintShown(true);
        }
        return;
      }
      addToast(message, 'error');
    },
    [addToast, isAdmin, rpcHintShown]
  );

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
      notifyBudgetError(err, 'Gagal memperbarui carryover');
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
      notifyBudgetError(err, 'Gagal menyimpan anggaran');
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
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {SEGMENTS.map(({ value, label }) => {
              const active = value === segment;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleSegmentChange(value)}
                  className={clsx(
                    'h-11 rounded-2xl px-5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                    active
                      ? 'bg-brand text-brand-foreground shadow'
                      : 'border border-border bg-surface px-5 text-muted hover:border-brand/40 hover:bg-brand/5 hover:text-text'
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {segment === 'custom' ? (
            <input
              type="month"
              value={customPeriod}
              onChange={(event) => handleCustomPeriodChange(event.target.value)}
              className="h-11 rounded-2xl border border-border bg-surface px-4 text-sm text-text shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              aria-label="Pilih periode custom"
            />
          ) : (
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-2 text-sm font-medium text-muted">
              <Calendar className="h-4 w-4" />
              <span>{toHumanReadable(period)}</span>
            </div>
          )}
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

