import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { WishlistCreatePayload, WishlistItem, WishlistStatus } from '../../lib/wishlistApi';

export interface CategoryOption {
  id: string;
  name: string;
}

interface WishlistFormProps {
  mode: 'create' | 'edit';
  initialData: WishlistItem | null;
  categories: CategoryOption[];
  submitting?: boolean;
  serverError?: string | null;
  onCancel: () => void;
  onSubmit: (payload: WishlistCreatePayload) => Promise<void>;
}

const STATUS_OPTIONS: { value: WishlistStatus; label: string }[] = [
  { value: 'planned', label: 'Direncanakan' },
  { value: 'deferred', label: 'Ditunda' },
  { value: 'purchased', label: 'Dibeli' },
  { value: 'archived', label: 'Diarsipkan' },
];

interface FormState {
  title: string;
  estimated_price: string;
  priority: string;
  category_id: string;
  store_url: string;
  status: WishlistStatus;
  image_url: string;
  note: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

const INPUT_CLASS =
  'h-11 w-full rounded-2xl bg-slate-950 text-sm text-slate-100 ring-2 ring-slate-800 transition placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60 px-3';

const TEXTAREA_CLASS =
  'w-full rounded-2xl bg-slate-950 text-sm text-slate-100 ring-2 ring-slate-800 transition placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60 px-3 py-3';

function validateHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch (error) {
    return false;
  }
}

