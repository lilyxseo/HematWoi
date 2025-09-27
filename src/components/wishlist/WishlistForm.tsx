/**
 * WishlistForm renders the inline modal form for creating or editing wishlist items on the same page.
 * It uses react-hook-form with a zod schema to enforce validation and returns normalized payloads on submit.
 */
import { Dialog } from '@headlessui/react';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { WishlistCreatePayload, WishlistItem, WishlistStatus } from '../../lib/wishlistApi';
import { IconEdit, IconPlus, IconX } from './icons';

const statusOptions: WishlistStatus[] = ['planned', 'deferred', 'purchased', 'archived'];

const formSchema = z
  .object({
    title: z.string().trim().min(1, 'Judul wajib diisi'),
    estimated_price: z
      .string()
      .optional()
      .transform((value) => value?.trim() ?? '')
      .refine((value) => value === '' || (!Number.isNaN(Number(value)) && Number(value) >= 0), 'Harga minimal 0'),
    priority: z
      .string()
      .optional()
      .transform((value) => value?.trim() ?? '')
      .refine(
        (value) =>
          value === '' || (Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 5),
        'Prioritas 1-5'
      ),
    category_id: z.string().optional().transform((value) => value?.trim() ?? ''),
    store_url: z
      .string()
      .optional()
      .transform((value) => value?.trim() ?? '')
      .refine((value) => value === '' || /^https?:\/\//i.test(value), 'Gunakan URL valid (http/https)'),
    status: z.enum(statusOptions),
    note: z.string().optional().transform((value) => value ?? ''),
    image_url: z.string().optional().transform((value) => value?.trim() ?? ''),
  })
  .superRefine((data, ctx) => {
    if (data.image_url && !/^https?:\/\//i.test(data.image_url)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Gunakan URL gambar valid',
        path: ['image_url'],
      });
    }
  });

export type WishlistFormValues = z.infer<typeof formSchema>;

export interface WishlistFormProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialData: WishlistItem | null;
  categories: Array<{ id: string; name: string }>;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: WishlistCreatePayload) => void;
}

