/**
 * WishlistForm merender form tambah/edit wishlist menggunakan react-hook-form + zod.
 * Komponen hanya fokus pada field, sementara parent mengatur container modal/slide-over.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { WishlistCreatePayload, WishlistItem, WishlistStatus } from '../../lib/wishlistApi';

interface CategoryOption {
  id: string;
  name: string;
}

const STATUS_OPTIONS: { value: WishlistStatus; label: string }[] = [
  { value: 'planned', label: 'Direncanakan' },
  { value: 'deferred', label: 'Ditunda' },
  { value: 'purchased', label: 'Dibeli' },
  { value: 'archived', label: 'Diarsipkan' },
];

const formSchema = z.object({
  title: z.string().trim().min(1, 'Judul wajib diisi.'),
  estimated_price: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || (!Number.isNaN(Number(value)) && Number(value) >= 0),
      'Perkiraan harga minimal 0.'
    ),
  priority: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === '' ||
        (!Number.isNaN(Number(value)) && Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 5),
      'Prioritas harus 1-5.'
    ),
  category_id: z.string().trim(),
  store_url: z
    .string()
    .trim()
    .optional()
    .refine((value) => {
      if (!value) return true;
      try {
        // eslint-disable-next-line no-new
        new URL(value);
        return true;
      } catch (error) {
        return false;
      }
    }, 'URL toko tidak valid.'),
  status: z.enum(['planned', 'deferred', 'purchased', 'archived']),
  note: z.string().max(500, 'Catatan maksimal 500 karakter.'),
  image_url: z
    .string()
    .trim()
    .optional()
    .refine((value) => {
      if (!value) return true;
      try {
        // eslint-disable-next-line no-new
        new URL(value);
        return true;
      } catch (error) {
        return false;
      }
    }, 'URL gambar tidak valid.'),
});

export type WishlistFormValues = z.infer<typeof formSchema>;

const INPUT_CLASS =
  'h-11 w-full rounded-2xl bg-slate-900/80 px-4 text-sm text-slate-100 ring-2 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60';
const TEXTAREA_CLASS =
  'min-h-[120px] w-full rounded-2xl bg-slate-900/80 px-4 py-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60';

function getDefaultValues(initialData?: WishlistItem | null): WishlistFormValues {
  return {
    title: initialData?.title ?? '',
    estimated_price: initialData?.estimated_price != null ? String(initialData.estimated_price) : '',
    priority: initialData?.priority != null ? String(initialData.priority) : '',
    category_id: initialData?.category_id ?? '',
    store_url: initialData?.store_url ?? '',
    status: initialData?.status ?? 'planned',
    note: initialData?.note ?? '',
    image_url: initialData?.image_url ?? '',
  };
}

interface WishlistFormProps {
  mode: 'create' | 'edit';
  initialData?: WishlistItem | null;
  categories: CategoryOption[];
  submitting?: boolean;
  onSubmit: (payload: WishlistCreatePayload) => void | Promise<void>;
  onCancel: () => void;
}

export default function WishlistForm({
  mode,
  initialData,
  categories,
  submitting = false,
  onSubmit,
  onCancel,
}: WishlistFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WishlistFormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onBlur',
    defaultValues: getDefaultValues(initialData ?? null),
  });

  useEffect(() => {
    reset(getDefaultValues(initialData));
  }, [initialData, reset]);

  const submitForm = (values: WishlistFormValues) => {
    const price = values.estimated_price.trim();
    const priority = values.priority.trim();
    const category = values.category_id.trim();
    const storeUrl = values.store_url?.trim() ?? '';
    const note = values.note.trim();
    const image = values.image_url?.trim() ?? '';

    const payload: WishlistCreatePayload = {
      title: values.title.trim(),
      estimated_price: price ? Number(price) : null,
      priority: priority ? Number(priority) : null,
      category_id: category || null,
      store_url: storeUrl ? storeUrl : undefined,
      note: note ? note : undefined,
      status: values.status,
      image_url: image ? image : undefined,
    };

    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit(submitForm)} className="flex h-full flex-col gap-5">
      <div className="space-y-4 overflow-y-auto pr-1">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-200" htmlFor="wishlist-title">
            Judul*
          </label>
          <input
            id="wishlist-title"
            type="text"
            autoComplete="off"
            className={INPUT_CLASS}
            placeholder="Contoh: Kamera mirrorless untuk konten"
            {...register('title')}
            aria-invalid={errors.title ? 'true' : 'false'}
          />
          {errors.title ? <p className="text-xs text-rose-300">{errors.title.message}</p> : null}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-200" htmlFor="wishlist-price">
              Perkiraan harga (Rp)
            </label>
            <input
              id="wishlist-price"
              type="number"
              inputMode="decimal"
              min="0"
              className={INPUT_CLASS}
              placeholder="0"
              {...register('estimated_price')}
              aria-invalid={errors.estimated_price ? 'true' : 'false'}
            />
            {errors.estimated_price ? (
              <p className="text-xs text-rose-300">{errors.estimated_price.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-200" htmlFor="wishlist-priority">
              Prioritas (1–5)
            </label>
            <input
              id="wishlist-priority"
              type="number"
              inputMode="numeric"
              min="1"
              max="5"
              className={INPUT_CLASS}
              placeholder="Mis. 3"
              {...register('priority')}
              aria-invalid={errors.priority ? 'true' : 'false'}
            />
            {errors.priority ? <p className="text-xs text-rose-300">{errors.priority.message}</p> : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-200" htmlFor="wishlist-category">
              Kategori
            </label>
            <select
              id="wishlist-category"
              className={INPUT_CLASS}
              {...register('category_id')}
              aria-invalid={errors.category_id ? 'true' : 'false'}
            >
              <option value="">Tanpa kategori</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {errors.category_id ? <p className="text-xs text-rose-300">{errors.category_id.message}</p> : null}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-200" htmlFor="wishlist-status">
              Status
            </label>
            <select
              id="wishlist-status"
              className={INPUT_CLASS}
              {...register('status')}
              aria-invalid={errors.status ? 'true' : 'false'}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.status ? <p className="text-xs text-rose-300">{errors.status.message}</p> : null}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-200" htmlFor="wishlist-store-url">
            URL toko
          </label>
          <input
            id="wishlist-store-url"
            type="url"
            placeholder="https://contoh.toko"
            className={INPUT_CLASS}
            {...register('store_url')}
            aria-invalid={errors.store_url ? 'true' : 'false'}
          />
          {errors.store_url ? <p className="text-xs text-rose-300">{errors.store_url.message}</p> : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-200" htmlFor="wishlist-image">
            URL gambar / thumbnail
          </label>
          <input
            id="wishlist-image"
            type="url"
            placeholder="https://contoh.gambar"
            className={INPUT_CLASS}
            {...register('image_url')}
            aria-invalid={errors.image_url ? 'true' : 'false'}
          />
          {errors.image_url ? <p className="text-xs text-rose-300">{errors.image_url.message}</p> : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-200" htmlFor="wishlist-note">
            Catatan
          </label>
          <textarea
            id="wishlist-note"
            placeholder="Tuliskan alasan atau detail tambahan"
            className={TEXTAREA_CLASS}
            {...register('note')}
            aria-invalid={errors.note ? 'true' : 'false'}
          />
          {errors.note ? <p className="text-xs text-rose-300">{errors.note.message}</p> : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-800/70 pt-3 sm:flex-row sm:justify-between sm:pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-slate-900/80 px-4 text-sm font-medium text-slate-200 ring-2 ring-slate-800 transition hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-[var(--accent)] sm:w-auto"
        >
          Batal
        </button>
        <button
          type="submit"
          className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-[var(--accent)] px-6 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent)]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:w-auto"
          disabled={submitting}
        >
          {submitting ? 'Menyimpan…' : mode === 'create' ? 'Tambah wishlist' : 'Simpan perubahan'}
        </button>
      </div>
    </form>
  );
}