export default function WishlistForm({
  mode,
  initialData,
  categories,
  submitting = false,
  serverError,
  onCancel,
  onSubmit,
}: WishlistFormProps) {
  const initialState = useMemo<FormState>(
    () => ({
      title: initialData?.title ?? '',
      estimated_price: initialData?.estimated_price != null ? String(initialData.estimated_price) : '',
      priority: initialData?.priority != null ? String(initialData.priority) : '',
      category_id: initialData?.category_id ?? '',
      store_url: initialData?.store_url ?? '',
      status: initialData?.status ?? 'planned',
      image_url: initialData?.image_url ?? '',
      note: initialData?.note ?? '',
    }),
    [initialData]
  );

  const [values, setValues] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setValues(initialState);
    setErrors({});
    setSubmitError(null);
  }, [initialState]);

  useEffect(() => {
    if (serverError) {
      setSubmitError(serverError);
    }
  }, [serverError]);

  const updateField = <Key extends keyof FormState>(key: Key, value: FormState[Key]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    if (submitError) setSubmitError(null);
  };

  const validate = (): boolean => {
    const nextErrors: FormErrors = {};
    if (!values.title.trim()) {
      nextErrors.title = 'Judul wajib diisi.';
    }

    if (values.estimated_price) {
      const numeric = Number(values.estimated_price);
      if (Number.isNaN(numeric) || numeric < 0) {
        nextErrors.estimated_price = 'Harga harus angka ≥ 0.';
      }
    }

    if (values.priority) {
      const numeric = Number(values.priority);
      if (!Number.isInteger(numeric) || numeric < 1 || numeric > 5) {
        nextErrors.priority = 'Prioritas harus 1 sampai 5.';
      }
    }

    if (values.store_url) {
      if (!validateHttpUrl(values.store_url)) {
        nextErrors.store_url = 'Gunakan URL http(s) yang valid.';
      }
    }

    if (values.image_url) {
      if (!validateHttpUrl(values.image_url)) {
        nextErrors.image_url = 'Gunakan URL http(s) yang valid.';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;

    const payload: WishlistCreatePayload = {
      title: values.title.trim(),
      estimated_price: values.estimated_price ? Number(values.estimated_price) : null,
      priority: values.priority ? Number(values.priority) : null,
      category_id: values.category_id ? values.category_id : null,
      store_url: values.store_url ? values.store_url.trim() : undefined,
      status: values.status,
      image_url: values.image_url ? values.image_url.trim() : undefined,
      note: values.note ? values.note.trim() : undefined,
    };

    try {
      await onSubmit(payload);
      setSubmitError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menyimpan wishlist.';
      setSubmitError(message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex max-h-[85vh] w-full flex-col overflow-hidden">
      <header className="flex items-start gap-3 pb-4">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)]/20 text-[var(--accent)]">
          <PlusIcon />
        </span>
        <div className="flex-1">
          <h2 id="wishlist-form-title" className="text-xl font-semibold text-slate-100">
            {mode === 'create' ? 'Tambah Wishlist' : 'Edit Wishlist'}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Simpan ide belanja dan pantau prioritasnya sebelum jadi goal.
          </p>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        <div className="space-y-2">
          <label htmlFor="wishlist-title" className="text-sm font-medium text-slate-200">
            Judul*
          </label>
          <input
            id="wishlist-title"
            type="text"
            className={INPUT_CLASS}
            placeholder="Contoh: Laptop kerja remote"
            value={values.title}
            onChange={(event) => updateField('title', event.target.value)}
            disabled={submitting}
            required
          />
          {errors.title ? <p className="text-sm text-rose-300">{errors.title}</p> : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="wishlist-price" className="text-sm font-medium text-slate-200">
              Perkiraan harga
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                Rp
              </span>
              <input
                id="wishlist-price"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                className={`${INPUT_CLASS} pl-9`}
                placeholder="0"
                value={values.estimated_price}
                onChange={(event) => updateField('estimated_price', event.target.value)}
                disabled={submitting}
              />
            </div>
            {errors.estimated_price ? <p className="text-sm text-rose-300">{errors.estimated_price}</p> : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">Prioritas</label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((priority) => {
                const active = values.priority === String(priority);
                return (
                  <button
                    key={priority}
                    type="button"
                    onClick={() =>
                      updateField('priority', active ? '' : String(priority))
                    }
                    className={`inline-flex h-11 min-w-[3rem] flex-1 items-center justify-center rounded-2xl border text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                      active
                        ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]'
                        : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-[var(--accent)]/60 hover:text-[var(--accent)]'
                    }`}
                    aria-pressed={active}
                    disabled={submitting}
                  >
                    {priority}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => updateField('priority', '')}
                className={`inline-flex h-11 flex-1 items-center justify-center rounded-2xl border text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                  values.priority === ''
                    ? 'border-[var(--accent)]/40 bg-slate-950 text-slate-200'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-[var(--accent)]/60 hover:text-[var(--accent)]'
                }`}
                disabled={submitting}
              >
                Kosongkan
              </button>
            </div>
            {errors.priority ? <p className="text-sm text-rose-300">{errors.priority}</p> : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="wishlist-category" className="text-sm font-medium text-slate-200">
              Kategori
            </label>
            <select
              id="wishlist-category"
              className={INPUT_CLASS}
              value={values.category_id}
              onChange={(event) => updateField('category_id', event.target.value)}
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
            <label htmlFor="wishlist-status" className="text-sm font-medium text-slate-200">
              Status
            </label>
            <select
              id="wishlist-status"
              className={INPUT_CLASS}
              value={values.status}
              onChange={(event) => updateField('status', event.target.value as WishlistStatus)}
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
            <label htmlFor="wishlist-store" className="text-sm font-medium text-slate-200">
              URL toko
            </label>
            <input
              id="wishlist-store"
              type="url"
              className={INPUT_CLASS}
              placeholder="https://"
              value={values.store_url}
              onChange={(event) => updateField('store_url', event.target.value)}
              disabled={submitting}
            />
            {errors.store_url ? <p className="text-sm text-rose-300">{errors.store_url}</p> : null}
          </div>
          <div className="space-y-2">
            <label htmlFor="wishlist-image" className="text-sm font-medium text-slate-200">
              URL gambar
            </label>
            <input
              id="wishlist-image"
              type="url"
              className={INPUT_CLASS}
              placeholder="https://"
              value={values.image_url}
              onChange={(event) => updateField('image_url', event.target.value)}
              disabled={submitting}
            />
            {errors.image_url ? <p className="text-sm text-rose-300">{errors.image_url}</p> : null}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="wishlist-note" className="text-sm font-medium text-slate-200">
            Catatan
          </label>
          <textarea
            id="wishlist-note"
            className={TEXTAREA_CLASS}
            rows={4}
            placeholder="Tuliskan catatan atau alasan kenapa ingin item ini."
            value={values.note}
            onChange={(event) => updateField('note', event.target.value)}
            disabled={submitting}
          />
        </div>
      </div>

      <footer className="mt-5 flex flex-col gap-3 border-t border-slate-800 pt-4 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
        <p className="text-xs md:text-sm">Data tersimpan otomatis di akun Supabase Anda.</p>
        <div className="flex flex-wrap items-center gap-2">
          {submitError ? (
            <div className="flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-200 ring-1 ring-red-500/30">
              <AlertIcon /> {submitError}
            </div>
          ) : null}
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-slate-200 transition hover:bg-slate-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            disabled={submitting}
          >
            Batal
          </button>
          <button
            type="submit"
            className="inline-flex h-11 min-w-[120px] items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed"
            disabled={submitting}
          >
            {submitting ? (
              <SpinnerIcon />
            ) : (
              <span>Simpan</span>
            )}
          </button>
        </div>
      </footer>
    </form>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5">
      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v4m0 4h.01M10.402 4.527 2.633 17.01A1 1 0 0 0 3.5 18.5h16.999a1 1 0 0 0 .866-1.492L13.598 4.527a1 1 0 0 0-1.732 0z"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 animate-spin text-white" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        strokeOpacity="0.25"
        fill="none"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
