import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import type { SubscriptionRecord, CreateSubscriptionPayload } from '../../lib/api-subscriptions';
import type { FilterOption } from './SubscriptionsFilterBar';

export interface SubscriptionFormSubmitPayload extends CreateSubscriptionPayload {
  id?: string;
}

export interface SubscriptionFormProps {
  open: boolean;
  initial?: SubscriptionRecord | null;
  categories: FilterOption[];
  accounts: FilterOption[];
  saving?: boolean;
  onClose(): void;
  onSubmit(payload: SubscriptionFormSubmitPayload): Promise<void> | void;
}

interface FormState {
  name: string;
  vendor: string;
  categoryId: string | 'none';
  accountId: string | 'none';
  amount: string;
  currency: string;
  intervalUnit: 'day' | 'week' | 'month' | 'year';
  intervalCount: string;
  anchorDate: string;
  anchorDayOfWeek: string;
  startDate: string;
  endDate: string;
  trialEnd: string;
  status: 'active' | 'paused' | 'canceled';
  reminderDays: string;
  tags: string;
  color: string;
  icon: string;
  notes: string;
}

const defaultState: FormState = {
  name: '',
  vendor: '',
  categoryId: 'none',
  accountId: 'none',
  amount: '',
  currency: 'IDR',
  intervalUnit: 'month',
  intervalCount: '1',
  anchorDate: '',
  anchorDayOfWeek: '0',
  startDate: '',
  endDate: '',
  trialEnd: '',
  status: 'active',
  reminderDays: '',
  tags: '',
  color: '#64748B',
  icon: '',
  notes: '',
};

const weekdayOptions = [
  { value: '0', label: 'Minggu' },
  { value: '1', label: 'Senin' },
  { value: '2', label: 'Selasa' },
  { value: '3', label: 'Rabu' },
  { value: '4', label: 'Kamis' },
  { value: '5', label: 'Jumat' },
  { value: '6', label: 'Sabtu' },
];

const currencyOptions = ['IDR', 'USD'];

