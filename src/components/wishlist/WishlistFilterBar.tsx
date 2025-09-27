import { ChangeEvent, FormEvent } from 'react';
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

export interface CategoryOption {
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
  'h-11 w-full rounded-2xl border border-slate-800/80 bg-slate-950 px-3 text-sm text-slate-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]';

export default function WishlistFilterBar({ filters, categories, onChange, onReset }: WishlistFilterBarProps) {
  const handleSelect = <Key extends keyof WishlistFilterState>(event: ChangeEvent<HTMLSelectElement>, key: Key) => {
    const value = event.target.value as WishlistFilterState[Key];
    onChange({ ...filters, [key]: value });
  };

  const handleInput = <Key extends keyof WishlistFilterState>(event: ChangeEvent<HTMLInputElement>, key: Key) => {
    const value = event.target.value as WishlistFilterState[Key];
    onChange({ ...filters, [key]: value });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-slate-800/80 bg-slate-900/70 p-4 shadow-sm backdrop-blur"
      aria-labelledby="wishlist-filter-heading"
    >
      <div className="flex flex-col gap-3 pb-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200" id="wishlist-filter-heading">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
            <FilterIcon />
          </span>
          <span>Filter &amp; Urutkan</span>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <RotateIcon /> Reset
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-6 xl:grid-cols-8">
        <div className="md:col-span-2 xl:col-span-3">
          <div className="flex h-11 items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-950 px-3 text-sm text-slate-100 focus-within:ring-2 focus-within:ring-[var(--accent)]">
            <SearchIcon />
            <input
              type="search"
              value={filters.search}
              onChange={(event) => handleInput(event, 'search')}
              placeholder="Cari judul atau catatan"
              className="h-full w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none"
              aria-label="Cari wishlist"
            />
          </div>
        </div>

        <div>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <span>Status</span>
            <select
              value={filters.status}
              onChange={(event) => handleSelect(event, 'status')}
              className={CONTROL_CLASS}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <span>Prioritas</span>
            <select
              value={filters.priority}
              onChange={(event) => handleSelect(event, 'priority')}
              className={CONTROL_CLASS}
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <span>Kategori</span>
            <select
              value={filters.categoryId}
              onChange={(event) => handleSelect(event, 'categoryId')}
              className={CONTROL_CLASS}
            >
              <option value="all">Semua kategori</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <span>Harga min</span>
            <input
              type="number"
              min="0"
              inputMode="decimal"
              value={filters.priceMin}
              onChange={(event) => handleInput(event, 'priceMin')}
              placeholder="0"
              className={CONTROL_CLASS}
            />
          </label>
        </div>

        <div>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <span>Harga max</span>
            <input
              type="number"
              min="0"
              inputMode="decimal"
              value={filters.priceMax}
              onChange={(event) => handleInput(event, 'priceMax')}
              placeholder="0"
              className={CONTROL_CLASS}
            />
          </label>
        </div>

        <div className="md:col-span-2 xl:col-span-2">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <span className="flex items-center gap-2">
              <SortIcon /> Urutkan
            </span>
            <select
              value={filters.sort}
              onChange={(event) => handleSelect(event, 'sort')}
              className={CONTROL_CLASS}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </form>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4 text-slate-500">
      <circle cx="11" cy="11" r="6" />
      <path strokeLinecap="round" d="m20 20-3.5-3.5" />
    </svg>
  );
}

function RotateIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 12a9 9 0 0 1 15.364-6.364L20 7.273M21 12a9 9 0 0 1-15.364 6.364L4 16.727"
      />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 5h16M6 12h12M10 19h4"
      />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4 text-slate-500">
      <path strokeLinecap="round" d="m7 15 5 5 5-5" />
      <path strokeLinecap="round" d="m7 9 5-5 5 5" />
    </svg>
  );
}
