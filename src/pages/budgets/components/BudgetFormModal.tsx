import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import type { ExpenseCategory } from '../../../lib/budgetApi';

export interface BudgetFormValues {
  period: string;
  category_ids: string[];
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
  'fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-10 backdrop-blur-sm';

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
  const errors: Partial<Record<'period' | 'category_ids' | 'amount_planned', string>> = {};
  if (!values.period) {
    errors.period = 'Periode wajib diisi';
  }
  if (values.category_ids.length === 0) {
    errors.category_ids = 'Pilih minimal satu kategori';
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
  const [errors, setErrors] = useState<Partial<Record<'period' | 'category_ids' | 'amount_planned', string>>>({});
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
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const groupedCategories = useMemo(() => {
    const groups = new Map<string, ExpenseCategory[]>();
    const ungrouped: ExpenseCategory[] = [];

    for (const category of categories) {
      const groupName = category.group_name?.trim();
      if (groupName) {
        const list = groups.get(groupName) ?? [];
        list.push(category);
        groups.set(groupName, list);
      } else {
        ungrouped.push(category);
      }
    }

    return { ungrouped, groups: Array.from(groups.entries()) };
  }, [categories]);

  const selectedCategorySet = useMemo(() => new Set(values.category_ids), [values.category_ids]);

  const selectedCategoryLabels = useMemo(() => {
    if (values.category_ids.length === 0) return 'Pilih kategori';
    const names = categories
      .filter((category) => selectedCategorySet.has(category.id))
      .map((category) => category.name);
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
  }, [categories, selectedCategorySet, values.category_ids.length]);

  const handleChange = (field: keyof BudgetFormValues, value: string | number | boolean | string[]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleAmountChange = (value: string) => {
    const parsed = parseAmountInput(value);
    setAmountInput(parsed.display);
    setValues((prev) => ({ ...prev, amount_planned: parsed.value }));
  };

  const toggleCategory = (categoryId: string) => {
    setValues((prev) => {
      const exists = prev.category_ids.includes(categoryId);
      const category_ids = exists
        ? prev.category_ids.filter((id) => id !== categoryId)
        : [...prev.category_ids, categoryId];
      return { ...prev, category_ids };
    });
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
        className="w-full max-w-2xl rounded-3xl border border-white/10 bg-zinc-950/95 p-6 shadow-[0_50px_120px_-60px_rgba(0,0,0,0.75)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-50">{title}</h2>
            <p className="mt-1 text-sm text-zinc-400">Tetapkan target budget dengan beberapa kategori.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-3 py-1.5 text-sm text-zinc-300 hover:border-white/20">
            Tutup
          </button>
        </div>

        <form className="mt-6 flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm text-zinc-300">
              Periode
              <input
                type="month"
                value={values.period}
                onChange={(event) => handleChange('period', event.target.value)}
                className="h-11 rounded-2xl border border-white/10 bg-zinc-900 px-4 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                required
              />
              {errors.period ? <span className="text-xs text-rose-400">{errors.period}</span> : null}
            </label>

            <label className="flex flex-col gap-2 text-sm text-zinc-300">
              Nominal Anggaran (IDR)
              <input
                type="text"
                inputMode="numeric"
                value={amountInput}
                onChange={(event) => handleAmountChange(event.target.value)}
                placeholder="Masukkan nominal"
                className="h-11 rounded-2xl border border-white/10 bg-zinc-900 px-4 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                required
              />
              {errors.amount_planned ? <span className="text-xs text-rose-400">{errors.amount_planned}</span> : null}
            </label>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-200">Kategori budget</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-xs text-zinc-400">
                {values.category_ids.length} dipilih
                <ChevronDown className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mb-3 text-xs text-zinc-400">{selectedCategoryLabels}</p>
            <div className="max-h-52 space-y-4 overflow-auto pr-1">
              {groupedCategories.ungrouped.length > 0 ? (
                <div className="space-y-2">
                  {groupedCategories.ungrouped.map((category) => {
                    const selected = selectedCategorySet.has(category.id);
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => toggleCategory(category.id)}
                        className={clsx(
                          'flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition',
                          selected
                            ? 'border-brand/60 bg-brand/15 text-zinc-100'
                            : 'border-white/10 bg-zinc-950 text-zinc-300 hover:border-white/20',
                        )}
                      >
                        <span>{category.name}</span>
                        {selected ? <Check className="h-4 w-4 text-brand" /> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {groupedCategories.groups.map(([groupName, groupCategories]) => (
                <div key={groupName} className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{groupName}</p>
                  {groupCategories.map((category) => {
                    const selected = selectedCategorySet.has(category.id);
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => toggleCategory(category.id)}
                        className={clsx(
                          'flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition',
                          selected
                            ? 'border-brand/60 bg-brand/15 text-zinc-100'
                            : 'border-white/10 bg-zinc-950 text-zinc-300 hover:border-white/20',
                        )}
                      >
                        <span>{category.name}</span>
                        {selected ? <Check className="h-4 w-4 text-brand" /> : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            {errors.category_ids ? <p className="mt-2 text-xs text-rose-400">{errors.category_ids}</p> : null}
          </div>

          <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-200">
            <span>Carryover ke bulan berikutnya</span>
            <button
              type="button"
              onClick={() => handleChange('carryover_enabled', !values.carryover_enabled)}
              className={clsx(
                'relative inline-flex h-6 w-11 items-center rounded-full transition',
                values.carryover_enabled ? 'bg-emerald-500/70' : 'bg-zinc-700',
              )}
            >
              <span
                className={clsx(
                  'ml-1 h-4 w-4 rounded-full bg-white transition-transform',
                  values.carryover_enabled ? 'translate-x-5' : 'translate-x-0',
                )}
              />
            </button>
          </label>

          <label className="flex flex-col gap-2 text-sm text-zinc-300">
            Catatan (opsional)
            <textarea
              rows={3}
              value={values.notes}
              onChange={(event) => handleChange('notes', event.target.value)}
              className="min-h-[96px] rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              placeholder="Catatan tambahan"
            />
          </label>

          <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="h-11 rounded-2xl border border-white/15 px-6 text-sm font-semibold text-zinc-200 hover:border-white/30">
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand px-6 text-sm font-semibold text-brand-foreground disabled:opacity-60"
            >
              {submitting ? 'Menyimpan...' : 'Simpan anggaran'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