export default function SubscriptionForm({
  open,
  initial,
  categories,
  accounts,
  saving = false,
  onClose,
  onSubmit,
}: SubscriptionFormProps) {
  const [form, setForm] = useState<FormState>(defaultState);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      if (initial) {
        setForm({
          name: initial.name ?? '',
          vendor: initial.vendor ?? '',
          categoryId: initial.category_id ?? 'none',
          accountId: initial.account_id ?? 'none',
          amount: initial.amount ? String(initial.amount) : '',
          currency: initial.currency ?? 'IDR',
          intervalUnit: initial.interval_unit ?? 'month',
          intervalCount: String(initial.interval_count ?? 1),
          anchorDate: initial.anchor_date ?? '',
          anchorDayOfWeek:
            initial.interval_unit === 'week' && initial.anchor_day_of_week != null
              ? String(initial.anchor_day_of_week)
              : '0',
          startDate: initial.start_date ?? '',
          endDate: initial.end_date ?? '',
          trialEnd: initial.trial_end ?? '',
          status: initial.status ?? 'active',
          reminderDays: Array.isArray(initial.reminder_days)
            ? initial.reminder_days.join(', ')
            : '',
          tags: Array.isArray(initial.tags) ? initial.tags.join(', ') : '',
          color: initial.color ?? '#64748B',
          icon: initial.icon ?? '',
          notes: initial.notes ?? '',
        });
      } else {
        setForm(defaultState);
      }
      setErrors({});
    }
  }, [open, initial]);

  const title = initial ? 'Edit Langganan' : 'Tambah Langganan';

  const categoryOptions = useMemo(
    () => [{ id: 'none', name: 'Tanpa kategori' }, ...categories],
    [categories],
  );
  const accountOptions = useMemo(
    () => [{ id: 'none', name: 'Tanpa akun' }, ...accounts],
    [accounts],
  );

  const handleChange = (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) {
      nextErrors.name = 'Nama wajib diisi';
    }
    const amountValue = Number.parseFloat(form.amount.replace(/\s+/g, ''));
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      nextErrors.amount = 'Nominal harus lebih besar dari 0';
    }
    if (!form.anchorDate) {
      nextErrors.anchorDate = 'Tanggal anchor wajib diisi';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const reminderDays = form.reminderDays
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value));

    const tags = form.tags
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    const payload: SubscriptionFormSubmitPayload = {
      id: initial?.id,
      name: form.name.trim(),
      vendor: form.vendor.trim() || undefined,
      category_id: form.categoryId !== 'none' ? form.categoryId : null,
      account_id: form.accountId !== 'none' ? form.accountId : null,
      amount: amountValue,
      currency: form.currency,
      interval_unit: form.intervalUnit,
      interval_count: form.intervalCount ? Number.parseInt(form.intervalCount, 10) || 1 : 1,
      anchor_date: form.anchorDate,
      anchor_day_of_week: form.intervalUnit === 'week' ? Number.parseInt(form.anchorDayOfWeek, 10) || 0 : undefined,
      start_date: form.startDate || form.anchorDate,
      end_date: form.endDate || undefined,
      trial_end: form.trialEnd || undefined,
      status: form.status,
      reminder_days: reminderDays,
      tags,
      color: form.color,
      icon: form.icon || undefined,
      notes: form.notes || undefined,
    };

    try {
      await onSubmit(payload);
    } catch (error) {
      if (error instanceof Error) {
        setErrors((prev) => ({ ...prev, submit: error.message }));
      } else {
        setErrors((prev) => ({ ...prev, submit: 'Gagal menyimpan. Cek koneksi atau ulangi.' }));
      }
    }
  };

  if (!open) return null;

  return (
    <div
      className="drawer-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="subscription-form-title"
      onClick={onClose}
    >
      <div
        className="drawer-panel w-full max-w-full sm:max-w-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="drawer-header">
          <div>
            <h2 id="subscription-form-title" className="text-lg font-semibold text-text">
              {title}
            </h2>
            <p className="text-xs text-muted">Atur detail langganan dan pengingat pembayaran.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label="Tutup form langganan"
          >
            ×
          </button>
        </header>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit} noValidate>
          <div className="drawer-body flex-1 min-h-0 overflow-y-auto">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <label htmlFor="subscription-name" className="text-xs font-medium uppercase tracking-wide text-muted">
                  Nama*
                </label>
                <input
                  id="subscription-name"
                  type="text"
                  value={form.name}
                  onChange={handleChange('name')}
                  className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-4 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                  required
                  aria-invalid={Boolean(errors.name)}
                />
                {errors.name && <p className="text-xs text-rose-500">{errors.name}</p>}
              </div>

              <div className="grid gap-2">
                <label htmlFor="subscription-vendor" className="text-xs font-medium uppercase tracking-wide text-muted">
                  Vendor
                </label>
                <input
                  id="subscription-vendor"
                  type="text"
                  value={form.vendor}
                  onChange={handleChange('vendor')}
                  className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-4 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="Contoh: Netflix"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label htmlFor="subscription-amount" className="text-xs font-medium uppercase tracking-wide text-muted">
                    Nominal*
                  </label>
                  <input
                    id="subscription-amount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.amount}
                    onChange={handleChange('amount')}
                    className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-4 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                    required
                    aria-invalid={Boolean(errors.amount)}
                  />
                  {errors.amount && <p className="text-xs text-rose-500">{errors.amount}</p>}
                </div>
                <div className="grid gap-2">
                  <label htmlFor="subscription-currency" className="text-xs font-medium uppercase tracking-wide text-muted">
                    Mata uang
                  </label>
                  <select
                    id="subscription-currency"
                    value={form.currency}
                    onChange={handleChange('currency')}
                    className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-4 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {currencyOptions.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label htmlFor="subscription-interval-unit" className="text-xs font-medium uppercase tracking-wide text-muted">
                    Interval
                  </label>
                  <select
                    id="subscription-interval-unit"
                    value={form.intervalUnit}
                    onChange={handleChange('intervalUnit')}
                    className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-4 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="day">Harian</option>
                    <option value="week">Mingguan</option>
                    <option value="month">Bulanan</option>
                    <option value="year">Tahunan</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <label htmlFor="subscription-interval-count" className="text-xs font-medium uppercase tracking-wide text-muted">
                    Setiap
                  </label>
                  <input
                    id="subscription-interval-count"
                    type="number"
                    min={1}
                    value={form.intervalCount}
                    onChange={handleChange('intervalCount')}
                    className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-4 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label htmlFor="subscription-anchor-date" className="text-xs font-medium uppercase tracking-wide text-muted">
                    Anchor date*
                  </label>
                  <input
                    id="subscription-anchor-date"
                    type="date"
                    value={form.anchorDate}
                    onChange={handleChange('anchorDate')}
                    className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-4 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                    required
                    aria-invalid={Boolean(errors.anchorDate)}
                  />
                  {errors.anchorDate && <p className="text-xs text-rose-500">{errors.anchorDate}</p>}
                </div>
                {form.intervalUnit === 'week' && (
                  <div className="grid gap-2">
                    <label htmlFor="subscription-anchor-weekday" className="text-xs font-medium uppercase tracking-wide text-muted">
                      Hari anchor
                    </label>
                    <select
                      id="subscription-anchor-weekday"
                      value={form.anchorDayOfWeek}
                      onChange={handleChange('anchorDayOfWeek')}
                      className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-4 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      {weekdayOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label htmlFor="subscription-start-date" className="text-xs font-medium uppercase tracking-wide text-muted">
                    Mulai aktif
                  </label>
                  <input
                    id="subscription-start-date"
                    type="date"
                    value={form.startDate}
                    onChange={handleChange('startDate')}
                    className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-4 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="subscription-end-date" className="text-xs font-medium uppercase tracking-wide text-muted">
                    Selesai pada
                  </label>
                  <input
                    id="subscription-end-date"
                    type="date"
                    value={form.endDate}
                    onChange={handleChange('endDate')}
                    className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-4 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <label htmlFor="subscription-trial-end" className="text-xs font-medium uppercase tracking-wide text-muted">
                  Trial berakhir
                </label>
                <input
                  id="subscription-trial-end"
                  type="date"
                  value={form.trialEnd}
                  onChange={handleChange('trialEnd')}
                  className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-4 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="subscription-status" className="text-xs font-medium uppercase tracking-wide text-muted">
                  Status
                </label>
                <select
                  id="subscription-status"
                  value={form.status}
                  onChange={handleChange('status')}
                  className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-4 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="active">Aktif</option>
                  <option value="paused">Paused</option>
                  <option value="canceled">Canceled</option>
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label htmlFor="subscription-category" className="text-xs font-medium uppercase tracking-wide text-muted">
                    Kategori
                  </label>
                  <select
                    id="subscription-category"
                    value={form.categoryId}
                    onChange={handleChange('categoryId')}
                    className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-4 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {categoryOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <label htmlFor="subscription-account" className="text-xs font-medium uppercase tracking-wide text-muted">
                    Akun pembayaran
                  </label>
                  <select
                    id="subscription-account"
                    value={form.accountId}
                    onChange={handleChange('accountId')}
                    className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-4 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {accountOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-2">
                <label htmlFor="subscription-reminder" className="text-xs font-medium uppercase tracking-wide text-muted">
                  Pengingat (hari sebelum due)
                </label>
                <input
                  id="subscription-reminder"
                  type="text"
                  value={form.reminderDays}
                  onChange={handleChange('reminderDays')}
                  placeholder="Contoh: 1,3,7"
                  className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-4 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="subscription-tags" className="text-xs font-medium uppercase tracking-wide text-muted">
                  Tag (pisahkan dengan koma)
                </label>
                <input
                  id="subscription-tags"
                  type="text"
                  value={form.tags}
                  onChange={handleChange('tags')}
                  className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-4 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label htmlFor="subscription-color" className="text-xs font-medium uppercase tracking-wide text-muted">
                    Warna
                  </label>
                  <input
                    id="subscription-color"
                    type="color"
                    value={form.color}
                    onChange={handleChange('color')}
                    className="h-11 w-full rounded-2xl border border-border bg-surface-2 p-2"
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="subscription-icon" className="text-xs font-medium uppercase tracking-wide text-muted">
                    Ikon (emoji)
                  </label>
                  <input
                    id="subscription-icon"
                    type="text"
                    value={form.icon}
                    onChange={handleChange('icon')}
                    maxLength={8}
                    className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-4 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="Contoh: 🎬"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <label htmlFor="subscription-notes" className="text-xs font-medium uppercase tracking-wide text-muted">
                  Catatan
                </label>
                <textarea
                  id="subscription-notes"
                  value={form.notes}
                  onChange={handleChange('notes')}
                  className="min-h-[120px] w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="Tambahkan detail atau syarat langganan"
                />
              </div>
              {errors.submit && <p className="text-sm text-rose-500">{errors.submit}</p>}
            </div>
          </div>
          <footer className="drawer-footer">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-2xl border border-border bg-surface-2 px-4 text-sm font-semibold text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-11 items-center rounded-2xl border border-primary bg-primary px-6 text-sm font-semibold text-white shadow focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
