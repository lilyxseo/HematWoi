import { ChangeEvent, FormEvent, type SVGProps } from 'react';
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

function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true" {...props}>
      <circle cx="11" cy="11" r="6" />
      <path strokeLinecap="round" d="m20 20-3.35-3.35" />
    </svg>
  );
}

function FunnelIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 5h16l-6.5 7.5V19l-3 2v-8.5L4 5z"
      />
    </svg>
  );
}

function SortIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true" {...props}>
      <path strokeLinecap="round" d="M7 4v16m0 0-3-3m3 3 3-3" />
      <path strokeLinecap="round" d="M17 20V4m0 0 3 3m-3-3-3 3" />
    </svg>
  );
}

function ResetIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 20v-6h-6M5.64 18.36A9 9 0 0 0 18.36 5.64"
      />
    </svg>
  );
}

export default function WishlistFilterBar({ filters, categories, onChange, onReset }: WishlistFilterBarProps) {
  const handleSelect = <Key extends keyof WishlistFilterState>(
    event: ChangeEvent<HTMLSelectElement>,
    key: Key
  ) => {
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

  const handleReset = () => {
    onReset?.();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-3xl border border-slate-800/70 bg-slate-900/70 p-4 shadow-sm backdrop-blur"
    >
      <div className="flex items-center justify-between gap-3 text-sm font-medium text-slate-200">
        <div className="inline-flex items-center gap-2 text-slate-300">
          <FunnelIcon className="h-4 w-4" />
          Filter wishlist
        </div>
        {onReset ? (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            aria-label="Reset filter wishlist"
          >
            <ResetIcon className="h-3.5 w-3.5" /> Reset
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
        <div className="md:col-span-3">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Cari
            <div className="flex h-11 items-center gap-2 rounded-2xl bg-slate-950/70 px-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus-within:ring-[var(--accent)]">
              <SearchIcon className="h-4 w-4 text-slate-500" />
              <input
                type="search"
                value={filters.search}
                onChange={(event) => handleInput(event, 'search')}
                placeholder="Judul atau catatan"
                className="h-full w-full min-w-0 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none"
                aria-label="Pencarian wishlist"
              />
            </div>
          </label>
        </div>

        <label className="md:col-span-2 flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Status
          <select
            value={filters.status}
            onChange={(event) => handleSelect(event, 'status')}
            className="h-11 w-full rounded-2xl bg-slate-950/70 px-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-[var(--accent)]"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="md:col-span-2 flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Prioritas
          <select
            value={filters.priority}
            onChange={(event) => handleSelect(event, 'priority')}
            className="h-11 w-full rounded-2xl bg-slate-950/70 px-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-[var(--accent)]"
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="md:col-span-2 flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Kategori
          <select
            value={filters.categoryId}
            onChange={(event) => handleSelect(event, 'categoryId')}
            className="h-11 w-full rounded-2xl bg-slate-950/70 px-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-[var(--accent)]"
          >
            <option value="all">Semua kategori</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="md:col-span-1 flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Harga min
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={filters.priceMin}
            onChange={(event) => handleInput(event, 'priceMin')}
            className="h-11 w-full rounded-2xl bg-slate-950/70 px-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-[var(--accent)]"
            placeholder="0"
          />
        </label>

        <label className="md:col-span-1 flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Harga max
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={filters.priceMax}
            onChange={(event) => handleInput(event, 'priceMax')}
            className="h-11 w-full rounded-2xl bg-slate-950/70 px-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-[var(--accent)]"
            placeholder="0"
          />
        </label>

        <label className="md:col-span-2 flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Urutkan
          <div className="flex h-11 items-center gap-2 rounded-2xl bg-slate-950/70 px-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus-within:ring-[var(--accent)]">
            <SortIcon className="h-4 w-4 text-slate-500" />
            <select
              value={filters.sort}
              onChange={(event) => handleSelect(event, 'sort')}
              className="h-full w-full bg-transparent text-sm text-slate-100 focus-visible:outline-none"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </label>
      </div>
    </form>
  );
}
