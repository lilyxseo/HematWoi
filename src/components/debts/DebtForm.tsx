import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { DebtInput, DebtRecord, DebtType } from '../../lib/api-debts';

const todayIso = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function normalizeDateInput(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

function parseDecimal(value: string): number {
  if (!value) return Number.NaN;
  const cleaned = value.replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(/,/g, '.');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function clampRate(value: number) {
  return Math.min(100, Math.max(0, value));
}

interface DebtFormValues {
  type: DebtType;
  party_name: string;
  title: string;
  date: string;
  due_date: string;
  amount: string;
  rate_percent: string;
  notes: string;
}

interface DebtFormProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialData?: DebtRecord | null;
  submitting?: boolean;
  onSubmit: (payload: DebtInput) => Promise<void> | void;
  onClose: () => void;
}

interface FieldErrors {
  [key: string]: string | undefined;
}

function buildDefaultValues(initial?: DebtRecord | null): DebtFormValues {
  if (!initial) {
    return {
      type: 'debt',
      party_name: '',
      title: '',
      date: todayIso(),
      due_date: '',
      amount: '',
      rate_percent: '',
      notes: '',
    };
  }
  return {
    type: initial.type,
    party_name: initial.party_name ?? '',
    title: initial.title ?? '',
    date: normalizeDateInput(initial.date) || todayIso(),
    due_date: normalizeDateInput(initial.due_date) || '',
    amount: initial.amount ? String(initial.amount) : '',
    rate_percent:
      typeof initial.rate_percent === 'number' && Number.isFinite(initial.rate_percent)
        ? initial.rate_percent.toString()
        : '',
    notes: initial.notes ?? '',
  };
}

function validate(values: DebtFormValues) {
  const errors: FieldErrors = {};
  if (!values.party_name.trim()) {
    errors.party_name = 'Nama pihak wajib diisi.';
  } else if (values.party_name.trim().length > 60) {
    errors.party_name = 'Maksimum 60 karakter.';
  }

  if (!values.title.trim()) {
    errors.title = 'Judul wajib diisi.';
  } else if (values.title.trim().length > 80) {
    errors.title = 'Maksimum 80 karakter.';
  }

  const amountValue = parseDecimal(values.amount);
  if (Number.isNaN(amountValue) || amountValue <= 0) {
    errors.amount = 'Masukkan nominal lebih dari 0.';
  }

  if (values.rate_percent) {
    const rateValue = parseDecimal(values.rate_percent);
    if (Number.isNaN(rateValue)) {
      errors.rate_percent = 'Masukkan persen valid.';
    } else if (rateValue < 0 || rateValue > 100) {
      errors.rate_percent = 'Nilai persen 0-100.';
    }
  }

  return { errors, amountValue };
}

export default function DebtForm({ open, mode, initialData, submitting, onSubmit, onClose }: DebtFormProps) {
  const [values, setValues] = useState<DebtFormValues>(() => buildDefaultValues(initialData));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [dateWarning, setDateWarning] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setValues(buildDefaultValues(initialData));
      setErrors({});
      setDateWarning(null);
    }
  }, [open, initialData]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      firstFieldRef.current?.focus();
    }, 10);
    return () => window.clearTimeout(id);
  }, [open]);

  const dueWarning = useMemo(() => {
    if (!values.due_date || !values.date) return null;
    const start = new Date(values.date);
    const due = new Date(values.due_date);
    if (Number.isNaN(start.getTime()) || Number.isNaN(due.getTime())) return null;
    if (due.getTime() < start.getTime()) {
      return 'Tanggal jatuh tempo lebih awal dari tanggal hutang.';
    }
    return null;
  }, [values.date, values.due_date]);

  useEffect(() => {
    setDateWarning(dueWarning);
  }, [dueWarning]);

  const handleChange = (field: keyof DebtFormValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { value } = event.target;
      setValues((prev) => ({ ...prev, [field]: value }));
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { errors: validationErrors, amountValue } = validate(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      const firstError = Object.keys(validationErrors)[0];
      dialogRef.current?.querySelector<HTMLInputElement>(`[name="${firstError}"]`)?.focus();
      return;
    }

    if (Number.isNaN(amountValue) || amountValue <= 0) {
      setErrors((prev) => ({ ...prev, amount: 'Masukkan nominal lebih dari 0.' }));
      dialogRef.current?.querySelector<HTMLInputElement>('[name="amount"]')?.focus();
      return;
    }

    const normalizedAmount = Number(amountValue.toFixed(2));
    const rateValue = values.rate_percent ? parseDecimal(values.rate_percent) : Number.NaN;
    const hasRateInput = values.rate_percent.trim().length > 0;
    const normalizedRate = hasRateInput && !Number.isNaN(rateValue) ? clampRate(rateValue) : undefined;
    const payload: DebtInput = {
      type: values.type,
      party_name: values.party_name.trim(),
      title: values.title.trim(),
      date: values.date || todayIso(),
      due_date: values.due_date || null,
      amount: normalizedAmount,
      notes: values.notes.trim() ? values.notes.trim() : null,
    };

    if (normalizedRate !== undefined) {
      payload.rate_percent = normalizedRate;
    }

    try {
      await onSubmit(payload);
    } catch (error) {
      if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
        // eslint-disable-next-line no-console
        console.error('[HW][DebtForm] submit', error);
      }
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Terjadi kesalahan saat menyimpan hutang.';
      if (typeof window !== 'undefined') {
        window.alert(message);
      }
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4 py-6" role="dialog" aria-modal="true">
      <div
        ref={dialogRef}
        className="w-full max-w-2xl rounded-3xl border border-border/60 bg-surface-1/95 p-6 shadow-2xl backdrop-blur"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-text">
              {mode === 'create' ? 'Tambah Hutang / Piutang' : 'Edit Hutang / Piutang'}
            </h2>
            <p className="text-sm text-muted">Catat detail hutang dan atur pengingat jatuh tempo.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-1 text-text hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
            aria-label="Tutup formulir hutang"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-text" htmlFor="debt-type">
            Tipe
            <select
              id="debt-type"
              name="type"
              value={values.type}
              onChange={handleChange('type')}
              className="h-[40px] rounded-xl border border-border bg-surface-1 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
            >
              <option value="debt">Hutang (kita berhutang)</option>
              <option value="receivable">Piutang (orang berhutang)</option>
            </select>
          </label>

          <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-text" htmlFor="party-name">
            Pihak
            <input
              ref={firstFieldRef}
              id="party-name"
              name="party_name"
              value={values.party_name}
              onChange={handleChange('party_name')}
              className="h-[40px] rounded-xl border border-border bg-surface-1 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
              placeholder="Nama pihak"
              required
            />
            {errors.party_name ? <span className="text-xs text-danger">{errors.party_name}</span> : null}
          </label>

          <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-text" htmlFor="title">
            Judul
            <input
              id="title"
              name="title"
              value={values.title}
              onChange={handleChange('title')}
              className="h-[40px] rounded-xl border border-border bg-surface-1 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
              placeholder="Contoh: Pinjaman motor"
              required
            />
            {errors.title ? <span className="text-xs text-danger">{errors.title}</span> : null}
          </label>

          <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-text" htmlFor="date">
            Tanggal
            <input
              id="date"
              name="date"
              type="date"
              value={values.date}
              onChange={handleChange('date')}
              className="h-[40px] rounded-xl border border-border bg-surface-1 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
            />
          </label>

          <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-text" htmlFor="due-date">
            Jatuh tempo
            <input
              id="due-date"
              name="due_date"
              type="date"
              value={values.due_date}
              onChange={handleChange('due_date')}
              className="h-[40px] rounded-xl border border-border bg-surface-1 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
            />
            {dateWarning ? <span className="text-xs text-warning">{dateWarning}</span> : null}
          </label>

          <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-text" htmlFor="amount">
            Jumlah
            <input
              id="amount"
              name="amount"
              value={values.amount}
              onChange={handleChange('amount')}
              inputMode="decimal"
              placeholder="Masukkan nominal"
              className="h-[40px] rounded-xl border border-border bg-surface-1 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
              required
            />
            {errors.amount ? <span className="text-xs text-danger">{errors.amount}</span> : null}
          </label>

          <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-text" htmlFor="rate">
            Bunga / Rate (%)
            <input
              id="rate"
              name="rate_percent"
              value={values.rate_percent}
              onChange={handleChange('rate_percent')}
              inputMode="decimal"
              placeholder="Opsional"
              className="h-[40px] rounded-xl border border-border bg-surface-1 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
            />
            {errors.rate_percent ? <span className="text-xs text-danger">{errors.rate_percent}</span> : null}
          </label>

          <label className="sm:col-span-2 flex min-w-0 flex-col gap-1 text-sm font-medium text-text" htmlFor="notes">
            Catatan
            <textarea
              id="notes"
              name="notes"
              value={values.notes}
              onChange={handleChange('notes')}
              rows={3}
              className="rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
              placeholder="Catatan tambahan (opsional)"
            />
          </label>

          <div className="sm:col-span-2 flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-[42px] items-center justify-center rounded-xl border border-border bg-surface-1 px-5 text-sm font-medium text-text transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={Boolean(submitting)}
              className="inline-flex h-[42px] items-center justify-center rounded-xl bg-brand text-sm font-semibold text-brand-foreground px-6 transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Menyimpan…' : mode === 'create' ? 'Tambah' : 'Simpan perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
