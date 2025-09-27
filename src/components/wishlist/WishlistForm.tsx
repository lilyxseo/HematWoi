import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { WishlistCreatePayload, WishlistItem, WishlistStatus } from '../../lib/wishlistApi';

export interface CategoryOption {
  id: string;
  name: string;
}

interface WishlistFormProps {
  mode: 'create' | 'edit';
  initialData?: WishlistItem | null;
  categories: CategoryOption[];
  submitting?: boolean;
  errorMessage?: string | null;
  onSubmit: (payload: WishlistCreatePayload) => Promise<void> | void;
  onCancel: () => void;
}

interface WishlistFormValues {
  title: string;
  estimated_price: string;
  priority: string;
  category_id: string;
  store_url: string;
  status: WishlistStatus;
  image_url: string;
  note: string;
}

const STATUS_OPTIONS: { value: WishlistStatus; label: string }[] = [
  { value: 'planned', label: 'Direncanakan' },
  { value: 'deferred', label: 'Ditunda' },
  { value: 'purchased', label: 'Dibeli' },
  { value: 'archived', label: 'Diarsipkan' },
];

const PRIORITY_LEVELS = [1, 2, 3, 4, 5];

const INPUT_CLASS =
  'h-11 w-full rounded-2xl border-none bg-slate-950/80 px-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60';

const TEXTAREA_CLASS =
  'w-full rounded-2xl border-none bg-slate-950/80 px-3 py-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60';

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={className}
    >
      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <path strokeLinecap="round" d="M6 6l12 12M18 6l-12 12" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={className}
    >
      <path
        d="M21 12a9 9 0 10-3.51 7.09"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-40"
      />
      <path d="M21 12a9 9 0 00-9-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function isValidUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (error) {
    return false;
  }
}

