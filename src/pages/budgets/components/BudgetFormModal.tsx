import { FormEvent, useEffect, useId, useMemo, useState } from 'react';
import { Calendar, PiggyBank } from 'lucide-react';
import Modal from '../../../components/Modal.jsx';
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

  const periodId = useId();
  const categoryId = useId();
  const amountId = useId();
  const notesId = useId();

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
      const key = category.group_name ?? 'Tanpa grup';
      const list = groups.get(key) ?? [];
      list.push(category);
      groups.set(key, list);
    }
    return Array.from(groups.entries())
      .map(([groupName, groupCategories]) => [
        groupName,
        groupCategories.slice().sort((a, b) => a.name.localeCompare(b.name, 'id-ID')),
      ] as const)
      .sort((a, b) => a[0].localeCompare(b[0], 'id-ID'));
  }, [categories]);

  const hasCategories = groupedCategories.some(([, items]) => items.length > 0);

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
    <Modal open={open} title={title} onClose={onClose}>
      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <p className="text-sm text-muted">
          Tetapkan target anggaran untuk kategori pengeluaranmu.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor={periodId} className="form-label">
              Periode
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
                <Calendar className="h-4 w-4" />
              </span>
              <input
                id={periodId}
                type="month"
                value={values.period}
                onChange={(event) => handleChange('period', event.target.value)}
                className="pl-9"
                required
              />
            </div>
            {errors.period ? <p className="form-error">{errors.period}</p> : null}
          </div>

          <div className="space-y-2">
            <label htmlFor={categoryId} className="form-label">
              Kategori
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
                <PiggyBank className="h-4 w-4" />
              </span>
              <select
                id={categoryId}
                value={values.category_id}
                onChange={(event) => handleChange('category_id', event.target.value)}
                className="pl-9 pr-10"
                required
                disabled={!hasCategories}
              >
                <option value="" disabled>
                  {hasCategories ? 'Pilih kategori' : 'Belum ada kategori pengeluaran'}
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
            {!hasCategories ? (
              <p className="text-xs text-muted">
                Tambahkan kategori pengeluaran baru di halaman Kategori sebelum membuat anggaran.
              </p>
            ) : null}
            {errors.category_id ? <p className="form-error">{errors.category_id}</p> : null}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor={amountId} className="form-label">
            Nominal Anggaran (IDR)
          </label>
          <input
            id={amountId}
            type="number"
            min="0"
            step="1000"
            value={values.amount_planned}
            onChange={(event) => handleChange('amount_planned', Number(event.target.value))}
            required
          />
          {errors.amount_planned ? <p className="form-error">{errors.amount_planned}</p> : null}
        </div>

        <div className="flex items-center justify-between gap-4 rounded-2xl border border-border-subtle bg-surface-alt px-4 py-3 text-sm text-text">
          <span>Aktifkan carryover ke bulan berikutnya</span>
          <button
            type="button"
            onClick={() => handleChange('carryover_enabled', !values.carryover_enabled)}
            className={`relative inline-flex h-6 w-12 cursor-pointer items-center rounded-full transition ${
              values.carryover_enabled ? 'bg-primary' : 'bg-border-subtle'
            }`}
          >
            <span
              className={`relative ml-1 h-4 w-4 rounded-full bg-surface shadow-sm transition-transform ${
                values.carryover_enabled ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="space-y-2">
          <label htmlFor={notesId} className="form-label">
            Catatan (opsional)
          </label>
          <textarea
            id={notesId}
            rows={3}
            value={values.notes}
            onChange={(event) => handleChange('notes', event.target.value)}
            placeholder="Catatan tambahan untuk anggaran ini"
          />
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Batal
          </button>
          <button type="submit" disabled={submitting} className="btn btn-primary">
            {submitting ? 'Menyimpan...' : 'Simpan anggaran'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

