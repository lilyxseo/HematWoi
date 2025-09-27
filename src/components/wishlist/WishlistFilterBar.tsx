import { ChangeEvent, FormEvent } from 'react';
import { RotateCcw, Search } from 'lucide-react';
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
      className="min-w-0 rounded-3xl border border-border-subtle bg-surface-elevated/80 p-4 shadow-sm shadow-black/5 backdrop-blur"
    >
      <div className="grid grid-cols-2 items-center gap-3 md:grid-cols-8">
        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
          <span className="truncate">Status</span>
          <select
            value={filters.status}
            onChange={(event) => handleSelect(event, 'status')}
            className="h-11 w-full rounded-2xl border border-border-subtle bg-surface px-3 text-sm text-text shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
          <span className="truncate">Prioritas</span>
          <select
            value={filters.priority}
            onChange={(event) => handleSelect(event, 'priority')}
            className="h-11 w-full rounded-2xl border border-border-subtle bg-surface px-3 text-sm text-text shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
          <span className="truncate">Kategori</span>
          <select
            value={filters.categoryId}
            onChange={(event) => handleSelect(event, 'categoryId')}
            className="h-11 w-full rounded-2xl border border-border-subtle bg-surface px-3 text-sm text-text shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <option value="all">Semua kategori</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
          <span className="truncate">Harga minimum</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={filters.priceMin}
            onChange={(event) => handleInput(event, 'priceMin')}
            className="h-11 w-full rounded-2xl border border-border-subtle bg-surface px-3 text-sm text-text shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            placeholder="0"
          />
        </label>

        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
          <span className="truncate">Harga maksimum</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={filters.priceMax}
            onChange={(event) => handleInput(event, 'priceMax')}
            className="h-11 w-full rounded-2xl border border-border-subtle bg-surface px-3 text-sm text-text shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            placeholder="0"
          />
        </label>

        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
          <span className="truncate">Urutkan</span>
          <select
            value={filters.sort}
            onChange={(event) => handleSelect(event, 'sort')}
            className="h-11 w-full rounded-2xl border border-border-subtle bg-surface px-3 text-sm text-text shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="col-span-2 flex h-11 min-w-0 items-center gap-2 rounded-2xl border border-border-subtle bg-surface px-3 text-sm text-text shadow-sm transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/40 md:col-span-2 lg:col-span-3">
          <Search className="h-4 w-4 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={filters.search}
            onChange={(event) => handleInput(event, 'search')}
            placeholder="Cari judul atau catatan"
            className="h-full w-full min-w-0 bg-transparent text-sm text-text placeholder:text-muted focus-visible:outline-none"
            aria-label="Pencarian wishlist"
          />
          {onReset ? (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label="Reset filter wishlist"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
    </form>
  );
}
