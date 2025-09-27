import { useEffect, useMemo, useState } from 'react';
import Modal from '../Modal';
import type { WishlistCreatePayload, WishlistItem, WishlistStatus } from '../../lib/wishlistApi';

interface CategoryOption {
  id: string;
  name: string;
}

interface WishlistFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: WishlistCreatePayload) => Promise<void>;
  initialItem?: WishlistItem | null;
  categories: CategoryOption[];
}

type FieldErrors = Partial<Record<keyof WishlistCreatePayload | 'priceRange', string>> & { form?: string };

const controlClass =
  'h-11 w-full rounded-2xl border-0 ring-2 ring-slate-800 bg-slate-900 text-slate-100 px-4 text-sm focus:outline-none focus:ring-[var(--accent)] transition placeholder:text-slate-500';

const textAreaClass =
  'min-h-[120px] w-full rounded-2xl border-0 ring-2 ring-slate-800 bg-slate-900 text-slate-100 px-4 py-3 text-sm focus:outline-none focus:ring-[var(--accent)] transition placeholder:text-slate-500';

const statusOptions: { label: string; value: WishlistStatus }[] = [
  { label: 'Direncanakan', value: 'planned' },
  { label: 'Ditunda', value: 'deferred' },
  { label: 'Dibeli', value: 'purchased' },
  { label: 'Arsip', value: 'archived' },
];

export default function WishlistFormDialog({ open, onClose, onSubmit, initialItem, categories }: WishlistFormDialogProps) {
  const [title, setTitle] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState('');
  const [priority, setPriority] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [storeUrl, setStoreUrl] = useState('');
  const [status, setStatus] = useState<WishlistStatus>('planned');
  const [note, setNote] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(initialItem?.title ?? '');
      setEstimatedPrice(
        typeof initialItem?.estimated_price === 'number' && Number.isFinite(initialItem.estimated_price)
          ? String(initialItem.estimated_price)
          : ''
      );
      setPriority(typeof initialItem?.priority === 'number' ? String(initialItem.priority) : '');
      setCategoryId(initialItem?.category_id ?? '');
      setStoreUrl(initialItem?.store_url ?? '');
      setStatus(initialItem?.status ?? 'planned');
      setNote(initialItem?.note ?? '');
      setImageUrl(initialItem?.image_url ?? '');
      setErrors({});
      setSubmitting(false);
    }
  }, [open, initialItem]);

  const dialogTitle = initialItem ? 'Edit Wishlist' : 'Tambah Wishlist';

  const payload = useMemo<WishlistCreatePayload>(
    () => ({
      title: title.trim(),
      estimated_price: estimatedPrice ? Number(estimatedPrice) : null,
      priority: priority ? Number(priority) : null,
      category_id: categoryId || null,
      store_url: storeUrl.trim() ? storeUrl.trim() : null,
      status,
      note: note.trim() ? note.trim() : null,
      image_url: imageUrl.trim() ? imageUrl.trim() : null,
    }),
    [title, estimatedPrice, priority, categoryId, storeUrl, status, note, imageUrl]
  );

  function validate(): boolean {
    const nextErrors: FieldErrors = {};

    if (!payload.title) {
      nextErrors.title = 'Judul wajib diisi.';
    }

    if (estimatedPrice) {
      const price = Number(estimatedPrice);
      if (!Number.isFinite(price) || price < 0) {
        nextErrors.estimated_price = 'Masukkan angka ≥ 0.';
      }
    }

    if (priority) {
      const value = Number(priority);
      if (!Number.isInteger(value) || value < 1 || value > 5) {
        nextErrors.priority = 'Prioritas harus 1 - 5.';
      }
    }

    if (storeUrl.trim()) {
      try {
        const parsed = new URL(storeUrl.trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new Error('Invalid protocol');
        }
      } catch (error) {
        nextErrors.store_url = 'URL toko tidak valid.';
      }
    }

    if (!statusOptions.find((option) => option.value === status)) {
      nextErrors.status = 'Pilih status yang valid.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;
    try {
      setSubmitting(true);
      await onSubmit(payload);
      onClose();
    } catch (error) {
      setErrors((prev) => ({ ...prev, form: error instanceof Error ? error.message : 'Gagal menyimpan wishlist.' }));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={dialogTitle}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-200" htmlFor="wishlist-title">
            Judul*
          </label>
          <input
            id="wishlist-title"
            className={controlClass}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Contoh: iPad Air untuk belajar"
            required
          />
          {errors.title ? <p className="text-xs text-rose-400">{errors.title}</p> : null}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-200" htmlFor="wishlist-price">
              Perkiraan Harga (Rp)
            </label>
            <input
              id="wishlist-price"
              className={controlClass}
              inputMode="decimal"
              value={estimatedPrice}
              onChange={(event) => setEstimatedPrice(event.target.value)}
              placeholder="cth. 2500000"
            />
            {errors.estimated_price ? <p className="text-xs text-rose-400">{errors.estimated_price}</p> : null}
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-200" htmlFor="wishlist-priority">
              Prioritas (1-5)
            </label>
            <input
              id="wishlist-priority"
              className={controlClass}
              inputMode="numeric"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              placeholder="cth. 1"
            />
            {errors.priority ? <p className="text-xs text-rose-400">{errors.priority}</p> : null}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-200" htmlFor="wishlist-category">
              Kategori
            </label>
            <select
              id="wishlist-category"
              className={controlClass}
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">Tanpa kategori</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-200" htmlFor="wishlist-status">
              Status
            </label>
            <select
              id="wishlist-status"
              className={controlClass}
              value={status}
              onChange={(event) => setStatus(event.target.value as WishlistStatus)}
              required
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.status ? <p className="text-xs text-rose-400">{errors.status}</p> : null}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-200" htmlFor="wishlist-store">
            URL Toko
          </label>
          <input
            id="wishlist-store"
            className={controlClass}
            value={storeUrl}
            onChange={(event) => setStoreUrl(event.target.value)}
            placeholder="https://"
          />
          {errors.store_url ? <p className="text-xs text-rose-400">{errors.store_url}</p> : null}
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-200" htmlFor="wishlist-image">
            URL Gambar
          </label>
          <input
            id="wishlist-image"
            className={controlClass}
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            placeholder="https://"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-200" htmlFor="wishlist-note">
            Catatan
          </label>
          <textarea
            id="wishlist-note"
            className={textAreaClass}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Tuliskan detail penting, alasan, atau rencana pembelian"
          />
        </div>
        {errors.form ? <p className="text-sm text-rose-400">{errors.form}</p> : null}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-full border border-slate-700 px-5 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="h-11 rounded-full bg-[var(--accent)] px-6 text-sm font-semibold text-slate-900 transition hover:bg-[var(--accent)]/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? 'Menyimpan...' : 'Simpan' }
          </button>
        </div>
      </form>
    </Modal>
  );
}
