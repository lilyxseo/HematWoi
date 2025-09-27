/**
 * WishlistForm renders the slide-over dialog used to create or edit wishlist items. It uses
 * react-hook-form with a Zod schema to validate inputs and exposes sanitized payloads via
 * the onSubmit callback so the parent page can trigger Supabase mutations optimistically.
 */
import { Fragment, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { WishlistCreatePayload, WishlistItem, WishlistStatus } from '../../lib/wishlistApi';
import { IconX } from '../icons/WishlistIcons';

const formSchema = z.object({
  title: z.string().trim().min(1, 'Judul wajib diisi'),
  estimated_price: z
    .preprocess((value) => {
      if (value == null || value === '') return null;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const parsed = Number(trimmed.replace(/[^0-9.,-]/g, '').replace(/,/g, '.'));
        if (Number.isNaN(parsed)) return Number.NaN;
        return parsed;
      }
      return value;
    }, z.number().min(0, 'Harga minimal 0').nullable())
    .refine((value) => value == null || Number.isFinite(value), {
      message: 'Harga tidak valid',
    }),
  priority: z
    .preprocess((value) => {
      if (value == null || value === '') return null;
      if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isNaN(parsed)) return Number.NaN;
        return parsed;
      }
      return value;
    }, z.number().int('Prioritas harus bilangan bulat').min(1, 'Minimal 1').max(5, 'Maksimal 5').nullable())
    .refine((value) => value == null || Number.isFinite(value), {
      message: 'Prioritas tidak valid',
    }),
  category_id: z
    .preprocess((value) => {
      if (value == null || value === '') return null;
      return typeof value === 'string' ? value : null;
    }, z.string().min(1).nullable())
    .default(null),
  store_url: z
    .preprocess((value) => {
      if (value == null) return undefined;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length ? trimmed : undefined;
      }
      return undefined;
    }, z.string().url('URL toko tidak valid').optional()),
  status: z.enum(['planned', 'deferred', 'purchased', 'archived']),
  note: z
    .preprocess((value) => {
      if (value == null) return undefined;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length ? trimmed : undefined;
      }
      return undefined;
    }, z.string().max(500, 'Catatan maksimal 500 karakter').optional()),
  image_url: z
    .preprocess((value) => {
      if (value == null) return undefined;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length ? trimmed : undefined;
      }
      return undefined;
    }, z.string().url('URL gambar tidak valid').optional()),
});

type WishlistFormSchema = z.infer<typeof formSchema>;

interface CategoryOption {
  id: string;
  name: string;
}

interface WishlistFormProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialData?: WishlistItem | null;
  categories: CategoryOption[];
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: WishlistCreatePayload) => Promise<void> | void;
}

const CONTROL_CLASS =
  'h-11 w-full rounded-2xl bg-slate-950/70 px-4 text-sm text-slate-100 ring-2 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-[var(--accent)]';

