import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Calendar, NotebookPen } from 'lucide-react';
import type { BudgetRowView } from '../../hooks/useBudgets';
import type { ExpenseCategory } from '../../lib/budgetApi';

export interface BudgetFormValues {
  period: string;
  categoryId: string;
  amountPlanned: number;
  carryoverEnabled: boolean;
  notes: string;
}

interface BudgetFormDialogProps {
  open: boolean;
  categories: ExpenseCategory[];
  loading?: boolean;
  busy?: boolean;
  defaultPeriod: string;
  budget?: BudgetRowView | null;
  onClose: () => void;
  onSubmit: (values: BudgetFormValues) => void;
}

const controlClass =
  'h-11 w-full rounded-2xl border border-slate-200/70 bg-white/80 px-4 text-sm text-slate-700 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-zinc-900/70 dark:text-slate-100';

export default function BudgetFormDialog({
  open,
  categories,
  loading = false,
  busy = false,
  defaultPeriod,
  budget,
  onClose,
  onSubmit,
}: BudgetFormDialogProps) {
  const [values, setValues] = useState<BudgetFormValues>({
    period: defaultPeriod,
    categoryId: '',
    amountPlanned: 0,
    carryoverEnabled: false,
    notes: '',
  });
  const [errors, setErrors] = useState<{ period?: string; categoryId?: string; amountPlanned?: string }>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (budget) {
      setValues({
        period: budget.periodMonth.slice(0, 7),
        categoryId: budget.categoryId ?? '',
        amountPlanned: budget.amountPlanned,
        carryoverEnabled: budget.carryoverEnabled,
        notes: budget.notes ?? '',
      });
    } else {
      setValues({
        period: defaultPeriod,
        categoryId: '',
        amountPlanned: 0,
        carryoverEnabled: false,
        notes: '',
      });
    }
  }, [open, budget, defaultPeriod]);

  const groupedCategories = useMemo(() => {
    const groups = new Map<string, ExpenseCategory[]>();
    categories.forEach((category) => {
      const key = category.group_name ?? 'Lainnya';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)?.push(category);
    });
    return Array.from(groups.entries());
  }, [categories]);

  if (!open) return null;

  const handleChange = (key: keyof BudgetFormValues, value: string | number | boolean) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!values.period) nextErrors.period = 'Periode wajib diisi';
    if (!values.categoryId) nextErrors.categoryId = 'Kategori wajib dipilih';
    if (!values.amountPlanned || values.amountPlanned <= 0) nextErrors.amountPlanned = 'Nilai harus lebih dari 0';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit(values);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-b from-white/90 to-white/60 shadow-2xl backdrop-blur dark:border-white/10 dark:from-zinc-950/90 dark:to-zinc-900/70">
        <div className="flex items-center justify-between border-b border-white/40 px-6 py-4 dark:border-white/10">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {budget ? 'Edit Anggaran' : 'Tambah Anggaran'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Sesuaikan rencana pengeluaran periode ini.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-slate-500 shadow hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:bg-white/10 dark:text-slate-200"
            aria-label="Tutup"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 px-6 py-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
              Periode
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="month"
                  value={values.period}
                  onChange={(event) => handleChange('period', event.target.value)}
                  className={`${controlClass} pl-10`}
                  disabled={busy}
                  required
                />
              </div>
              {errors.period && <span className="text-xs text-rose-500">{errors.period}</span>}
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
              Kategori
              <select
                value={values.categoryId}
                onChange={(event) => handleChange('categoryId', event.target.value)}
                className={controlClass}
                disabled={busy || loading}
                required
              >
                <option value="" disabled>
                  Pilih kategori pengeluaran
                </option>
                {groupedCategories.map(([group, items]) => (
                  <optgroup key={group} label={group}>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {errors.categoryId && <span className="text-xs text-rose-500">{errors.categoryId}</span>}
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
              Planned (IDR)
              <input
                type="number"
                min="0"
                step="1000"
                value={values.amountPlanned}
                onChange={(event) => handleChange('amountPlanned', Number(event.target.value))}
                className={controlClass}
                placeholder="0"
                disabled={busy}
                required
              />
              {errors.amountPlanned && <span className="text-xs text-rose-500">{errors.amountPlanned}</span>}
            </label>

            <div className="flex flex-col gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
              Carryover
              <button
                type="button"
                onClick={() => handleChange('carryoverEnabled', !values.carryoverEnabled)}
                className={clsx(
                  'flex h-11 w-full items-center justify-between rounded-2xl border px-4 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:border-white/10',
                  values.carryoverEnabled
                    ? 'border-emerald-200 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200'
                    : 'border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-zinc-900/70 dark:text-slate-200'
                )}
                disabled={busy}
              >
                <span>{values.carryoverEnabled ? 'Aktif' : 'Nonaktif'}</span>
                <span
                  className={clsx(
                    'inline-flex h-8 w-14 items-center rounded-full border px-1 transition',
                    values.carryoverEnabled
                      ? 'justify-end border-emerald-400 bg-emerald-500/20'
                      : 'justify-start border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-slate-700/60'
                  )}
                >
                  <span
                    className={clsx(
                      'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold shadow-sm transition',
                      values.carryoverEnabled
                        ? 'bg-emerald-500 text-white'
                        : 'bg-white text-slate-600 dark:bg-slate-500 dark:text-white'
                    )}
                  >
                    {values.carryoverEnabled ? 'On' : 'Off'}
                  </span>
                </span>
              </button>
            </div>
          </div>

          <label className="flex flex-col gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
            Catatan
            <div className="relative">
              <NotebookPen className="pointer-events-none absolute left-4 top-3 h-4 w-4 text-slate-400" />
              <textarea
                rows={3}
                value={values.notes}
                onChange={(event) => handleChange('notes', event.target.value)}
                className={`${controlClass} resize-none pl-10`}
                placeholder="Catatan opsional"
                disabled={busy}
              />
            </div>
          </label>

          <div className="flex items-center justify-end gap-3 border-t border-white/40 pt-4 dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-2xl border border-slate-200/70 px-6 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
              disabled={busy}
            >
              Batal
            </button>
            <button
              type="submit"
              className="h-11 rounded-2xl bg-gradient-to-r from-sky-500 to-emerald-500 px-6 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy || loading}
            >
              {busy ? 'Menyimpan...' : budget ? 'Simpan Perubahan' : 'Tambah Anggaran'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
