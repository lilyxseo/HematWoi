import type { ChangeEvent, FocusEvent } from 'react';
import type { WishlistSort, WishlistStatus } from '../../lib/wishlistApi';

export type WishlistFilterState = {
  search: string;
  status: WishlistStatus | 'all';
  priority: number | 'all';
  categoryId: string | 'all';
  priceMin: string;
  priceMax: string;
  sort: WishlistSort;
};

interface Option {
  value: string;
  label: string;
}

interface WishlistFilterBarProps {
  filters: WishlistFilterState;
  onChange: (changes: Partial<WishlistFilterState>) => void;
  onReset: () => void;
  categories: Array<{ id: string; name: string }>;
}

const statusOptions: Option[] = [
  { value: 'all', label: 'Status (semua)' },
  { value: 'planned', label: 'Direncanakan' },
  { value: 'deferred', label: 'Ditunda' },
  { value: 'purchased', label: 'Dibeli' },
  { value: 'archived', label: 'Arsip' },
];

const priorityOptions: Option[] = [
  { value: 'all', label: 'Prioritas (semua)' },
  { value: '1', label: 'Prioritas 1' },
  { value: '2', label: 'Prioritas 2' },
  { value: '3', label: 'Prioritas 3' },
  { value: '4', label: 'Prioritas 4' },
  { value: '5', label: 'Prioritas 5' },
];

const sortOptions: Array<{ value: WishlistSort; label: string }> = [
  { value: 'newest', label: 'Terbaru' },
  { value: 'oldest', label: 'Tertua' },
  { value: 'priceAsc', label: 'Harga ↑' },
  { value: 'priceDesc', label: 'Harga ↓' },
  { value: 'priority', label: 'Prioritas' },
];

const inputClassName =
  'h-11 w-full rounded-2xl border-none bg-slate-900 px-4 text-sm text-slate-100 ring-2 ring-slate-800 transition focus:outline-none focus:ring-[var(--accent)] placeholder:text-slate-500';

export default function WishlistFilterBar({ filters, onChange, onReset, categories }: WishlistFilterBarProps) {
  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target;
    if (name === 'priority') {
      onChange({ priority: value === 'all' ? 'all' : Number(value) });
      return;
    }
    if (name === 'status') {
      onChange({ status: value as WishlistStatus | 'all' });
      return;
    }
    if (name === 'categoryId') {
      onChange({ categoryId: value as string | 'all' });
      return;
    }
    if (name === 'sort') {
      onChange({ sort: value as WishlistSort });
      return;
    }
    onChange({ [name]: value } as Partial<WishlistFilterState>);
  };

  const handlePriceBlur = (event: FocusEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    const numeric = value.replace(/[^0-9]/g, '');
    onChange({ [name]: numeric } as Partial<WishlistFilterState>);
  };

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-slate-800/60 bg-slate-950/40 p-4 shadow-sm backdrop-blur">
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <div className="md:col-span-2 lg:col-span-2">
          <label htmlFor="wishlist-search" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Cari
          </label>
          <input
            id="wishlist-search"
            name="search"
            value={filters.search}
            onChange={handleChange}
            placeholder="Cari judul atau catatan"
            className={inputClassName}
            type="search"
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="wishlist-priority" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Prioritas
          </label>
          <select
            id="wishlist-priority"
            name="priority"
            value={filters.priority === 'all' ? 'all' : String(filters.priority ?? 'all')}
            onChange={handleChange}
            className={inputClassName}
            aria-label="Filter prioritas"
          >
            {priorityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="wishlist-status" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Status
          </label>
          <select
            id="wishlist-status"
            name="status"
            value={filters.status}
            onChange={handleChange}
            className={inputClassName}
            aria-label="Filter status"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="wishlist-category" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Kategori
          </label>
          <select
            id="wishlist-category"
            name="categoryId"
            value={filters.categoryId}
            onChange={handleChange}
            className={inputClassName}
            aria-label="Filter kategori"
          >
            <option value="all">Kategori (semua)</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="wishlist-price-min" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Harga Min
            </label>
            <input
              id="wishlist-price-min"
              name="priceMin"
              value={filters.priceMin}
              onChange={handleChange}
              onBlur={handlePriceBlur}
              inputMode="numeric"
              pattern="[0-9]*"
              className={inputClassName}
              placeholder="0"
            />
          </div>
          <div>
            <label htmlFor="wishlist-price-max" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Harga Max
            </label>
            <input
              id="wishlist-price-max"
              name="priceMax"
              value={filters.priceMax}
              onChange={handleChange}
              onBlur={handlePriceBlur}
              inputMode="numeric"
              pattern="[0-9]*"
              className={inputClassName}
              placeholder="Tidak dibatasi"
            />
          </div>
        </div>
        <div>
          <label htmlFor="wishlist-sort" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Urutkan
          </label>
          <select
            id="wishlist-sort"
            name="sort"
            value={filters.sort}
            onChange={handleChange}
            className={inputClassName}
            aria-label="Urutkan daftar"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-800 px-4 text-sm font-medium text-slate-100 transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          Reset filter
        </button>
      </div>
    </div>
  );
}
