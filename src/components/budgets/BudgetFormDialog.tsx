import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { BudgetCategoryInfo } from '../../lib/budgetsApi';

export interface BudgetFormValues {
  period: string;
  category_id: string;
  planned: string;
  carryover_enabled: boolean;
  notes: string;
}

interface BudgetFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  categories: BudgetCategoryInfo[];
  initialValues: BudgetFormValues;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (values: BudgetFormValues) => Promise<void> | void;
}

const INPUT_CLASS =
  'h-11 w-full rounded-2xl border-none bg-slate-900/80 px-4 text-sm text-slate-100 ring-2 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60';

const TEXTAREA_CLASS =
  'w-full rounded-2xl border-none bg-slate-900/80 px-4 py-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60';

export default function BudgetFormDialog({
  open,
  mode,
  categories,
  initialValues,
  submitting = false,
  onClose,
  onSubmit,
}: BudgetFormDialogProps) {
  const fallbackValues = useMemo<BudgetFormValues>(() => ({
    period: initialValues.period,
    category_id: initialValues.category_id,
    planned: initialValues.planned,
    carryover_enabled: initialValues.carryover_enabled,
    notes: initialValues.notes,
  }), [initialValues]);

  const [values, setValues] = useState<BudgetFormValues>(fallbackValues);
  const [errors, setErrors] = useState<Partial<Record<keyof BudgetFormValues, string>>>({});

  useEffect(() => {
    if (open) {
      setValues(fallbackValues);
      setErrors({});
    }
  }, [open, fallbackValues]);

  if (!open) return null;

  const setField = <K extends keyof BudgetFormValues>(field: K, value: BudgetFormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof BudgetFormValues, string>> = {};
    let valid = true;
    if (!values.period) {
      next.period = 'Periode wajib diisi.';
      valid = false;
    }
    if (!values.category_id) {
      next.category_id = 'Pilih kategori.';
      valid = false;
    }
    if (values.planned.trim() === '') {
      next.planned = 'Nominal anggaran wajib diisi.';
      valid = false;
    } else {
      const numeric = Number(values.planned);
      if (!Number.isFinite(numeric) || numeric < 0) {
        next.planned = 'Masukkan angka valid.';
        valid = false;
      }
    }
    setErrors(next);
    return valid;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;
    await onSubmit(values);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-10 backdrop-blur">
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/95 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.8)]">
        <form onSubmit={handleSubmit} className="flex max-h-[85vh] flex-col">
          <header className="flex items-start justify-between gap-3 border-b border-slate-800/70 bg-slate-950/80 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                {mode === 'create' ? 'Tambah Anggaran' : 'Edit Anggaran'}
              </h2>
              <p className="text-xs text-slate-400">Tetapkan nominal dan catatan anggaran kategori.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label="Tutup form anggaran"
            >
              ✕
            </button>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="budget-period" className="text-sm font-medium text-slate-200">
                  Bulan*
                </label>
                <input
                  id="budget-period"
                  type="month"
                  className={INPUT_CLASS}
                  value={values.period}
                  onChange={(event) => setField('period', event.target.value)}
                  disabled={submitting}
                  required
                />
                {errors.period ? <p className="text-sm text-rose-300">{errors.period}</p> : null}
              </div>

              <div className="space-y-2">
                <label htmlFor="budget-category" className="text-sm font-medium text-slate-200">
                  Kategori*
                </label>
                <select
                  id="budget-category"
                  className={INPUT_CLASS}
                  value={values.category_id}
                  onChange={(event) => setField('category_id', event.target.value)}
                  disabled={submitting}
                  required
                >
                  <option value="" className="bg-slate-900">
                    Pilih kategori
                  </option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id} className="bg-slate-900">
                      {category.name}
                    </option>
                  ))}
                </select>
                {errors.category_id ? <p className="text-sm text-rose-300">{errors.category_id}</p> : null}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="budget-planned" className="text-sm font-medium text-slate-200">
                  Nominal anggaran (Rp)*
                </label>
                <input
                  id="budget-planned"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  className={INPUT_CLASS}
                  value={values.planned}
                  onChange={(event) => setField('planned', event.target.value)}
                  placeholder="0"
                  disabled={submitting}
                  required
                />
                {errors.planned ? <p className="text-sm text-rose-300">{errors.planned}</p> : null}
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium text-slate-200">Carryover</span>
                <button
                  type="button"
                  onClick={() => setField('carryover_enabled', !values.carryover_enabled)}
                  className={`inline-flex h-11 w-full items-center justify-between rounded-2xl px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                    values.carryover_enabled
                      ? 'bg-[var(--accent)]/15 text-[var(--accent)] ring-2 ring-[var(--accent)]/50'
                      : 'bg-slate-900/80 text-slate-300 ring-2 ring-slate-800 hover:ring-[var(--accent)]/40'
                  }`}
                  disabled={submitting}
                  aria-pressed={values.carryover_enabled}
                >
                  <span>{values.carryover_enabled ? 'Carryover aktif' : 'Carryover nonaktif'}</span>
                  <span className="text-xs font-semibold">
                    {values.carryover_enabled ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="budget-notes" className="text-sm font-medium text-slate-200">
                Catatan
              </label>
              <textarea
                id="budget-notes"
                className={TEXTAREA_CLASS}
                rows={4}
                value={values.notes}
                onChange={(event) => setField('notes', event.target.value)}
                placeholder="Catatan tambahan untuk kategori ini"
                disabled={submitting}
              />
            </div>
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-slate-800/70 bg-slate-950/80 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-2xl px-4 text-sm font-semibold text-slate-300 transition hover:bg-slate-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              disabled={submitting}
            >
              Batal
            </button>
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent)]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              disabled={submitting}
            >
              {submitting ? 'Menyimpan…' : mode === 'create' ? 'Simpan Anggaran' : 'Simpan Perubahan'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
