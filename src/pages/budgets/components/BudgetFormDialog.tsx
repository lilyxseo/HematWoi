import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import clsx from 'clsx';

export interface BudgetFormValues {
  period: string;
  categoryId: string;
  amount: number;
  carryover: boolean;
  notes: string;
}

export interface BudgetCategoryOption {
  id: string;
  name: string;
  type: 'income' | 'expense';
  group_name?: string | null;
}

interface BudgetFormDialogProps {
  open: boolean;
  title: string;
  categories: BudgetCategoryOption[];
  initialValues: BudgetFormValues;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (values: BudgetFormValues) => Promise<void> | void;
}

const defaultValues: BudgetFormValues = {
  period: '',
  categoryId: '',
  amount: 0,
  carryover: false,
  notes: '',
};

type FormErrors = Partial<Record<keyof BudgetFormValues, string>>;

export default function BudgetFormDialog({
  open,
  title,
  categories,
  initialValues,
  submitting = false,
  onClose,
  onSubmit,
}: BudgetFormDialogProps) {
  const [values, setValues] = useState<BudgetFormValues>(initialValues ?? defaultValues);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      setValues(initialValues ?? defaultValues);
      setErrors({});
    }
  }, [open, initialValues]);

  const groupedOptions = useMemo(() => {
    return categories.reduce(
      (acc, category) => {
        acc[category.type].push(category);
        return acc;
      },
      {
        expense: [] as BudgetCategoryOption[],
        income: [] as BudgetCategoryOption[],
      }
    );
  }, [categories]);

  const handleChange = <T extends keyof BudgetFormValues>(field: T, value: BudgetFormValues[T]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const nextErrors: FormErrors = {};
    if (!values.categoryId) {
      nextErrors.categoryId = 'Kategori wajib dipilih.';
    }
    if (!values.period) {
      nextErrors.period = 'Periode wajib diisi.';
    }
    if (Number.isNaN(values.amount) || values.amount < 0) {
      nextErrors.amount = 'Nominal tidak boleh negatif.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;
    await onSubmit(values);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="budget-form-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-3xl bg-slate-900/95 ring-1 ring-slate-800"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-800/60 px-6 py-4">
          <div>
            <h2 id="budget-form-title" className="text-lg font-semibold text-slate-100">
              {title}
            </h2>
            <p className="text-xs text-slate-400">Atur anggaran untuk kategori pilihanmu.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-800/80 px-3 py-1 text-sm text-slate-300 transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
          >
            Tutup
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Bulan</span>
              <input
                type="month"
                value={values.period}
                onChange={(event) => handleChange('period', event.target.value)}
                className={clsx(
                  'rounded-xl border border-transparent bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-1 ring-slate-800 focus:ring-[var(--accent)]/60',
                  errors.period ? 'ring-rose-500/60' : 'focus:ring-2'
                )}
              />
              {errors.period ? <span className="text-xs text-rose-400">{errors.period}</span> : null}
            </label>

            <label className="flex flex-col gap-1 text-sm text-slate-300">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Nominal</span>
              <input
                type="number"
                min={0}
                step={1}
                value={values.amount}
                onChange={(event) => handleChange('amount', Number(event.target.value))}
                className={clsx(
                  'rounded-xl border border-transparent bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-1 ring-slate-800 focus:ring-[var(--accent)]/60',
                  errors.amount ? 'ring-rose-500/60' : 'focus:ring-2'
                )}
              />
              {errors.amount ? <span className="text-xs text-rose-400">{errors.amount}</span> : null}
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm text-slate-300">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Kategori</span>
            <select
              value={values.categoryId}
              onChange={(event) => handleChange('categoryId', event.target.value)}
              className={clsx(
                'rounded-xl border border-transparent bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-1 ring-slate-800 focus:ring-[var(--accent)]/60',
                errors.categoryId ? 'ring-rose-500/60' : 'focus:ring-2'
              )}
            >
              <option value="">Pilih kategori…</option>
              {groupedOptions.expense.length ? (
                <optgroup label="Expense">
                  {groupedOptions.expense.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                      {category.group_name ? ` — ${category.group_name}` : ''}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {groupedOptions.income.length ? (
                <optgroup label="Income">
                  {groupedOptions.income.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                      {category.group_name ? ` — ${category.group_name}` : ''}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
            {errors.categoryId ? <span className="text-xs text-rose-400">{errors.categoryId}</span> : null}
          </label>

          <label className="flex items-center gap-3 rounded-2xl bg-slate-900/60 px-4 py-3 text-sm text-slate-200 ring-1 ring-slate-800">
            <input
              type="checkbox"
              checked={values.carryover}
              onChange={(event) => handleChange('carryover', event.target.checked)}
              className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-[var(--accent)] focus:ring-[var(--accent)]/40"
            />
            Aktifkan carryover bulan berikutnya
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-300">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Catatan</span>
            <textarea
              value={values.notes}
              onChange={(event) => handleChange('notes', event.target.value)}
              rows={3}
              className="rounded-xl border border-transparent bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-1 ring-slate-800 focus:ring-[var(--accent)]/60"
              placeholder="Opsional"
            />
          </label>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-sm font-semibold text-slate-300 transition hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 disabled:opacity-60"
            >
              {submitting ? 'Menyimpan…' : 'Simpan anggaran'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
