import { Filter, RotateCcw } from 'lucide-react';
import type { WishlistSortOption, WishlistStatus } from '../../lib/wishlistApi';

type PriorityValue = number | 'all';

type FilterValue = {
  search: string;
  status: WishlistStatus | 'all';
  priority: PriorityValue;
  categoryId: string | 'all';
  priceMin: string;
  priceMax: string;
  sort: WishlistSortOption;
};

interface CategoryOption {
  id: string;
  name: string;
}

interface WishlistFilterBarProps {
  value: FilterValue;
  onChange: (next: Partial<FilterValue>) => void;
  onReset: () => void;
  categories: CategoryOption[];
  categoriesLoading?: boolean;
}

const selectClass =
  'h-11 rounded-2xl border-0 ring-2 ring-slate-800 bg-slate-900 text-slate-100 px-4 text-sm focus:outline-none focus:ring-[var(--accent)] transition';

const inputClass =
  'h-11 rounded-2xl border-0 ring-2 ring-slate-800 bg-slate-900 text-slate-100 px-4 text-sm focus:outline-none focus:ring-[var(--accent)] transition placeholder:text-slate-500';

const priorities: { label: string; value: PriorityValue }[] = [
  { label: 'Semua Prioritas', value: 'all' },
  { label: 'Prioritas 1', value: 1 },
  { label: 'Prioritas 2', value: 2 },
  { label: 'Prioritas 3', value: 3 },
  { label: 'Prioritas 4', value: 4 },
  { label: 'Prioritas 5', value: 5 },
];

const statuses: { label: string; value: WishlistStatus | 'all' }[] = [
  { label: 'Semua Status', value: 'all' },
  { label: 'Direncanakan', value: 'planned' },
  { label: 'Ditunda', value: 'deferred' },
  { label: 'Dibeli', value: 'purchased' },
  { label: 'Arsip', value: 'archived' },
];

const sortOptions: { label: string; value: WishlistSortOption }[] = [
  { label: 'Terbaru', value: 'newest' },
  { label: 'Tertua', value: 'oldest' },
  { label: 'Harga Terendah', value: 'price_asc' },
  { label: 'Harga Tertinggi', value: 'price_desc' },
  { label: 'Prioritas Tinggi', value: 'priority' },
];

export default function WishlistFilterBar({ value, onChange, onReset, categories, categoriesLoading }: WishlistFilterBarProps) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 px-4 py-5 shadow-inner shadow-black/10 backdrop-blur">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
        <Filter className="h-4 w-4" /> Filter Wishlist
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-slate-400" htmlFor="wishlist-search">
            Pencarian
          </label>
          <input
            id="wishlist-search"
            type="search"
            value={value.search}
            onChange={(event) => onChange({ search: event.target.value })}
            className={inputClass}
            placeholder="Cari judul atau catatan"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-slate-400" htmlFor="wishlist-status">
            Status
          </label>
          <select
            id="wishlist-status"
            className={selectClass}
            value={value.status}
            onChange={(event) => onChange({ status: event.target.value as WishlistStatus | 'all' })}
          >
            {statuses.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-slate-400" htmlFor="wishlist-priority">
            Prioritas
          </label>
          <select
            id="wishlist-priority"
            className={selectClass}
            value={value.priority}
            onChange={(event) => {
              const raw = event.target.value;
              const nextValue = raw === 'all' ? 'all' : Number(raw);
              onChange({ priority: nextValue as PriorityValue });
            }}
          >
            {priorities.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-slate-400" htmlFor="wishlist-category">
            Kategori
          </label>
          <select
            id="wishlist-category"
            className={selectClass}
            value={value.categoryId}
            onChange={(event) => onChange({ categoryId: event.target.value })}
          >
            <option value="all">Semua Kategori</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {categoriesLoading ? (
            <span className="text-xs text-slate-500">Memuat kategori...</span>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-slate-400" htmlFor="wishlist-price-min">
            Harga Minimum
          </label>
          <input
            id="wishlist-price-min"
            inputMode="decimal"
            value={value.priceMin}
            onChange={(event) => onChange({ priceMin: event.target.value })}
            className={inputClass}
            placeholder="0"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-slate-400" htmlFor="wishlist-price-max">
            Harga Maksimum
          </label>
          <input
            id="wishlist-price-max"
            inputMode="decimal"
            value={value.priceMax}
            onChange={(event) => onChange({ priceMax: event.target.value })}
            className={inputClass}
            placeholder="Tidak dibatasi"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-slate-400" htmlFor="wishlist-sort">
            Urutkan
          </label>
          <select
            id="wishlist-sort"
            className={selectClass}
            value={value.sort}
            onChange={(event) => onChange({ sort: event.target.value as WishlistSortOption })}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col justify-end gap-2 sm:col-span-2 lg:col-span-1">
          <button
            type="button"
            onClick={onReset}
            className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/70 px-4 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
            aria-label="Reset filter wishlist"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        </div>
      </div>
    </div>
  );
}