export default function WishlistForm({
  mode,
  initialData,
  categories,
  submitting = false,
  errorMessage,
  onSubmit,
  onCancel,
}: WishlistFormProps) {
  const initialValues = useMemo<WishlistFormValues>(
    () => ({
      title: initialData?.title ?? '',
      estimated_price:
        initialData?.estimated_price != null ? String(Number(initialData.estimated_price.toFixed(2))) : '',
      priority: initialData?.priority != null ? String(initialData.priority) : '',
      category_id: initialData?.category_id ?? '',
      store_url: initialData?.store_url ?? '',
      status: initialData?.status ?? 'planned',
      image_url: initialData?.image_url ?? '',
      note: initialData?.note ?? '',
    }),
    [initialData]
  );

  const [values, setValues] = useState<WishlistFormValues>(initialValues);
  const [errors, setErrors] = useState<Record<keyof WishlistFormValues, string | null>>({
    title: null,
    estimated_price: null,
    priority: null,
    category_id: null,
    store_url: null,
    status: null,
    image_url: null,
    note: null,
  });

  useEffect(() => {
    setValues(initialValues);
    setErrors({
      title: null,
      estimated_price: null,
      priority: null,
      category_id: null,
      store_url: null,
      status: null,
      image_url: null,
      note: null,
    });
  }, [initialValues]);

  const setField = (field: keyof WishlistFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const validate = () => {
    const nextErrors: typeof errors = {
      title: null,
      estimated_price: null,
      priority: null,
      category_id: null,
      store_url: null,
      status: null,
      image_url: null,
      note: null,
    };
    let valid = true;

    if (!values.title.trim()) {
      nextErrors.title = 'Judul wajib diisi.';
      valid = false;
    }

    if (values.estimated_price.trim()) {
      const numeric = Number(values.estimated_price);
      if (Number.isNaN(numeric) || numeric < 0) {
        nextErrors.estimated_price = 'Perkiraan harga harus lebih dari atau sama dengan 0.';
        valid = false;
      }
    }

    if (values.priority.trim()) {
      const numeric = Number(values.priority);
      if (!Number.isInteger(numeric) || numeric < 1 || numeric > 5) {
        nextErrors.priority = 'Prioritas harus antara 1 sampai 5.';
        valid = false;
      }
    }

    if (values.store_url.trim() && !isValidUrl(values.store_url)) {
      nextErrors.store_url = 'URL toko harus diawali http atau https.';
      valid = false;
    }

    if (values.image_url.trim() && !isValidUrl(values.image_url)) {
      nextErrors.image_url = 'URL gambar harus diawali http atau https.';
      valid = false;
    }

    setErrors(nextErrors);
    return valid;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;

    const payload: WishlistCreatePayload = {
      title: values.title.trim(),
      estimated_price: values.estimated_price.trim() ? Number(values.estimated_price) : null,
      priority: values.priority.trim() ? Number(values.priority) : null,
      category_id: values.category_id.trim() ? values.category_id : null,
      store_url: values.store_url.trim() ? values.store_url.trim() : undefined,
      status: values.status,
      image_url: values.image_url.trim() ? values.image_url.trim() : undefined,
      note: values.note.trim() ? values.note.trim() : undefined,
    };

    await onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="flex max-h-[90vh] w-full flex-col" noValidate>
      <header className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)]">
          <PlusIcon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 id="wishlist-form-title" className="text-lg font-semibold text-slate-100">
            {mode === 'create' ? 'Tambah Wishlist' : 'Edit Wishlist'}
          </h2>
          <p className="text-sm text-slate-400">
            Simpan ide belanja agar mudah diprioritaskan dan diwujudkan kapan saja.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          aria-label="Tutup form wishlist"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-200" htmlFor="wishlist-field-title">
            Judul*
          </label>
          <input
            id="wishlist-field-title"
            type="text"
            className={INPUT_CLASS}
            value={values.title}
            onChange={(event) => setField('title', event.target.value)}
            placeholder="Contoh: iPad Mini untuk belajar"
            disabled={submitting}
            required
          />
          {errors.title ? <p className="text-xs text-rose-300">{errors.title}</p> : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200" htmlFor="wishlist-field-price">
              Perkiraan Harga
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                Rp
              </span>
              <input
                id="wishlist-field-price"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className={`${INPUT_CLASS} pl-9`}
                value={values.estimated_price}
                onChange={(event) => setField('estimated_price', event.target.value)}
                placeholder="0"
                disabled={submitting}
              />
            </div>
            {errors.estimated_price ? <p className="text-xs text-rose-300">{errors.estimated_price}</p> : null}
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Prioritas (1–5)</span>
            <div
              role="radiogroup"
              aria-label="Prioritas wishlist"
              className="flex items-center gap-2"
            >
              {PRIORITY_LEVELS.map((level) => {
                const active = values.priority === String(level);
                return (
                  <button
                    key={level}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() =>
                      setField('priority', active ? '' : String(level))
                    }
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-semibold transition ${
                      active
                        ? 'bg-[var(--accent)] text-white shadow-lg'
                        : 'bg-slate-950/70 text-slate-300 ring-2 ring-slate-800 hover:text-slate-100'
                    } ${submitting ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                    disabled={submitting}
                  >
                    {level}
                  </button>
                );
              })}
            </div>
            {errors.priority ? <p className="text-xs text-rose-300">{errors.priority}</p> : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200" htmlFor="wishlist-field-category">
              Kategori
            </label>
            <select
              id="wishlist-field-category"
              className={INPUT_CLASS}
              value={values.category_id}
              onChange={(event) => setField('category_id', event.target.value)}
              disabled={submitting}
            >
              <option value="">Tanpa kategori</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200" htmlFor="wishlist-field-status">
              Status
            </label>
            <select
              id="wishlist-field-status"
              className={INPUT_CLASS}
              value={values.status}
              onChange={(event) => setField('status', event.target.value)}
              disabled={submitting}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200" htmlFor="wishlist-field-store">
              URL Toko
            </label>
            <input
              id="wishlist-field-store"
              type="url"
              className={INPUT_CLASS}
              value={values.store_url}
              onChange={(event) => setField('store_url', event.target.value)}
              placeholder="https://"
              disabled={submitting}
            />
            {errors.store_url ? <p className="text-xs text-rose-300">{errors.store_url}</p> : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200" htmlFor="wishlist-field-image">
              URL Gambar
            </label>
            <input
              id="wishlist-field-image"
              type="url"
              className={INPUT_CLASS}
              value={values.image_url}
              onChange={(event) => setField('image_url', event.target.value)}
              placeholder="https://"
              disabled={submitting}
            />
            {errors.image_url ? <p className="text-xs text-rose-300">{errors.image_url}</p> : null}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-200" htmlFor="wishlist-field-note">
            Catatan
          </label>
          <textarea
            id="wishlist-field-note"
            className={TEXTAREA_CLASS}
            rows={4}
            value={values.note}
            onChange={(event) => setField('note', event.target.value)}
            placeholder="Tambahkan catatan, alasan, atau rencana pembelian"
            disabled={submitting}
          />
        </div>
      </div>

      {errorMessage ? (
        <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </div>
      ) : null}

      <footer className="mt-5 flex flex-col gap-3 border-t border-slate-800/80 pt-4 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
        <div className="text-xs text-slate-500">Pastikan data sudah benar sebelum disimpan.</div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-slate-300 transition hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
          >
            Batal
          </button>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-70"
            disabled={submitting}
          >
            {submitting ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : null}
            {submitting ? 'Menyimpan…' : mode === 'create' ? 'Simpan Wishlist' : 'Perbarui Wishlist'}
          </button>
        </div>
      </footer>

    </form>
  );
}
