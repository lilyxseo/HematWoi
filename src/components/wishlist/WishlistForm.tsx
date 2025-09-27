import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { WishlistCreatePayload, WishlistItem, WishlistStatus } from '../../lib/wishlistApi';

interface CategoryOption {
  id: string;
  name: string;
}

export interface WishlistFormValues {
  title: string;
  estimated_price: string;
  priority: string;
  category_id: string;
  store_url: string;
  status: WishlistStatus;
  image_url: string;
  note: string;
}

interface WishlistFormProps {
  mode: 'create' | 'edit';
  categories: CategoryOption[];
  initialData?: WishlistItem | null;
  submitting?: boolean;
  errorMessage?: string | null;
  onSubmit: (payload: WishlistCreatePayload) => Promise<void> | void;
  onCancel: () => void;
}

const STATUS_OPTIONS: { value: WishlistStatus; label: string }[] = [
  { value: 'planned', label: 'Direncanakan' },
  { value: 'deferred', label: 'Ditunda' },
  { value: 'purchased', label: 'Dibeli' },
  { value: 'archived', label: 'Diarsipkan' },
];

const INPUT_BASE_CLASS =
  'h-11 w-full rounded-2xl bg-slate-950 text-slate-100 px-3 ring-2 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60';

const TEXTAREA_CLASS =
  'w-full rounded-2xl bg-slate-950 text-slate-100 px-3 py-3 ring-2 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60';

