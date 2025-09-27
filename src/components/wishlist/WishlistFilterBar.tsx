/**
 * WishlistFilterBar merender kontrol filter dan sortir untuk halaman wishlist.
 * Komponen ini menerima state filter dari parent dan mengirim perubahan melalui callback.
 */
import type { ChangeEvent, FormEvent } from 'react';
import type { WishlistStatus } from '../../lib/wishlistApi';
import type { WishlistFilters } from '../../hooks/useWishlist';
import { IconFunnel, IconSort } from './WishlistIcons';

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

export default function WishlistFilterBar({ filters, categories, onChange, onReset }: WishlistFilterBarProps) {
  const handleSelect = <Key extends keyof WishlistFilterState>(
    event: ChangeEvent<HTMLSelectElement>,
    key: Key
  ) => {
    onChange({ ...filters, [key]: event.target.value as WishlistFilterState[Key] });
  };

  const handleInput = <Key extends keyof WishlistFilterState>(event: ChangeEvent<HTMLInputElement>, key: Key) => {
    onChange({ ...filters, [key]: event.target.value as WishlistFilterState[Key] });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  const handleReset = () => {
    onReset?.();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-4 shadow-sm backdrop-blur"
    >
      <div className="flex flex-wrap gap-3 md:flex-nowrap">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl bg-slate-900/70 px-3 ring-2 ring-slate-800 focus-within:ring-[var(--accent)]">
          <IconFunnel className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={filters.search}
            onChange={(event) => handleInput(event, 'search')}
            placeholder="Cari judul atau catatan"
            aria-label="Cari wishlist"
            className="h-11 w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
        </div>
        <div className="flex flex-1 flex-wrap gap-3 md:flex-nowrap">
          <select
            value={filters.status}
            onChange={(event) => handleSelect(event, 'status')}
            aria-label="Filter status wishlist"
            className="h-11 flex-1 rounded-2xl bg-slate-900/70 px-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus:outline-none focus:ring-[var(--accent)]"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={filters.priority}
            onChange={(event) => handleSelect(event, 'priority')}
            aria-label="Filter prioritas wishlist"
            className="h-11 flex-1 rounded-2xl bg-slate-900/70 px-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus:outline-none focus:ring-[var(--accent)]"
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={filters.categoryId}
            onChange={(event) => handleSelect(event, 'categoryId')}
            aria-label="Filter kategori wishlist"
            className="h-11 flex-1 rounded-2xl bg-slate-900/70 px-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus:outline-none focus:ring-[var(--accent)]"
          >
            <option value="all">Semua kategori</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 md:mt-4 md:flex-nowrap">
        <div className="flex flex-1 gap-3 md:flex-nowrap">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={filters.priceMin}
            onChange={(event) => handleInput(event, 'priceMin')}
            placeholder="Harga min"
            aria-label="Harga minimum"
            className="h-11 flex-1 rounded-2xl bg-slate-900/70 px-3 text-sm text-slate-100 ring-2 ring-slate-800 transition placeholder:text-slate-500 focus:outline-none focus:ring-[var(--accent)]"
          />
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={filters.priceMax}
            onChange={(event) => handleInput(event, 'priceMax')}
            placeholder="Harga max"
            aria-label="Harga maksimum"
            className="h-11 flex-1 rounded-2xl bg-slate-900/70 px-3 text-sm text-slate-100 ring-2 ring-slate-800 transition placeholder:text-slate-500 focus:outline-none focus:ring-[var(--accent)]"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl bg-slate-900/70 px-3 ring-2 ring-slate-800 focus-within:ring-[var(--accent)]">
            <IconSort className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <select
              value={filters.sort}
              onChange={(event) => handleSelect(event, 'sort')}
              aria-label="Urutkan wishlist"
              className="h-11 w-full min-w-[150px] rounded-2xl bg-transparent text-sm text-slate-100 focus:outline-none"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900/70 px-4 text-sm font-medium text-slate-100 ring-2 ring-slate-800 transition hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Reset
          </button>
        </div>
      </div>
    </form>
  );
}
