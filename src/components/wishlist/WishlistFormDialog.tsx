import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import Modal from '../Modal.jsx';
import type { WishlistCreatePayload, WishlistItem, WishlistStatus } from '../../lib/wishlistApi';

interface WishlistFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialItem?: WishlistItem | null;
  categories: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSubmit: (payload: WishlistCreatePayload) => Promise<void> | void;
  submitting?: boolean;
}

type FormState = {
  title: string;
  estimated_price: string;
  priority: string;
  category_id: string;
  store_url: string;
  status: WishlistStatus;
  note: string;
  image_url: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const inputClassName =
  'h-11 w-full rounded-2xl border-none bg-slate-900 px-4 text-sm text-slate-100 ring-2 ring-slate-800 transition focus:outline-none focus:ring-[var(--accent)] placeholder:text-slate-500';

const textareaClassName =
  'min-h-[120px] w-full rounded-2xl border-none bg-slate-900 px-4 py-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus:outline-none focus:ring-[var(--accent)] placeholder:text-slate-500';

const statusOptions: Array<{ value: WishlistStatus; label: string }> = [
  { value: 'planned', label: 'Direncanakan' },
  { value: 'deferred', label: 'Ditunda' },
  { value: 'purchased', label: 'Dibeli' },
  { value: 'archived', label: 'Arsip' },
];

function createInitialState(item?: WishlistItem | null): FormState {
  return {
    title: item?.title ?? '',
    estimated_price:
      typeof item?.estimated_price === 'number' && Number.isFinite(item.estimated_price)
        ? String(item.estimated_price)
        : '',
    priority: item?.priority ? String(item.priority) : '',
    category_id: item?.category_id ?? '',
    store_url: item?.store_url ?? '',
    status: item?.status ?? 'planned',
    note: item?.note ?? '',
    image_url: item?.image_url ?? '',
  };
}

function validate(values: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!values.title.trim()) {
    errors.title = 'Judul wajib diisi.';
  }

  if (values.estimated_price) {
    const numeric = Number(values.estimated_price);
    if (!Number.isFinite(numeric) || numeric < 0) {
      errors.estimated_price = 'Harga harus angka positif.';
    }
  }

  if (values.priority) {
    const numeric = Number(values.priority);
    if (!Number.isFinite(numeric) || numeric < 1 || numeric > 5) {
      errors.priority = 'Prioritas harus 1-5.';
    }
  }

  if (values.store_url) {
    try {
      // eslint-disable-next-line no-new
      new URL(values.store_url);
    } catch {
      errors.store_url = 'URL toko tidak valid.';
    }
  }

  if (values.image_url) {
    try {
      // eslint-disable-next-line no-new
      new URL(values.image_url);
    } catch {
      errors.image_url = 'URL gambar tidak valid.';
    }
  }

  return errors;
}

export default function WishlistFormDialog({
  open,
  mode,
  initialItem,
  categories,
  onClose,
  onSubmit,
  submitting = false,
}: WishlistFormDialogProps) {
  const [values, setValues] = useState<FormState>(() => createInitialState(initialItem));
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      setValues(createInitialState(initialItem));
      setErrors({});
    }
  }, [open, initialItem]);

  const handleChange = (field: keyof FormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setValues((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const categoryOptions = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name, 'id-ID')),
    [categories],
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validation = validate(values);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    const payload: WishlistCreatePayload = {
      title: values.title.trim(),
      estimated_price: values.estimated_price ? Number(values.estimated_price) : null,
      priority: values.priority ? Number(values.priority) : null,
      category_id: values.category_id || null,
      store_url: values.store_url.trim() || null,
      status: values.status,
      note: values.note.trim() || null,
      image_url: values.image_url.trim() || null,
    };

    await onSubmit(payload);
  };

  const dialogTitle = mode === 'edit' ? 'Edit Wishlist' : 'Wishlist Baru';

  return (
    <Modal open={open} title={dialogTitle} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="wishlist-title" className="mb-1 block text-sm font-medium text-slate-200">
            Judul*
          </label>
          <input
            id="wishlist-title"
            value={values.title}
            onChange={handleChange('title')}
            className={inputClassName}
            placeholder="Contoh: iPad Air 2024"
            required
          />
          {errors.title ? <p className="mt-1 text-xs text-rose-400">{errors.title}</p> : null}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="wishlist-price" className="mb-1 block text-sm font-medium text-slate-200">
              Estimasi Harga (Rp)
            </label>
            <input
              id="wishlist-price"
              value={values.estimated_price}
              onChange={handleChange('estimated_price')}
              className={inputClassName}
              inputMode="decimal"
              placeholder="1000000"
            />
            {errors.estimated_price ? (
              <p className="mt-1 text-xs text-rose-400">{errors.estimated_price}</p>
            ) : null}
          </div>
          <div>
            <label htmlFor="wishlist-priority" className="mb-1 block text-sm font-medium text-slate-200">
              Prioritas (1-5)
            </label>
            <select
              id="wishlist-priority"
              value={values.priority}
              onChange={handleChange('priority')}
              className={inputClassName}
            >
              <option value="">Tidak ditentukan</option>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  P{value}
                </option>
              ))}
            </select>
            {errors.priority ? <p className="mt-1 text-xs text-rose-400">{errors.priority}</p> : null}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="wishlist-category" className="mb-1 block text-sm font-medium text-slate-200">
              Kategori
            </label>
            <select
              id="wishlist-category"
              value={values.category_id}
              onChange={handleChange('category_id')}
              className={inputClassName}
            >
              <option value="">Pilih kategori</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="wishlist-status" className="mb-1 block text-sm font-medium text-slate-200">
              Status
            </label>
            <select
              id="wishlist-status"
              value={values.status}
              onChange={handleChange('status')}
              className={inputClassName}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="wishlist-store" className="mb-1 block text-sm font-medium text-slate-200">
              URL Toko
            </label>
            <input
              id="wishlist-store"
              value={values.store_url}
              onChange={handleChange('store_url')}
              className={inputClassName}
              placeholder="https://"
            />
            {errors.store_url ? <p className="mt-1 text-xs text-rose-400">{errors.store_url}</p> : null}
          </div>
          <div>
            <label htmlFor="wishlist-image" className="mb-1 block text-sm font-medium text-slate-200">
              URL Gambar
            </label>
            <input
              id="wishlist-image"
              value={values.image_url}
              onChange={handleChange('image_url')}
              className={inputClassName}
              placeholder="https://"
            />
            {errors.image_url ? <p className="mt-1 text-xs text-rose-400">{errors.image_url}</p> : null}
          </div>
        </div>
        <div>
          <label htmlFor="wishlist-note" className="mb-1 block text-sm font-medium text-slate-200">
            Catatan
          </label>
          <textarea
            id="wishlist-note"
            value={values.note}
            onChange={handleChange('note')}
            className={textareaClassName}
            placeholder="Catatan tambahan atau alasan"
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-800 px-5 text-sm font-medium text-slate-200 transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-[var(--accent)] px-6 text-sm font-semibold text-slate-950 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? 'Menyimpan…' : mode === 'edit' ? 'Simpan Perubahan' : 'Tambah Wishlist'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