export default function WishlistForm({
  mode,
  categories,
  initialData,
  submitting = false,
  errorMessage,
  onSubmit,
  onCancel,
}: WishlistFormProps) {
  const initialValues = useMemo<WishlistFormValues>(
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

  const [values, setValues] = useState<WishlistFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<Record<keyof WishlistFormValues, string | null>>({
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
    setFieldErrors({
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

  const setFieldValue = (field: keyof WishlistFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: null }));
  };

  const validate = (): boolean => {
    let valid = true;
    const nextErrors: Record<keyof WishlistFormValues, string | null> = {
      title: null,
      estimated_price: null,
      priority: null,
      category_id: null,
      store_url: null,
      status: null,
      image_url: null,
      note: null,
    };

    if (!values.title.trim()) {
      nextErrors.title = 'Judul wajib diisi.';
      valid = false;
    }

    if (values.estimated_price) {
      const numeric = Number(values.estimated_price);
      if (Number.isNaN(numeric) || numeric < 0) {
        nextErrors.estimated_price = 'Perkiraan harga harus lebih besar atau sama dengan 0.';
        valid = false;
      }
    }

    if (values.priority) {
      const numeric = Number(values.priority);
      if (!Number.isInteger(numeric) || numeric < 1 || numeric > 5) {
        nextErrors.priority = 'Prioritas harus antara 1 hingga 5.';
        valid = false;
      }
    }

    if (values.store_url) {
      try {
        const url = new URL(values.store_url);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          throw new Error('invalid');
        }
      } catch (error) {
        nextErrors.store_url = 'URL toko harus diawali http atau https.';
        valid = false;
      }
    }

    if (values.image_url) {
      try {
        const url = new URL(values.image_url);
        if (!url.protocol.startsWith('http')) {
          throw new Error('invalid');
        }
      } catch (error) {
        nextErrors.image_url = 'URL gambar tidak valid.';
        valid = false;
      }
    }

    setFieldErrors(nextErrors);
    return valid;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (!validate()) return;

    const payload: WishlistCreatePayload = {
      title: values.title.trim(),
      estimated_price: values.estimated_price ? Number(values.estimated_price) : null,
      priority: values.priority ? Number(values.priority) : null,
      category_id: values.category_id ? values.category_id : null,
      store_url: values.store_url.trim() ? values.store_url.trim() : undefined,
      note: values.note.trim() ? values.note.trim() : undefined,
      status: values.status,
      image_url: values.image_url.trim() ? values.image_url.trim() : undefined,
    };

    await onSubmit(payload);
  };

  const renderPriorityButtons = () => {
    return (
      <div className="flex gap-2">
        {([1, 2, 3, 4, 5] as const).map((value) => {
          const active = values.priority === String(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => setFieldValue('priority', active ? '' : String(value))}
              className={`flex h-11 flex-1 items-center justify-center rounded-2xl border border-slate-800 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                active ? 'bg-[var(--accent)]/90 text-white border-transparent' : 'bg-slate-950 text-slate-300 hover:border-[var(--accent)]/60'
              }`}
              disabled={submitting}
            >
              {value}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-100" htmlFor="wishlist-title">
            Judul*
          </label>
          <input
            id="wishlist-title"
            type="text"
            value={values.title}
            onChange={(event) => setFieldValue('title', event.target.value)}
            className={`${INPUT_BASE_CLASS}`}
            placeholder="Contoh: Tablet untuk membaca buku"
            required
            disabled={submitting}
          />
          {fieldErrors.title ? (
            <p className="text-xs text-rose-300">{fieldErrors.title}</p>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-100" htmlFor="wishlist-estimated-price">
              Perkiraan harga
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-500">Rp</span>
              <input
                id="wishlist-estimated-price"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={values.estimated_price}
                onChange={(event) => setFieldValue('estimated_price', event.target.value)}
                className={`${INPUT_BASE_CLASS} pl-10`}
                placeholder="0"
                disabled={submitting}
              />
            </div>
            {fieldErrors.estimated_price ? (
              <p className="text-xs text-rose-300">{fieldErrors.estimated_price}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium text-slate-100">Prioritas (1–5)</span>
            {renderPriorityButtons()}
            {fieldErrors.priority ? (
              <p className="text-xs text-rose-300">{fieldErrors.priority}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-100" htmlFor="wishlist-category">
              Kategori
            </label>
            <select
              id="wishlist-category"
              value={values.category_id}
              onChange={(event) => setFieldValue('category_id', event.target.value)}
              className={`${INPUT_BASE_CLASS}`}
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
            <label className="text-sm font-medium text-slate-100" htmlFor="wishlist-store-url">
              URL toko
            </label>
            <input
              id="wishlist-store-url"
              type="url"
              value={values.store_url}
              onChange={(event) => setFieldValue('store_url', event.target.value)}
              className={`${INPUT_BASE_CLASS}`}
              placeholder="https://contoh.toko"
              disabled={submitting}
            />
            {fieldErrors.store_url ? (
              <p className="text-xs text-rose-300">{fieldErrors.store_url}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-100" htmlFor="wishlist-status">
              Status
            </label>
            <select
              id="wishlist-status"
              value={values.status}
              onChange={(event) => setFieldValue('status', event.target.value)}
              className={`${INPUT_BASE_CLASS}`}
              disabled={submitting}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-100" htmlFor="wishlist-image-url">
              URL gambar
            </label>
            <input
              id="wishlist-image-url"
              type="url"
              value={values.image_url}
              onChange={(event) => setFieldValue('image_url', event.target.value)}
              className={`${INPUT_BASE_CLASS}`}
              placeholder="https://contoh.gambar"
              disabled={submitting}
            />
            {fieldErrors.image_url ? (
              <p className="text-xs text-rose-300">{fieldErrors.image_url}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-100" htmlFor="wishlist-note">
            Catatan
          </label>
          <textarea
            id="wishlist-note"
            rows={4}
            value={values.note}
            onChange={(event) => setFieldValue('note', event.target.value)}
            className={TEXTAREA_CLASS}
            placeholder="Tuliskan detail tambahan untuk wishlist ini"
            disabled={submitting}
          />
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-500/30">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-xs text-slate-500">
          {mode === 'create'
            ? 'Tambahkan item wishlist baru dan atur prioritasnya.'
            : 'Perbarui detail wishlist sesuai kebutuhan Anda.'}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-medium text-slate-300 transition hover:bg-slate-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            disabled={submitting}
          >
            Batal
          </button>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-80"
            disabled={submitting}
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" aria-hidden="true" />
                Menyimpan…
              </span>
            ) : (
              'Simpan'
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
