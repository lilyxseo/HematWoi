import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
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
  if (!values.category_ids.length) {
    errors.category_ids = 'Pilih minimal 1 kategori';
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
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const categoryMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setValues(initialValues);
      setErrors({});
      setAmountInput(formatAmountDisplay(initialValues.amount_planned));
      setCategoryMenuOpen(false);
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

  useEffect(() => {
    if (!categoryMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!categoryMenuRef.current) return;
      if (categoryMenuRef.current.contains(event.target as Node)) return;
      setCategoryMenuOpen(false);
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [categoryMenuOpen]);

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

    return {
      ungrouped,
      groups: Array.from(groups.entries()),
    };
  }, [categories]);

  const categoryNameMap = useMemo(() => {
    return new Map(categories.map((category) => [category.id, category.name]));
  }, [categories]);

  const selectedCategoryNames = useMemo(() => {
    return values.category_ids.map((id) => categoryNameMap.get(id) ?? 'Kategori');
  }, [values.category_ids, categoryNameMap]);

  const emptyMessage = useMemo(() => {
    if (categories.length === 0) {
      return 'Belum ada kategori pengeluaran';
    }
    return null;
  }, [categories.length]);

  const handleChange = (field: keyof BudgetFormValues, value: string | number | boolean | string[]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const toggleCategory = (categoryId: string) => {
    setValues((prev) => {
      const exists = prev.category_ids.includes(categoryId);
      if (exists) {
        return { ...prev, category_ids: prev.category_ids.filter((id) => id !== categoryId) };
      }
      return { ...prev, category_ids: [...prev.category_ids, categoryId] };
    });
  };

  const handleAmountChange = (value: string) => {
    const parsed = parseAmountInput(value);
    setAmountInput(parsed.display);
    setValues((prev) => ({ ...prev, amount_planned: parsed.value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextValues = {
      ...values,
      notes: values.notes.trim(),
      category_ids: Array.from(new Set(values.category_ids)),
    };
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
        className="w-full max-w-xl rounded-3xl border border-white/10 bg-zinc-950/90 p-6 shadow-[0_36px_120px_-56px_rgba(0,0,0,0.8)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-50">{title}</h2>
            <p className="mt-1 text-sm text-zinc-400">Tetapkan target anggaran dengan satu atau beberapa kategori.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>

        <form className="mt-6 flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-300">
              Periode
              <input
                type="month"
                value={values.period}
                onChange={(event) => handleChange('period', event.target.value)}
                className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-zinc-100 outline-none transition focus-visible:border-brand/40 focus-visible:ring-2 focus-visible:ring-brand/30"
                required
              />
              {errors.period ? <span className="text-xs font-medium text-rose-400">{errors.period}</span> : null}
            </label>

            <div className="relative flex flex-col gap-2 text-sm font-medium text-zinc-300" ref={categoryMenuRef}>
              <span>Kategori</span>
              <button
                type="button"
                onClick={() => setCategoryMenuOpen((prev) => !prev)}
                disabled={categories.length === 0}
                className="flex h-11 items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 text-left text-sm text-zinc-100 outline-none transition hover:border-white/20 focus-visible:ring-2 focus-visible:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="truncate">
                  {selectedCategoryNames.length > 0
                    ? `${selectedCategoryNames.length} kategori dipilih`
                    : 'Pilih kategori'}
                </span>
                <ChevronDown className="h-4 w-4 text-zinc-400" />
              </button>
              {categoryMenuOpen ? (
                <div className="absolute top-[calc(100%+0.5rem)] z-20 w-full rounded-2xl border border-white/10 bg-zinc-900/95 p-2 shadow-xl">
                  <div className="max-h-60 space-y-2 overflow-y-auto p-1">
                    {groupedCategories.ungrouped.map((category) => {
                      const selected = values.category_ids.includes(category.id);
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => toggleCategory(category.id)}
                          className={clsx(
                            'flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition',
                            selected ? 'bg-brand/20 text-brand-foreground' : 'text-zinc-300 hover:bg-white/5'
                          )}
                        >
                          <span>{category.name}</span>
                          {selected ? <Check className="h-4 w-4" /> : null}
                        </button>
                      );
                    })}
                    {groupedCategories.groups.map(([groupName, groupCategories]) => (
                      <div key={groupName} className="space-y-1">
                        <p className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{groupName}</p>
                        {groupCategories.map((category) => {
                          const selected = values.category_ids.includes(category.id);
                          return (
                            <button
                              key={category.id}
                              type="button"
                              onClick={() => toggleCategory(category.id)}
                              className={clsx(
                                'flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition',
                                selected ? 'bg-brand/20 text-brand-foreground' : 'text-zinc-300 hover:bg-white/5'
                              )}
                            >
                              <span>{category.name}</span>
                              {selected ? <Check className="h-4 w-4" /> : null}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {errors.category_ids ? (
                <span className="text-xs font-medium text-rose-400">{errors.category_ids}</span>
              ) : emptyMessage ? (
                <span className="text-xs font-medium text-zinc-500">{emptyMessage}</span>
              ) : null}
            </div>
          </div>

          {selectedCategoryNames.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedCategoryNames.map((name, index) => (
                <span key={`${name}-${index}`} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-300">
                  {name}
                </span>
              ))}
            </div>
          ) : null}

          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-300">
            Nominal Anggaran (IDR)
            <input
              type="text"
              inputMode="numeric"
              value={amountInput}
              onChange={(event) => handleAmountChange(event.target.value)}
              placeholder="Masukkan nominal"
              className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-zinc-100 outline-none transition focus-visible:border-brand/40 focus-visible:ring-2 focus-visible:ring-brand/30"
              required
            />
            {errors.amount_planned ? <span className="text-xs font-medium text-rose-400">{errors.amount_planned}</span> : null}
          </label>

          <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-zinc-200">
            <span>Aktifkan carryover ke bulan berikutnya</span>
            <button
              type="button"
              onClick={() => handleChange('carryover_enabled', !values.carryover_enabled)}
              className={clsx(
                'relative inline-flex h-6 w-11 items-center rounded-full transition',
                values.carryover_enabled ? 'bg-emerald-500/70' : 'bg-zinc-700'
              )}
            >
              <span
                className={clsx(
                  'ml-[3px] h-4 w-4 rounded-full bg-white transition-transform',
                  values.carryover_enabled ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            </button>
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-300">
            Catatan (opsional)
            <textarea
              rows={3}
              value={values.notes}
              onChange={(event) => handleChange('notes', event.target.value)}
              className="min-h-[96px] rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-100 outline-none transition focus-visible:border-brand/40 focus-visible:ring-2 focus-visible:ring-brand/30"
              placeholder="Catatan tambahan untuk anggaran ini"
            />
          </label>

          <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-2xl border border-white/10 px-6 text-sm font-semibold text-zinc-200 transition hover:bg-white/5"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand px-6 text-sm font-semibold text-brand-foreground shadow transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Menyimpan...' : 'Simpan anggaran'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
