import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { WishlistItem, WishlistItemPayload, WishlistStatus } from '../../lib/wishlistApi';

interface CategoryOption {
  id: string;
  name: string;
}

interface WishlistFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialData?: WishlistItem | null;
  categories: CategoryOption[];
  submitting?: boolean;
  onSubmit: (payload: WishlistItemPayload) => Promise<void> | void;
  onClose: () => void;
}

interface FieldErrors {
  [key: string]: string | undefined;
}

interface FormValues {
  title: string;
  estimated_price: string;
  priority: string;
  category_id: string;
  store_url: string;
  status: WishlistStatus;
  note: string;
  image_url: string;
}

const STATUS_OPTIONS: { value: WishlistStatus; label: string }[] = [
  { value: 'planned', label: 'Direncanakan' },
  { value: 'deferred', label: 'Ditunda' },
  { value: 'purchased', label: 'Dibeli' },
  { value: 'archived', label: 'Diarsipkan' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'Tanpa prioritas' },
  { value: '1', label: 'Prioritas 1' },
  { value: '2', label: 'Prioritas 2' },
  { value: '3', label: 'Prioritas 3' },
  { value: '4', label: 'Prioritas 4' },
  { value: '5', label: 'Prioritas 5' },
];

function buildDefaultValues(initial?: WishlistItem | null): FormValues {
  if (!initial) {
    return {
      title: '',
      estimated_price: '',
      priority: '',
      category_id: '',
      store_url: '',
      status: 'planned',
      note: '',
      image_url: '',
    };
  }
  return {
    title: initial.title ?? '',
    estimated_price: initial.estimated_price != null ? String(initial.estimated_price) : '',
    priority: initial.priority != null ? String(initial.priority) : '',
    category_id: initial.category_id ?? '',
    store_url: initial.store_url ?? '',
    status: initial.status,
    note: initial.note ?? '',
    image_url: initial.image_url ?? '',
  };
}

function isValidUrl(value: string) {
  if (!value) return true;
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return true;
  } catch (error) {
    return false;
  }
}