export default function WishlistForm({
  open,
  mode,
  initialData,
  categories,
  submitting = false,
  onClose,
  onSubmit,
}: WishlistFormProps) {
  const defaultValues: WishlistFormValues = useMemo(
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

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WishlistFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
    mode: 'onBlur',
  });

  useEffect(() => {
    if (open) {
      reset(defaultValues);
    }
  }, [open, defaultValues, reset]);

  const handleClose = () => {
    if (!submitting) {
      onClose();
    }
  };

  const submitHandler = handleSubmit((values) => {
    const payload: WishlistCreatePayload = {
      title: values.title.trim(),
      estimated_price: values.estimated_price ? Number(values.estimated_price) : null,
      priority: values.priority ? Number(values.priority) : null,
      category_id: values.category_id ? values.category_id : null,
      store_url: values.store_url || undefined,
      note: values.note?.trim() ? values.note.trim() : undefined,
      status: values.status,
      image_url: values.image_url || undefined,
    };
    onSubmit(payload);
  });

  if (!open) return null;

  return (
    <Dialog open={open} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur" aria-hidden="true" />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center px-4 py-8">
          <Dialog.Panel className="w-full max-w-xl rounded-3xl border border-slate-800/70 bg-slate-950/95 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <Dialog.Title className="text-lg font-semibold text-slate-100">
                {mode === 'create' ? 'Tambah Wishlist' : 'Edit Wishlist'}
              </Dialog.Title>
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/70 text-slate-300 transition hover:text-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                aria-label="Tutup form wishlist"
              >
                <IconX className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <form className="mt-6 space-y-4" onSubmit={submitHandler}>
              <div>
                <label htmlFor="wishlist-title" className="mb-2 block text-sm font-medium text-slate-200">
                  Judul<span className="text-rose-400">*</span>
                </label>
                <input
                  id="wishlist-title"
                  type="text"
                  {...register('title')}
                  className="h-11 w-full rounded-2xl border-none bg-slate-900/60 px-4 text-sm text-slate-100 ring-2 ring-slate-800 transition focus:outline-none focus:ring-[var(--accent)]"
                  placeholder="Contoh: Kamera mirrorless"
                  autoComplete="off"
                />
                {errors.title ? <p className="mt-1 text-xs text-rose-300">{errors.title.message}</p> : null}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="wishlist-price" className="mb-2 block text-sm font-medium text-slate-200">
                    Estimasi harga
                  </label>
                  <input
                    id="wishlist-price"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    {...register('estimated_price')}
                    className="h-11 w-full rounded-2xl border-none bg-slate-900/60 px-4 font-mono text-sm text-slate-100 ring-2 ring-slate-800 transition focus:outline-none focus:ring-[var(--accent)]"
                    placeholder="0"
                  />
                  {errors.estimated_price ? (
                    <p className="mt-1 text-xs text-rose-300">{errors.estimated_price.message}</p>
                  ) : null}
                </div>
                <div>
                  <label htmlFor="wishlist-priority" className="mb-2 block text-sm font-medium text-slate-200">
                    Prioritas
                  </label>
                  <select
                    id="wishlist-priority"
                    {...register('priority')}
                    className="h-11 w-full rounded-2xl border-none bg-slate-900/60 px-4 text-sm text-slate-100 ring-2 ring-slate-800 transition focus:outline-none focus:ring-[var(--accent)]"
                  >
                    <option value="">Pilih prioritas</option>
                    {[1, 2, 3, 4, 5].map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                  {errors.priority ? <p className="mt-1 text-xs text-rose-300">{errors.priority.message}</p> : null}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="wishlist-category" className="mb-2 block text-sm font-medium text-slate-200">
                    Kategori
                  </label>
                  <select
                    id="wishlist-category"
                    {...register('category_id')}
                    className="h-11 w-full rounded-2xl border-none bg-slate-900/60 px-4 text-sm text-slate-100 ring-2 ring-slate-800 transition focus:outline-none focus:ring-[var(--accent)]"
                  >
                    <option value="">Tanpa kategori</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="wishlist-status" className="mb-2 block text-sm font-medium text-slate-200">
                    Status
                  </label>
                  <select
                    id="wishlist-status"
                    {...register('status')}
                    className="h-11 w-full rounded-2xl border-none bg-slate-900/60 px-4 text-sm text-slate-100 ring-2 ring-slate-800 transition focus:outline-none focus:ring-[var(--accent)]"
                  >
                    <option value="planned">Direncanakan</option>
                    <option value="deferred">Ditunda</option>
                    <option value="purchased">Dibeli</option>
                    <option value="archived">Diarsipkan</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="wishlist-store" className="mb-2 block text-sm font-medium text-slate-200">
                  URL toko
                </label>
                <input
                  id="wishlist-store"
                  type="url"
                  {...register('store_url')}
                  className="h-11 w-full rounded-2xl border-none bg-slate-900/60 px-4 text-sm text-slate-100 ring-2 ring-slate-800 transition focus:outline-none focus:ring-[var(--accent)]"
                  placeholder="https://"
                />
                {errors.store_url ? <p className="mt-1 text-xs text-rose-300">{errors.store_url.message}</p> : null}
              </div>

              <div>
                <label htmlFor="wishlist-image" className="mb-2 block text-sm font-medium text-slate-200">
                  URL gambar (opsional)
                </label>
                <input
                  id="wishlist-image"
                  type="url"
                  {...register('image_url')}
                  className="h-11 w-full rounded-2xl border-none bg-slate-900/60 px-4 text-sm text-slate-100 ring-2 ring-slate-800 transition focus:outline-none focus:ring-[var(--accent)]"
                  placeholder="https://"
                />
                {errors.image_url ? <p className="mt-1 text-xs text-rose-300">{errors.image_url.message}</p> : null}
              </div>

              <div>
                <label htmlFor="wishlist-note" className="mb-2 block text-sm font-medium text-slate-200">
                  Catatan
                </label>
                <textarea
                  id="wishlist-note"
                  rows={4}
                  {...register('note')}
                  className="w-full rounded-2xl border-none bg-slate-900/60 px-4 py-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus:outline-none focus:ring-[var(--accent)]"
                  placeholder="Catatan tambahan…"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-800/70 px-4 text-sm font-medium text-slate-200 transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  disabled={submitting || isSubmitting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent)]/90 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  disabled={submitting || isSubmitting}
                >
                  {mode === 'create' ? (
                    <IconPlus className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <IconEdit className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span>{mode === 'create' ? 'Tambah' : 'Simpan'}</span>
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  );
}
