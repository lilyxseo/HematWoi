import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CalendarDays, PiggyBank } from 'lucide-react';
import type { ExpenseCategory } from '../../../lib/budgetApi';

export interface WeeklyBudgetFormValues {
  week_start: string;
  category_id: string;
  amount_planned: number;
  carryover_enabled: boolean;
  notes: string;
}

interface WeeklyBudgetFormModalProps {
  open: boolean;
  title: string;
  categories: ExpenseCategory[];
  initialValues: WeeklyBudgetFormValues;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (values: WeeklyBudgetFormValues) => Promise<void> | void;
}

const MODAL_CLASS = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-10 backdrop-blur-sm';

const ID_FORMATTER = new Intl.NumberFormat('id-ID');
const DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', { month: 'long', day: 'numeric' });

function formatAmountDisplay(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  return ID_FORMATTER.format(value);
}

function parseAmountInput(input: string): { display: string; value: number } {
  const digits = input.replace(/\D/g, '');
  if (!digits) return { display: '', value: 0 };
  const numeric = Number.parseInt(digits, 10);
  return {
    display: ID_FORMATTER.format(numeric),
    value: numeric,
  };
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeWeekStart(value: string): { start: string; end: string } {
  if (!value) {
    return { start: '', end: '' };
  }
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return { start: value, end: value };
  }
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - diff);
  const end = new Date(date);
  end.setDate(end.getDate() + 6);
  return { start: toIsoDate(date), end: toIsoDate(end) };
}

function validate(values: WeeklyBudgetFormValues) {
  const errors: Partial<Record<keyof WeeklyBudgetFormValues, string>> = {};
  if (!values.week_start) {
    errors.week_start = 'Tanggal minggu wajib diisi';
  }
  if (!values.category_id) {
    errors.category_id = 'Kategori wajib dipilih';
  }
  if (!Number.isFinite(values.amount_planned) || values.amount_planned <= 0) {
    errors.amount_planned = 'Nilai anggaran harus lebih dari 0';
  }
  return errors;
}

export default function WeeklyBudgetFormModal({
  open,
  title,
  categories,
  initialValues,
  submitting,
  onClose,
  onSubmit,
}: WeeklyBudgetFormModalProps) {
  const [values, setValues] = useState<WeeklyBudgetFormValues>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof WeeklyBudgetFormValues, string>>>({});
  const [amountInput, setAmountInput] = useState('');
  const [weekLabel, setWeekLabel] = useState('');

  useEffect(() => {
    if (open) {
      setValues(initialValues);
      setErrors({});
      setAmountInput(formatAmountDisplay(initialValues.amount_planned));
      if (initialValues.week_start) {
        const { start, end } = normalizeWeekStart(initialValues.week_start);
        setWeekLabel(`${DATE_FORMATTER.format(new Date(`${start}T00:00:00`))} – ${DATE_FORMATTER.format(new Date(`${end}T00:00:00`))}`);
      } else {
        setWeekLabel('');
      }
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

  const handleChange = (field: keyof WeeklyBudgetFormValues, value: string | number | boolean) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleWeekChange = (input: string) => {
    const { start, end } = normalizeWeekStart(input);
    setValues((prev) => ({ ...prev, week_start: start }));
    if (start && end) {
      setWeekLabel(`${DATE_FORMATTER.format(new Date(`${start}T00:00:00`))} – ${DATE_FORMATTER.format(new Date(`${end}T00:00:00`))}`);
    } else {
      setWeekLabel('');
    }
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
              Atur target mingguan agar pengeluaran tetap terkontrol.
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
              Minggu mulai
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-zinc-400">
                  <CalendarDays className="h-4 w-4" />
                </span>
                <input
                  type="date"
                  value={values.week_start}
                  onChange={(event) => handleWeekChange(event.target.value)}
                  className="h-11 w-full rounded-2xl border border-border bg-surface pl-11 pr-4 text-sm text-text shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                  required
                />
              </div>
              {weekLabel ? (
                <span className="text-xs text-muted">Periode Senin–Minggu: {weekLabel}</span>
              ) : null}
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
          </div>

          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">
            Nominal
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={amountInput}
                onChange={(event) => handleAmountChange(event.target.value)}
                className="h-11 w-full rounded-2xl border border-border bg-surface px-4 text-sm text-text shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                placeholder="0"
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                IDR
              </span>
            </div>
            {errors.amount_planned ? <span className="text-xs font-medium text-rose-500">{errors.amount_planned}</span> : null}
          </label>

          <label className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-medium text-text shadow-sm transition">
            <span>Aktifkan carryover ke bulan berikutnya</span>
            <button
              type="button"
              onClick={() => handleChange('carryover_enabled', !values.carryover_enabled)}
              className={`relative inline-flex h-6 w-12 cursor-pointer items-center rounded-full ${
                values.carryover_enabled ? 'bg-brand/80' : 'bg-border/80'
              }`}
              aria-pressed={values.carryover_enabled}
            >
              <span
                className={`ml-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                  values.carryover_enabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">
            Catatan
            <textarea
              value={values.notes}
              onChange={(event) => handleChange('notes', event.target.value)}
              className="h-28 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              placeholder="Opsional"
            />
          </label>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-2xl border border-border bg-surface px-4 text-sm font-semibold text-text shadow-sm transition hover:bg-border/60"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-10 items-center justify-center rounded-2xl bg-brand px-5 text-sm font-semibold text-brand-foreground shadow transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

