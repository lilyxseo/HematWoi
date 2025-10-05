import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CalendarDays, PiggyBank } from 'lucide-react';
import type { ExpenseCategory } from '../../../lib/budgetApi';

export interface WeeklyBudgetFormValues {
  week_start: string;
  category_id: string;
  amount_planned: number;
  notes: string;
}

interface WeeklyBudgetFormModalProps {
  open: boolean;
  title: string;
  categories: ExpenseCategory[];
  weekOptions: { value: string; label: string }[];
  initialValues: WeeklyBudgetFormValues;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (values: WeeklyBudgetFormValues) => Promise<void> | void;
}

const MODAL_CLASS =
  'fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-10 backdrop-blur-sm';

const NUMBER_FORMATTER = new Intl.NumberFormat('id-ID');

function formatAmount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '';
  return NUMBER_FORMATTER.format(value);
}

function parseAmount(input: string) {
  const digits = input.replace(/\D/g, '');
  if (!digits) return { display: '', value: 0 };
  const numeric = Number.parseInt(digits, 10);
  return { display: NUMBER_FORMATTER.format(numeric), value: numeric };
}

function validate(values: WeeklyBudgetFormValues) {
  const errors: Partial<Record<keyof WeeklyBudgetFormValues, string>> = {};
  if (!values.week_start) errors.week_start = 'Pilih minggu';
  if (!values.category_id) errors.category_id = 'Kategori wajib dipilih';
  if (!Number.isFinite(values.amount_planned) || values.amount_planned <= 0) {
    errors.amount_planned = 'Nominal harus lebih dari 0';
  }
  return errors;
}

export default function WeeklyBudgetFormModal({
  open,
  title,
  categories,
  weekOptions,
  initialValues,
  submitting,
  onClose,
  onSubmit,
}: WeeklyBudgetFormModalProps) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof WeeklyBudgetFormValues, string>>>({});
  const [amountInput, setAmountInput] = useState('');

  useEffect(() => {
    if (open) {
      setValues(initialValues);
      setErrors({});
      setAmountInput(formatAmount(initialValues.amount_planned));
    }
  }, [open, initialValues]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
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

  const handleChange = (field: keyof WeeklyBudgetFormValues, value: string | number) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleAmountChange = (value: string) => {
    const parsed = parseAmount(value);
    setAmountInput(parsed.display);
    setValues((prev) => ({ ...prev, amount_planned: parsed.value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextValues = { ...values, notes: values.notes.trim() };
    const validation = validate(nextValues);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;
    await onSubmit({ ...nextValues, amount_planned: Number(nextValues.amount_planned) });
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
              Tetapkan alokasi mingguan untuk kategori pilihanmu.
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
          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">
            Minggu (mulai Senin)
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-zinc-400">
                <CalendarDays className="h-4 w-4" />
              </span>
              <select
                value={values.week_start}
                onChange={(event) => handleChange('week_start', event.target.value)}
                className="h-11 w-full rounded-2xl border border-border bg-surface pl-11 pr-10 text-sm text-text shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                required
              >
                <option value="" disabled>
                  Pilih minggu
                </option>
                {weekOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {errors.week_start ? <span className="text-xs font-medium text-rose-500">{errors.week_start}</span> : null}
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">
            Kategori
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-zinc-400">
                <PiggyBank className="h-4 w-4" aria-hidden="true" />
              </span>
              <select
                value={values.category_id}
                onChange={(event) => handleChange('category_id', event.target.value)}
                className="h-11 w-full rounded-2xl border border-border bg-surface pl-11 pr-10 text-sm text-text shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                required
                disabled={categories.length === 0}
              >
                <option value="" disabled>
                  Pilih kategori
                </option>
                {groupedCategories.map(([groupName, groupCategories]) => (
                  <optgroup key={groupName} label={groupName}>
                    {groupCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            {errors.category_id ? <span className="text-xs font-medium text-rose-500">{errors.category_id}</span> : null}
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">
            Nominal Anggaran (IDR)
            <input
              type="text"
              inputMode="numeric"
              value={amountInput}
              onChange={(event) => handleAmountChange(event.target.value)}
              placeholder="Masukkan nominal"
              className="h-11 w-full rounded-2xl border border-border bg-surface px-4 text-sm text-text shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              required
            />
            {errors.amount_planned ? (
              <span className="text-xs font-medium text-rose-500">{errors.amount_planned}</span>
            ) : null}
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">
            Catatan (opsional)
            <textarea
              rows={3}
              value={values.notes}
              onChange={(event) => handleChange('notes', event.target.value)}
              className="min-h-[96px] rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              placeholder="Catatan tambahan"
            />
          </label>

          <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-2xl border border-border px-6 text-sm font-semibold text-text transition hover:border-brand/40 hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand px-6 text-sm font-semibold text-brand-foreground shadow transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Menyimpan...' : 'Simpan anggaran'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
