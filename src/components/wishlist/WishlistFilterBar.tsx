/**
 * WishlistFilterBar renders the responsive filter and sort controls used on the wishlist page.
 * It receives the current filter state along with category options, then notifies the parent
 * component whenever any control changes so that the query parameters can be updated.
 */
import type { ChangeEvent } from 'react';
import { IconFunnel, IconSort, IconSearch, IconX } from '../icons/WishlistIcons';
import type { WishlistStatus } from '../../lib/wishlistApi';
import type { WishlistFilters } from '../../hooks/useWishlist';

export interface WishlistFilterState extends WishlistFilters {
  search: string;
  status: WishlistStatus | 'all';
  priority: number | 'all';
  categoryId: string | 'all';
  priceMin: string;
  priceMax: string;
  sort: NonNullable<WishlistFilters['sort']>;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface WishlistFilterBarProps {
  filters: WishlistFilterState;
  categories: CategoryOption[];
  onChange: (next: WishlistFilterState) => void;
  onReset?: () => void;
}

const STATUS_OPTIONS: { value: WishlistFilterState['status']; label: string }[] = [
  { value: 'all', label: 'Semua status' },
  { value: 'planned', label: 'Direncanakan' },
  { value: 'deferred', label: 'Ditunda' },
  { value: 'purchased', label: 'Dibeli' },
  { value: 'archived', label: 'Diarsipkan' },
];

const PRIORITY_OPTIONS: { value: WishlistFilterState['priority']; label: string }[] = [
  { value: 'all', label: 'Semua prioritas' },
  { value: 1, label: 'Prioritas 1' },
  { value: 2, label: 'Prioritas 2' },
  { value: 3, label: 'Prioritas 3' },
  { value: 4, label: 'Prioritas 4' },
  { value: 5, label: 'Prioritas 5' },
];

const SORT_OPTIONS: { value: WishlistFilterState['sort']; label: string }[] = [
  { value: 'newest', label: 'Terbaru' },
  { value: 'oldest', label: 'Terlama' },
  { value: 'price-asc', label: 'Harga naik' },
  { value: 'price-desc', label: 'Harga turun' },
  { value: 'priority-desc', label: 'Prioritas tinggi' },
  { value: 'priority-asc', label: 'Prioritas rendah' },
];

const CONTROL_CLASS =
  'h-11 w-full rounded-2xl bg-slate-950/80 px-4 text-sm text-slate-100 ring-2 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-[var(--accent)]';

export default function WishlistFilterBar({ filters, categories, onChange, onReset }: WishlistFilterBarProps) {
  const handleSelect = <Key extends keyof WishlistFilterState>(event: ChangeEvent<HTMLSelectElement>, key: Key) => {
    const value = event.target.value as WishlistFilterState[Key];
    onChange({ ...filters, [key]: value });
  };

  const handleInput = <Key extends keyof WishlistFilterState>(event: ChangeEvent<HTMLInputElement>, key: Key) => {
    const value = event.target.value as WishlistFilterState[Key];
    onChange({ ...filters, [key]: value });
  };

  return (
    <form className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-2xl bg-slate-900/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <IconFunnel className="h-4 w-4" aria-hidden="true" /> Filter
        </div>
        <label className="sr-only" htmlFor="wishlist-filter-status">
          Status wishlist
        </label>
        <select
          id="wishlist-filter-status"
          value={filters.status}
          onChange={(event) => handleSelect(event, 'status')}
          className={`${CONTROL_CLASS} md:w-40`}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="wishlist-filter-priority">
          Prioritas wishlist
        </label>
        <select
          id="wishlist-filter-priority"
          value={filters.priority}
          onChange={(event) => handleSelect(event, 'priority')}
          className={`${CONTROL_CLASS} md:w-44`}
        >
          {PRIORITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="wishlist-filter-category">
          Kategori wishlist
        </label>
        <select
          id="wishlist-filter-category"
          value={filters.categoryId}
          onChange={(event) => handleSelect(event, 'categoryId')}
          className={`${CONTROL_CLASS} md:w-48`}
        >
          <option value="all">Semua kategori</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        <div className="flex w-full flex-1 min-w-[200px] items-center gap-2 rounded-2xl bg-slate-900/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 md:w-auto">
          Harga
          <label className="sr-only" htmlFor="wishlist-filter-price-min">
            Harga minimum
          </label>
          <input
            id="wishlist-filter-price-min"
            type="number"
            inputMode="decimal"
            min="0"
            value={filters.priceMin}
            onChange={(event) => handleInput(event, 'priceMin')}
            placeholder="Min"
            className="h-9 w-24 rounded-xl bg-slate-950/70 px-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-[var(--accent)]"
          />
          <span className="text-slate-500">—</span>
          <label className="sr-only" htmlFor="wishlist-filter-price-max">
            Harga maksimum
          </label>
          <input
            id="wishlist-filter-price-max"
            type="number"
            inputMode="decimal"
            min="0"
            value={filters.priceMax}
            onChange={(event) => handleInput(event, 'priceMax')}
            placeholder="Max"
            className="h-9 w-24 rounded-xl bg-slate-950/70 px-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-[var(--accent)]"
          />
        </div>

        <div className="flex min-w-[200px] flex-1 items-center gap-3 rounded-2xl bg-slate-950/80 px-3 py-2 ring-2 ring-slate-800 focus-within:ring-[var(--accent)]">
          <IconSearch className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <label className="sr-only" htmlFor="wishlist-filter-search">
            Cari wishlist
          </label>
          <input
            id="wishlist-filter-search"
            type="search"
            value={filters.search}
            onChange={(event) => handleInput(event, 'search')}
            placeholder="Cari judul atau catatan"
            className="h-9 w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <IconSort className="h-5 w-5 text-slate-500" aria-hidden="true" />
          <label className="sr-only" htmlFor="wishlist-filter-sort">
            Urutkan wishlist
          </label>
          <select
            id="wishlist-filter-sort"
            value={filters.sort}
            onChange={(event) => handleSelect(event, 'sort')}
            className={`${CONTROL_CLASS} md:w-48`}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-900/80 px-4 text-sm font-medium text-slate-200 transition hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <IconX className="h-4 w-4" aria-hidden="true" /> Reset
          </button>
        ) : null}
      </div>
    </form>
  );
}