export default function WishlistFormDialog({
  open,
  mode,
  initialData = null,
  categories,
  submitting = false,
  onSubmit,
  onClose,
}: WishlistFormDialogProps) {
  const [values, setValues] = useState<FormValues>(() => buildDefaultValues(initialData));
  const [errors, setErrors] = useState<FieldErrors>({});
  const titleRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setValues(buildDefaultValues(initialData));
      setErrors({});
    }
  }, [open, initialData]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => titleRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  const categoryOptions = useMemo(() => categories ?? [], [categories]);

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const validate = (): FieldErrors => {
    const nextErrors: FieldErrors = {};
    if (!values.title.trim()) {
      nextErrors.title = 'Judul wajib diisi.';
    }
    if (values.estimated_price) {
      const price = Number(values.estimated_price);
      if (!Number.isFinite(price) || price < 0) {
        nextErrors.estimated_price = 'Harga harus angka positif.';
      }
    }
    if (values.priority) {
      const priorityValue = Number(values.priority);
      if (!Number.isInteger(priorityValue) || priorityValue < 1 || priorityValue > 5) {
        nextErrors.priority = 'Prioritas harus antara 1-5.';
      }
    }
    if (values.store_url && !isValidUrl(values.store_url)) {
      nextErrors.store_url = 'URL toko tidak valid.';
    }
    return nextErrors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const payload: WishlistItemPayload = {
      title: values.title.trim(),
      estimated_price: values.estimated_price ? Number(values.estimated_price) : null,
      priority: values.priority ? Number(values.priority) : null,
      category_id: values.category_id ? values.category_id : null,
      store_url: values.store_url ? values.store_url : null,
      status: values.status,
      note: values.note ? values.note : null,
      image_url: values.image_url ? values.image_url : null,
    };

    await onSubmit(payload);
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {mode === 'edit' ? 'Edit Wishlist' : 'Tambah Wishlist'}
            </h2>
            <p className="text-sm text-muted">Kelola detail wishlist kamu sebelum komit membeli.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup form wishlist"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-muted transition hover:border-slate-700 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="flex flex-col gap-1 text-sm font-medium text-text">
              Judul*
              <input
                ref={titleRef}
                name="title"
                value={values.title}
                onChange={handleChange}
                required
                minLength={2}
                aria-invalid={Boolean(errors.title)}
                aria-describedby={errors.title ? 'wishlist-title-error' : undefined}
                className="h-[44px] w-full rounded-2xl border border-slate-800 bg-transparent px-3 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
              />
            </label>
            {errors.title ? (
              <p id="wishlist-title-error" className="mt-1 text-xs text-rose-300">
                {errors.title}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="flex flex-col gap-1 text-sm font-medium text-text">
                Estimasi harga (Rp)
                <input
                  type="number"
                  name="estimated_price"
                  min={0}
                  step="0.01"
                  value={values.estimated_price}
                  onChange={handleChange}
                  aria-invalid={Boolean(errors.estimated_price)}
                  aria-describedby={errors.estimated_price ? 'wishlist-price-error' : undefined}
                  className="h-[44px] w-full rounded-2xl border border-slate-800 bg-transparent px-3 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
                />
              </label>
              {errors.estimated_price ? (
                <p id="wishlist-price-error" className="mt-1 text-xs text-rose-300">
                  {errors.estimated_price}
                </p>
              ) : null}
            </div>

            <div>
              <label className="flex flex-col gap-1 text-sm font-medium text-text">
                Prioritas
                <select
                  name="priority"
                  value={values.priority}
                  onChange={handleChange}
                  aria-invalid={Boolean(errors.priority)}
                  aria-describedby={errors.priority ? 'wishlist-priority-error' : undefined}
                  className="h-[44px] w-full rounded-2xl border border-slate-800 bg-transparent px-3 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {errors.priority ? (
                <p id="wishlist-priority-error" className="mt-1 text-xs text-rose-300">
                  {errors.priority}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="flex flex-col gap-1 text-sm font-medium text-text">
                Kategori
                <select
                  name="category_id"
                  value={values.category_id}
                  onChange={handleChange}
                  className="h-[44px] w-full rounded-2xl border border-slate-800 bg-transparent px-3 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
                >
                  <option value="">Tanpa kategori</option>
                  {categoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <label className="flex flex-col gap-1 text-sm font-medium text-text">
                Status
                <select
                  name="status"
                  value={values.status}
                  onChange={handleChange}
                  className="h-[44px] w-full rounded-2xl border border-slate-800 bg-transparent px-3 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="flex flex-col gap-1 text-sm font-medium text-text">
                URL toko
                <input
                  type="url"
                  name="store_url"
                  placeholder="https://"
                  value={values.store_url}
                  onChange={handleChange}
                  aria-invalid={Boolean(errors.store_url)}
                  aria-describedby={errors.store_url ? 'wishlist-store-url-error' : undefined}
                  className="h-[44px] w-full rounded-2xl border border-slate-800 bg-transparent px-3 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
                />
              </label>
              {errors.store_url ? (
                <p id="wishlist-store-url-error" className="mt-1 text-xs text-rose-300">
                  {errors.store_url}
                </p>
              ) : null}
            </div>

            <div>
              <label className="flex flex-col gap-1 text-sm font-medium text-text">
                URL gambar
                <input
                  type="url"
                  name="image_url"
                  placeholder="https://"
                  value={values.image_url}
                  onChange={handleChange}
                  className="h-[44px] w-full rounded-2xl border border-slate-800 bg-transparent px-3 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
                />
              </label>
            </div>
          </div>

          <div>
            <label className="flex flex-col gap-1 text-sm font-medium text-text">
              Catatan
              <textarea
                name="note"
                rows={4}
                value={values.note}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-800 bg-transparent px-3 py-3 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
              />
            </label>
          </div>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-[44px] items-center justify-center rounded-2xl border border-slate-800 px-5 text-sm font-medium text-muted transition hover:border-[color:var(--accent)] hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
            >
              Batal
            </button>
            <button
              type="submit"
              className="inline-flex h-[44px] items-center justify-center rounded-2xl bg-[color:var(--accent)] px-5 text-sm font-semibold text-slate-950 transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? 'Menyimpan…' : mode === 'edit' ? 'Simpan Perubahan' : 'Tambah Wishlist'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
