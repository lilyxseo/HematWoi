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
  note: string;
  image_url: string;
}

interface WishlistFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialData?: WishlistItem | null;
  categories: CategoryOption[];
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: WishlistCreatePayload | (WishlistCreatePayload & { id?: string })) => Promise<void>;
}

const STATUS_OPTIONS: { value: WishlistStatus; label: string }[] = [
  { value: 'planned', label: 'Direncanakan' },
  { value: 'deferred', label: 'Ditunda' },
  { value: 'purchased', label: 'Dibeli' },
  { value: 'archived', label: 'Diarsipkan' },
];

const INPUT_CLASS =
  'h-11 w-full rounded-2xl border-none bg-slate-900/80 px-4 text-sm text-slate-100 ring-2 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60';

const TEXTAREA_CLASS =
  'w-full rounded-2xl border-none bg-slate-900/80 px-4 py-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60';

export default function WishlistFormDialog({
  open,
  mode,
  initialData,
  categories,
  submitting = false,
  onClose,
  onSubmit,
}: WishlistFormDialogProps) {
  const initialValues = useMemo<WishlistFormValues>(
    () => ({
      title: initialData?.title ?? '',
      estimated_price: initialData?.estimated_price != null ? String(initialData.estimated_price) : '',
      priority: initialData?.priority != null ? String(initialData.priority) : '',
      category_id: initialData?.category_id ?? '',
      store_url: initialData?.store_url ?? '',
      status: initialData?.status ?? 'planned',
      note: initialData?.note ?? '',
      image_url: initialData?.image_url ?? '',
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
    note: null,
    image_url: null,
  });

  useEffect(() => {
    if (open) {
      setValues(initialValues);
      setErrors({
        title: null,
        estimated_price: null,
        priority: null,
        category_id: null,
        store_url: null,
        status: null,
        note: null,
        image_url: null,
      });
    }
  }, [open, initialValues]);

  const setField = (field: keyof WishlistFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const validate = (): boolean => {
    let valid = true;
    const nextErrors: Record<keyof WishlistFormValues, string | null> = { ...errors };

    if (!values.title.trim()) {
      nextErrors.title = 'Judul wajib diisi.';
      valid = false;
    }

    if (values.estimated_price) {
      const numeric = Number(values.estimated_price);
      if (Number.isNaN(numeric) || numeric < 0) {
        nextErrors.estimated_price = 'Perkiraan harga harus angka positif.';
        valid = false;
      }
    }

    if (values.priority) {
      const numeric = Number(values.priority);
      if (!Number.isInteger(numeric) || numeric < 1 || numeric > 5) {
        nextErrors.priority = 'Prioritas harus 1 sampai 5.';
        valid = false;
      }
    }

    if (values.store_url) {
      try {
        // eslint-disable-next-line no-new
        new URL(values.store_url);
      } catch (error) {
        nextErrors.store_url = 'URL toko tidak valid.';
        valid = false;
      }
    }

    if (values.image_url) {
      try {
        // eslint-disable-next-line no-new
        new URL(values.image_url);
      } catch (error) {
        nextErrors.image_url = 'URL gambar tidak valid.';
        valid = false;
      }
    }

    setErrors(nextErrors);
    return valid;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;

    const payload: WishlistCreatePayload = {
      title: values.title.trim(),
      estimated_price: values.estimated_price ? Number(values.estimated_price) : null,
      priority: values.priority ? Number(values.priority) : null,
      category_id: values.category_id ? values.category_id : null,
      store_url: values.store_url.trim() || undefined,
      note: values.note.trim() || undefined,
      status: values.status,
      image_url: values.image_url.trim() || undefined,
    };

    await onSubmit(payload);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 px-4 py-10 backdrop-blur">
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/95 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.8)]">
        <form onSubmit={handleSubmit} className="flex max-h-[85vh] flex-col">
          <header className="flex items-start justify-between gap-3 border-b border-slate-800/70 bg-slate-950/80 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                {mode === 'create' ? 'Tambah Wishlist' : 'Edit Wishlist'}
              </h2>
              <p className="text-xs text-slate-400">Kelola item wishlist Anda dengan mudah.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label="Tutup form wishlist"
            >
              ✕
            </button>
          </header>
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200" htmlFor="wishlist-title">
                Judul*
              </label>
              <input
                id="wishlist-title"
                type="text"
                className={INPUT_CLASS}
                value={values.title}
                onChange={(event) => setField('title', event.target.value)}
                placeholder="Contoh: iPad Mini untuk belajar"
                required
                disabled={submitting}
              />
              {errors.title ? <p className="text-sm text-rose-300">{errors.title}</p> : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200" htmlFor="wishlist-price">
                  Perkiraan harga (Rp)
                </label>
                <input
                  id="wishlist-price"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  className={INPUT_CLASS}
                  value={values.estimated_price}
                  onChange={(event) => setField('estimated_price', event.target.value)}
                  placeholder="0"
                  disabled={submitting}
                />
                {errors.estimated_price ? <p className="text-sm text-rose-300">{errors.estimated_price}</p> : null}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200" htmlFor="wishlist-priority">
                  Prioritas (1-5)
                </label>
                <select
                  id="wishlist-priority"
                  className={INPUT_CLASS}
                  value={values.priority}
                  onChange={(event) => setField('priority', event.target.value)}
                  disabled={submitting}
                >
                  <option value="">Pilih prioritas</option>
                  <option value="1">1 - Mendesak</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5 - Nice to have</option>
                </select>
                {errors.priority ? <p className="text-sm text-rose-300">{errors.priority}</p> : null}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200" htmlFor="wishlist-category">
                  Kategori
                </label>
                <select
                  id="wishlist-category"
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
                {errors.category_id ? <p className="text-sm text-rose-300">{errors.category_id}</p> : null}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200" htmlFor="wishlist-status">
                  Status
                </label>
                <select
                  id="wishlist-status"
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
                {errors.status ? <p className="text-sm text-rose-300">{errors.status}</p> : null}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200" htmlFor="wishlist-store">
                  URL toko
                </label>
                <input
                  id="wishlist-store"
                  type="url"
                  className={INPUT_CLASS}
                  value={values.store_url}
                  onChange={(event) => setField('store_url', event.target.value)}
                  placeholder="https://"
                  disabled={submitting}
                />
                {errors.store_url ? <p className="text-sm text-rose-300">{errors.store_url}</p> : null}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200" htmlFor="wishlist-image">
                  URL gambar
                </label>
                <input
                  id="wishlist-image"
                  type="url"
                  className={INPUT_CLASS}
                  value={values.image_url}
                  onChange={(event) => setField('image_url', event.target.value)}
                  placeholder="https://"
                  disabled={submitting}
                />
                {errors.image_url ? <p className="text-sm text-rose-300">{errors.image_url}</p> : null}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200" htmlFor="wishlist-note">
                Catatan
              </label>
              <textarea
                id="wishlist-note"
                className={TEXTAREA_CLASS}
                rows={4}
                value={values.note}
                onChange={(event) => setField('note', event.target.value)}
                placeholder="Tambahkan catatan, alasan, atau rencana pembelian"
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
              {submitting ? 'Menyimpan…' : mode === 'create' ? 'Tambah Wishlist' : 'Simpan Perubahan'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
