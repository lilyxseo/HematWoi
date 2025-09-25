import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Calendar, PiggyBank } from 'lucide-react';
import type { ExpenseCategory } from '../../../lib/budgetApi';

export interface BudgetFormValues {
  period: string;
  category_id: string;
  amount_planned: number;
  carryover_enabled: boolean;
  notes: string;
}

interface BudgetFormModalProps {
  open: boolean;
  title: string;
  categories: ExpenseCategory[];
  initialValues: BudgetFormValues;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (values: BudgetFormValues) => Promise<void> | void;
}

const MODAL_CLASS =
  'fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-10 backdrop-blur-sm';

function validate(values: BudgetFormValues) {
  const errors: Partial<Record<keyof BudgetFormValues, string>> = {};
  if (!values.period) {
    errors.period = 'Periode wajib diisi';
  }
  if (!values.category_id) {
    errors.category_id = 'Kategori wajib dipilih';
  }
  if (!Number.isFinite(values.amount_planned) || values.amount_planned <= 0) {
    errors.amount_planned = 'Nilai anggaran harus lebih dari 0';
  }
  return errors;
}

export default function BudgetFormModal({
  open,
  title,
  categories,
  initialValues,
  submitting,
  onClose,
  onSubmit,
}: BudgetFormModalProps) {
  const [values, setValues] = useState<BudgetFormValues>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof BudgetFormValues, string>>>({});

  useEffect(() => {
    if (open) {
      setValues(initialValues);
      setErrors({});
    }
  }, [open, initialValues]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const groupedCategories = useMemo(() => {
    const groups = new Map<string, ExpenseCategory[]>();
    for (const category of categories) {
      const key = category.group_name ?? 'Ungrouped';
      const list = groups.get(key) ?? [];
      list.push(category);
      groups.set(key, list);
    }
    return Array.from(groups.entries());
  }, [categories]);

  const hasCategories = groupedCategories.length > 0;

  const handleChange = (field: keyof BudgetFormValues, value: string | number | boolean) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextValues = { ...values, notes: values.notes.trim() };
    const validation = validate(nextValues);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;
    await onSubmit({
      ...nextValues,
      amount_planned: Number(nextValues.amount_planned),
    });
  };

  if (!open) return null;

  return (
    <div className={MODAL_CLASS} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-xl rounded-3xl border border-white/20 bg-gradient-to-b from-white/90 to-white/60 p-6 shadow-[0_40px_120px_-60px_rgba(15,23,42,0.65)] backdrop-blur dark:border-white/10 dark:from-zinc-950/80 dark:to-zinc-900/70"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Tetapkan target anggaran untuk kategori pengeluaranmu.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/70 text-zinc-500 shadow-sm transition hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-300"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>

        <form className="mt-6 flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">
              Periode
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-zinc-400">
                  <Calendar className="h-4 w-4" />
                </span>
                <input
                  type="month"
                  value={values.period}
                  onChange={(event) => handleChange('period', event.target.value)}
                  className="h-11 w-full rounded-2xl border border-border bg-surface pl-11 pr-4 text-sm text-text shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45 dark:bg-zinc-900/60"
                  required
                />
              </div>
              {errors.period ? <span className="text-xs font-medium text-rose-500">{errors.period}</span> : null}
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">
              Kategori
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-zinc-400">
                  <PiggyBank className="h-4 w-4" />
                </span>
                <select
                  value={values.category_id}
                  onChange={(event) => handleChange('category_id', event.target.value)}
                  className="h-11 w-full rounded-2xl border border-border bg-surface pl-11 pr-10 text-sm text-text shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45 dark:bg-zinc-900/60 disabled:cursor-not-allowed disabled:opacity-60"
                  required
                  disabled={!hasCategories}
                >
                  <option value="" disabled>
                    {hasCategories ? 'Pilih kategori' : 'Belum ada kategori pengeluaran'}
                  </option>
                  {hasCategories
                    ? groupedCategories.map(([groupName, groupCategories]) => (
                        <optgroup key={groupName} label={groupName}>
                          {groupCategories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </optgroup>
                      ))
                    : null}
                </select>
              </div>
              {errors.category_id ? <span className="text-xs font-medium text-rose-500">{errors.category_id}</span> : null}
            </label>
          </div>

          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">
            Nominal Anggaran (IDR)
            <input
              type="number"
              min="0"
              step="1000"
              value={values.amount_planned}
              onChange={(event) => handleChange('amount_planned', Number(event.target.value))}
              className="h-11 w-full rounded-2xl border border-border bg-surface px-4 text-sm text-text shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45 dark:bg-zinc-900/60"
              required
            />
            {errors.amount_planned ? <span className="text-xs font-medium text-rose-500">{errors.amount_planned}</span> : null}
          </label>

          <label className="flex items-center justify-between gap-4 rounded-2xl bg-white/70 px-4 py-3 text-sm font-medium text-zinc-600 shadow-inner ring-1 ring-white/40 transition dark:bg-zinc-900/50 dark:text-zinc-200 dark:ring-white/10">
            <span>Aktifkan carryover ke bulan berikutnya</span>
            <button
              type="button"
              onClick={() => handleChange('carryover_enabled', !values.carryover_enabled)}
              className={`relative inline-flex h-6 w-12 cursor-pointer items-center rounded-full transition ${
                values.carryover_enabled
                  ? 'bg-brand'
                  : 'bg-zinc-200/70 dark:bg-zinc-800/70'
              }`}
            >
              <span
                className={`ml-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                  values.carryover_enabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">
            Catatan (opsional)
            <textarea
              rows={3}
              value={values.notes}
              onChange={(event) => handleChange('notes', event.target.value)}
              className="min-h-[96px] rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45 dark:bg-zinc-900/60"
              placeholder="Catatan tambahan untuk anggaran ini"
            />
          </label>

          <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-2xl border border-white/50 px-6 text-sm font-semibold text-zinc-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-white dark:border-white/20 dark:text-zinc-200"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand px-6 text-sm font-semibold text-white shadow transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? 'Menyimpan...' : 'Simpan anggaran'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

