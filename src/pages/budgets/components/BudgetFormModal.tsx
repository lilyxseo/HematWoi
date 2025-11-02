import { FormEvent, useEffect, useMemo, useState } from 'react';
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

const ID_NUMBER_FORMATTER = new Intl.NumberFormat('id-ID');

function formatAmountDisplay(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  return ID_NUMBER_FORMATTER.format(value);
}

function parseAmountInput(input: string): { display: string; value: number } {
  const digits = input.replace(/\D/g, '');
  if (!digits) {
    return { display: '', value: 0 };
  }
  const numeric = Number.parseInt(digits, 10);
  return {
    display: ID_NUMBER_FORMATTER.format(numeric),
    value: numeric,
  };
}

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
  const [amountInput, setAmountInput] = useState('');

  useEffect(() => {
    if (open) {
      setValues(initialValues);
      setErrors({});
      setAmountInput(formatAmountDisplay(initialValues.amount_planned));
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
    const withOrder = [...categories].sort((a, b) => {
      const orderA = typeof a.order_index === 'number' ? a.order_index : Number.POSITIVE_INFINITY;
      const orderB = typeof b.order_index === 'number' ? b.order_index : Number.POSITIVE_INFINITY;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name, 'id-ID', { sensitivity: 'base' });
    });

    const ungrouped: ExpenseCategory[] = [];
    const grouped = new Map<string, ExpenseCategory[]>();

    for (const category of withOrder) {
      const groupName = category.group_name?.trim();
      if (!groupName) {
        ungrouped.push(category);
        continue;
      }

      const list = grouped.get(groupName) ?? [];
      list.push(category);
      grouped.set(groupName, list);
    }

    const orderedGroups = Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'id-ID', { sensitivity: 'base' }))
      .map(([name, items]) => ({ name, items }));

    return {
      ungrouped,
      groups: orderedGroups,
    };
  }, [categories]);

  const emptyMessage = useMemo(() => {
    if (categories.length === 0) {
      return 'Belum ada kategori pengeluaran';
    }
    return null;
  }, [categories.length]);

  const handleChange = (field: keyof BudgetFormValues, value: string | number | boolean) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleAmountChange = (value: string) => {
    const parsed = parseAmountInput(value);
    setAmountInput(parsed.display);
    setValues((prev) => ({ ...prev, amount_planned: parsed.value }));
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
              <input
                type="month"
                value={values.period}
                onChange={(event) => handleChange('period', event.target.value)}
                className="h-11 w-full rounded-2xl border border-border bg-surface px-4 text-sm text-text shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                required
              />
              {errors.period ? <span className="text-xs font-medium text-rose-500">{errors.period}</span> : null}
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">
              Kategori
              <select
                value={values.category_id}
                onChange={(event) => handleChange('category_id', event.target.value)}
                className="h-11 w-full rounded-2xl border border-border bg-surface px-4 text-sm text-text shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                required
                disabled={categories.length === 0}
              >
                <option value="" disabled>
                  Pilih kategori
                </option>
                {groupedCategories.ungrouped.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
                {groupedCategories.groups.map(({ name, items }) => (
                  <optgroup key={name} label={name}>
                    {items.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {errors.category_id ? (
                <span className="text-xs font-medium text-rose-500">{errors.category_id}</span>
              ) : emptyMessage ? (
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{emptyMessage}</span>
              ) : null}
            </label>
          </div>

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
            {errors.amount_planned ? <span className="text-xs font-medium text-rose-500">{errors.amount_planned}</span> : null}
          </label>

          <label className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-medium text-text shadow-sm transition">
            <span>Aktifkan carryover ke bulan berikutnya</span>
            <button
              type="button"
              onClick={() => handleChange('carryover_enabled', !values.carryover_enabled)}
              className={`relative inline-flex h-6 w-12 cursor-pointer items-center rounded-full ${
                values.carryover_enabled
                  ? 'bg-brand/80'
                  : 'bg-border/80'
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
              className="min-h-[96px] rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              placeholder="Catatan tambahan untuk anggaran ini"
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