export default function WishlistForm({
  open,
  mode,
  initialData,
  categories,
  submitting = false,
  onClose,
  onSubmit,
}: WishlistFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<WishlistFormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      estimated_price: null,
      priority: null,
      category_id: null,
      store_url: undefined,
      status: 'planned',
      note: undefined,
      image_url: undefined,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && initialData) {
      reset({
        title: initialData.title,
        estimated_price: initialData.estimated_price,
        priority: initialData.priority,
        category_id: initialData.category_id,
        store_url: initialData.store_url ?? undefined,
        status: initialData.status,
        note: initialData.note ?? undefined,
        image_url: initialData.image_url ?? undefined,
      });
      return;
    }
    reset({
      title: '',
      estimated_price: null,
      priority: null,
      category_id: null,
      store_url: undefined,
      status: 'planned',
      note: undefined,
      image_url: undefined,
    });
  }, [open, mode, initialData, reset]);

  const submitForm = handleSubmit(async (values) => {
    const payload: WishlistCreatePayload = {
      title: values.title.trim(),
      estimated_price: values.estimated_price ?? null,
      priority: values.priority ?? null,
      category_id: values.category_id ?? null,
      store_url: values.store_url ?? null,
      status: values.status as WishlistStatus,
      note: values.note ?? null,
      image_url: values.image_url ?? null,
    };
    await onSubmit(payload);
  });

  return (
    <Transition show={open} as={Fragment} appear>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 flex justify-end">
            <Transition.Child
              as={Fragment}
              enter="transform transition ease-out duration-200"
              enterFrom="translate-x-full"
              enterTo="translate-x-0"
              leave="transform transition ease-in duration-150"
              leaveFrom="translate-x-0"
              leaveTo="translate-x-full"
            >
              <Dialog.Panel className="flex h-full w-full max-w-md flex-col bg-slate-950/95 shadow-xl ring-1 ring-slate-800">
                <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
                  <div>
                    <Dialog.Title className="text-lg font-semibold text-slate-100">
                      {mode === 'create' ? 'Wishlist baru' : 'Edit wishlist'}
                    </Dialog.Title>
                    <p className="text-sm text-slate-400">Isi detail wishlist di sini tanpa meninggalkan halaman.</p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-slate-300 transition hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    aria-label="Tutup form wishlist"
                  >
                    <IconX className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>

                <form onSubmit={submitForm} className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
                  <div className="space-y-2">
                    <label htmlFor="wishlist-title" className="text-sm font-medium text-slate-200">
                      Judul*
                    </label>
                    <input
                      id="wishlist-title"
                      type="text"
                      {...register('title')}
                      className={CONTROL_CLASS}
                      placeholder="Contoh: Kamera mirrorless"
                      autoFocus
                      disabled={submitting}
                    />
                    {errors.title ? <p className="text-xs text-rose-400">{errors.title.message}</p> : null}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label htmlFor="wishlist-price" className="text-sm font-medium text-slate-200">
                        Estimasi harga (Rp)
                      </label>
                      <input
                        id="wishlist-price"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        {...register('estimated_price')}
                        className={CONTROL_CLASS}
                        placeholder="0"
                        disabled={submitting}
                      />
                      {errors.estimated_price ? (
                        <p className="text-xs text-rose-400">{errors.estimated_price.message}</p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="wishlist-priority" className="text-sm font-medium text-slate-200">
                        Prioritas (1-5)
                      </label>
                      <select
                        id="wishlist-priority"
                        {...register('priority')}
                        className={CONTROL_CLASS}
                        disabled={submitting}
                      >
                        <option value="">Tidak ada</option>
                        {[1, 2, 3, 4, 5].map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                      {errors.priority ? <p className="text-xs text-rose-400">{errors.priority.message}</p> : null}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="wishlist-category" className="text-sm font-medium text-slate-200">
                      Kategori
                    </label>
                    <select
                      id="wishlist-category"
                      {...register('category_id')}
                      className={CONTROL_CLASS}
                      disabled={submitting}
                    >
                      <option value="">Tanpa kategori</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    {errors.category_id ? <p className="text-xs text-rose-400">Kategori tidak valid</p> : null}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="wishlist-url" className="text-sm font-medium text-slate-200">
                      URL toko
                    </label>
                    <input
                      id="wishlist-url"
                      type="url"
                      {...register('store_url')}
                      className={CONTROL_CLASS}
                      placeholder="https://"
                      disabled={submitting}
                    />
                    {errors.store_url ? <p className="text-xs text-rose-400">{errors.store_url.message}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="wishlist-status" className="text-sm font-medium text-slate-200">
                      Status
                    </label>
                    <select
                      id="wishlist-status"
                      {...register('status')}
                      className={CONTROL_CLASS}
                      disabled={submitting}
                    >
                      <option value="planned">Direncanakan</option>
                      <option value="deferred">Ditunda</option>
                      <option value="purchased">Dibeli</option>
                      <option value="archived">Diarsipkan</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="wishlist-image" className="text-sm font-medium text-slate-200">
                      URL gambar
                    </label>
                    <input
                      id="wishlist-image"
                      type="url"
                      {...register('image_url')}
                      className={CONTROL_CLASS}
                      placeholder="https://"
                      disabled={submitting}
                    />
                    {errors.image_url ? <p className="text-xs text-rose-400">{errors.image_url.message}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="wishlist-note" className="text-sm font-medium text-slate-200">
                      Catatan
                    </label>
                    <textarea
                      id="wishlist-note"
                      rows={4}
                      {...register('note')}
                      className="w-full rounded-2xl bg-slate-950/70 px-4 py-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-[var(--accent)]"
                      placeholder="Catatan tambahan (opsional)"
                      disabled={submitting}
                    />
                    {errors.note ? <p className="text-xs text-rose-400">{errors.note.message}</p> : null}
                  </div>

                  <div className="mt-auto flex flex-col gap-3 border-t border-slate-800 pt-4 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900/80 px-4 text-sm font-medium text-slate-200 transition hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                      disabled={submitting}
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="inline-flex h-11 items-center justify-center rounded-2xl bg-[var(--accent)] px-6 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent)]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-60"
                      disabled={submitting}
                    >
                      {submitting ? 'Menyimpan…' : mode === 'create' ? 'Tambah wishlist' : 'Simpan perubahan'}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
