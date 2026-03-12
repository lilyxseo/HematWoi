import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
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
  if (!digits) return { display: '', value: 0 };
  const numeric = Number.parseInt(digits, 10);
  return { display: ID_NUMBER_FORMATTER.format(numeric), value: numeric };
}

function validate(values: BudgetFormValues) {
  const errors: Partial<Record<keyof BudgetFormValues, string>> = {};
  if (!values.period) errors.period = 'Periode wajib diisi';
  if (!values.category_ids.length) errors.category_ids = 'Pilih minimal 1 kategori';
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

  const handleChange = (field: keyof BudgetFormValues, value: string | number | boolean | string[]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleCategoryToggle = (categoryId: string) => {
    setValues((prev) => {
      const exists = prev.category_ids.includes(categoryId);
      const next = exists
        ? prev.category_ids.filter((id) => id !== categoryId)
        : [...prev.category_ids, categoryId];
      return { ...prev, category_ids: next };
    });
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
    await onSubmit(nextValues);
  };

  if (!open) return null;

  return (
    <div className={MODAL_CLASS} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0f1118] p-6 shadow-[0_40px_100px_-60px_rgba(0,0,0,0.8)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">{title}</h2>
            <p className="mt-1 text-sm text-zinc-400">Buat alokasi clean untuk satu atau beberapa kategori.</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400">✕</button>
        </div>

        <form className="mt-6 flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-300">
              Periode
              <input
                type="month"
                value={values.period}
                onChange={(event) => handleChange('period', event.target.value)}
                className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-zinc-100"
                required
              />
              {errors.period ? <span className="text-xs font-medium text-rose-400">{errors.period}</span> : null}
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-300">
              Nominal Anggaran (IDR)
              <input
                type="text"
                inputMode="numeric"
                value={amountInput}
                onChange={(event) => handleAmountChange(event.target.value)}
                placeholder="Masukkan nominal"
                className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-zinc-100"
                required
              />
              {errors.amount_planned ? <span className="text-xs font-medium text-rose-400">{errors.amount_planned}</span> : null}
            </label>
          </div>

          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-200">Kategori</p>
              <p className="text-xs text-zinc-500">{values.category_ids.length} dipilih</p>
            </div>
            <div className="max-h-52 space-y-3 overflow-auto pr-1">
              {[...groupedCategories.ungrouped.map((category) => ['Tanpa Grup', [category]] as const), ...groupedCategories.groups].map(([groupName, groupCategories]) => (
                <div key={groupName} className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{groupName}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {groupCategories.map((category) => {
                      const active = values.category_ids.includes(category.id);
                      return (
                        <button
                          type="button"
                          key={category.id}
                          onClick={() => handleCategoryToggle(category.id)}
                          className={clsx(
                            'flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition',
                            active
                              ? 'border-brand/40 bg-brand/15 text-zinc-100'
                              : 'border-white/10 bg-white/[0.02] text-zinc-300 hover:border-white/20'
                          )}
                        >
                          <span className="truncate">{category.name}</span>
                          <span className={clsx('inline-flex h-5 w-5 items-center justify-center rounded-full border', active ? 'border-brand/60 bg-brand/30 text-brand-foreground' : 'border-white/20 text-transparent')}>
                            <Check className="h-3 w-3" />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {errors.category_ids ? <span className="text-xs font-medium text-rose-400">{errors.category_ids}</span> : null}
          </div>

          <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-zinc-200">
            <span>Carryover ke bulan berikutnya</span>
            <button
              type="button"
              onClick={() => handleChange('carryover_enabled', !values.carryover_enabled)}
              className={clsx(
                'relative inline-flex h-6 w-12 items-center rounded-full transition',
                values.carryover_enabled ? 'bg-brand/80' : 'bg-zinc-700'
              )}
            >
              <span className={clsx('ml-1 h-4 w-4 rounded-full bg-white transition-transform', values.carryover_enabled ? 'translate-x-6' : 'translate-x-0')} />
            </button>
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-300">
            Catatan (opsional)
            <textarea
              rows={3}
              value={values.notes}
              onChange={(event) => handleChange('notes', event.target.value)}
              className="min-h-[96px] rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-100"
            />
          </label>

          <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="h-11 rounded-2xl border border-white/10 px-6 text-sm font-semibold text-zinc-300">
              Batal
            </button>
            <button type="submit" disabled={submitting} className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand px-6 text-sm font-semibold text-brand-foreground disabled:opacity-60">
              {submitting ? 'Menyimpan...' : 'Simpan anggaran'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
