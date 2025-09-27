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

const INPUT_CLASS =
  'h-11 w-full rounded-2xl border-none bg-slate-950/70 px-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-[var(--accent)]';

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 20l-3-3" />
    </svg>
  );
}

function FunnelIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16l-6 7v5l-4 2v-7L4 5z" />
    </svg>
  );
}

function SortIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v13" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 17l-3-3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 17l3-3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20V7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 7l3 3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 7l-3 3" />
    </svg>
  );
}

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
      className="rounded-3xl border border-slate-800/70 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/40 backdrop-blur"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800/80 text-[var(--accent)]">
            <FunnelIcon className="h-4 w-4" />
          </span>
          Filter &amp; Urutkan
        </div>
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-9 items-center justify-center rounded-xl px-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 transition hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Reset
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-6 xl:grid-cols-12">
        <div className="md:col-span-2 xl:col-span-2">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Status
            <select
              value={filters.status}
              onChange={(event) => handleSelect(event, 'status')}
              className={INPUT_CLASS}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="md:col-span-2 xl:col-span-2">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Prioritas
            <select
              value={filters.priority}
              onChange={(event) => handleSelect(event, 'priority')}
              className={INPUT_CLASS}
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="md:col-span-2 xl:col-span-2">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Kategori
            <select
              value={filters.categoryId}
              onChange={(event) => handleSelect(event, 'categoryId')}
              className={INPUT_CLASS}
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

        <div className="md:col-span-2 xl:col-span-2">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Harga minimum
            <input
              type="number"
              inputMode="decimal"
              min="0"
              value={filters.priceMin}
              onChange={(event) => handleInput(event, 'priceMin')}
              className={INPUT_CLASS}
              placeholder="0"
            />
          </label>
        </div>

        <div className="md:col-span-2 xl:col-span-2">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Harga maksimum
            <input
              type="number"
              inputMode="decimal"
              min="0"
              value={filters.priceMax}
              onChange={(event) => handleInput(event, 'priceMax')}
              className={INPUT_CLASS}
              placeholder="0"
            />
          </label>
        </div>

        <div className="md:col-span-2 xl:col-span-2">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <span className="inline-flex items-center gap-1">
              <SortIcon className="h-4 w-4" /> Urutkan
            </span>
            <select
              value={filters.sort}
              onChange={(event) => handleSelect(event, 'sort')}
              className={INPUT_CLASS}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="md:col-span-3 xl:col-span-4">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <span className="inline-flex items-center gap-1">
              <SearchIcon className="h-4 w-4" /> Cari
            </span>
            <div className="flex h-11 items-center gap-2 rounded-2xl bg-slate-950/70 px-3 ring-2 ring-slate-800 focus-within:ring-[var(--accent)]">
              <SearchIcon className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <input
                type="search"
                value={filters.search}
                onChange={(event) => handleInput(event, 'search')}
                placeholder="Cari judul atau catatan"
                className="h-full w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none"
                aria-label="Pencarian wishlist"
              />
            </div>
          </label>
        </div>
      </div>
    </form>
  );
}
