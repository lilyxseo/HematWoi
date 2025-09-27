import { ChangeEvent, FormEvent } from 'react';
import { RotateCcw, Search } from 'lucide-react';
import type { WishlistStatus } from '../../lib/wishlistApi';
import type { WishlistFilterState, WishlistSort } from '../../hooks/useWishlist';

interface CategoryOption {
  id: string;
  name: string;
}

interface WishlistFilterBarProps {
  filters: WishlistFilterState;
  categories: CategoryOption[];
  onChange: (filters: WishlistFilterState) => void;
  onReset?: () => void;
}

const STATUS_OPTIONS: { value: WishlistStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Semua status' },
  { value: 'planned', label: 'Direncanakan' },
  { value: 'deferred', label: 'Ditunda' },
  { value: 'purchased', label: 'Dibeli' },
  { value: 'archived', label: 'Diarsipkan' },
];

const SORT_OPTIONS: { value: WishlistSort; label: string }[] = [
  { value: 'newest', label: 'Terbaru' },
  { value: 'oldest', label: 'Terlama' },
  { value: 'price-asc', label: 'Harga - Rendah ke Tinggi' },
  { value: 'price-desc', label: 'Harga - Tinggi ke Rendah' },
  { value: 'priority', label: 'Prioritas' },
];

const PRIORITY_OPTIONS: { value: WishlistFilterState['priority']; label: string }[] = [
  { value: 'all', label: 'Semua prioritas' },
  { value: 1, label: 'Prioritas 1' },
  { value: 2, label: 'Prioritas 2' },
  { value: 3, label: 'Prioritas 3' },
  { value: 4, label: 'Prioritas 4' },
  { value: 5, label: 'Prioritas 5' },
];

export default function WishlistFilterBar({ filters, categories, onChange, onReset }: WishlistFilterBarProps) {
  const handleInput = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    key: keyof WishlistFilterState,
  ) => {
    const raw = event.target.value;
    let value: WishlistFilterState[keyof WishlistFilterState];
    if (key === 'priority') {
      value = (raw === 'all' ? 'all' : Number(raw)) as WishlistFilterState[keyof WishlistFilterState];
    } else {
      value = raw as WishlistFilterState[keyof WishlistFilterState];
    }
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
      className="min-w-0 rounded-3xl border border-border/60 bg-surface-1/95 p-4 shadow-sm"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
          <span className="truncate">Cari</span>
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted" />
            <input
              value={filters.search}
              onChange={(event) => handleInput(event, 'search')}
              placeholder="Judul atau catatan"
              aria-label="Cari wishlist"
              className="h-[44px] w-full rounded-2xl border border-slate-800 bg-transparent pl-10 pr-3 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
            />
          </div>
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
          <span className="truncate">Status</span>
          <select
            value={filters.status}
            onChange={(event) => handleInput(event, 'status')}
            aria-label="Filter status wishlist"
            className="h-[44px] w-full rounded-2xl border border-slate-800 bg-transparent px-3 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
          <span className="truncate">Prioritas</span>
          <select
            value={filters.priority}
            onChange={(event) => handleInput(event, 'priority')}
            aria-label="Filter prioritas wishlist"
            className="h-[44px] w-full rounded-2xl border border-slate-800 bg-transparent px-3 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
          <span className="truncate">Urutkan</span>
          <select
            value={filters.sort}
            onChange={(event) => handleInput(event, 'sort')}
            aria-label="Urutkan wishlist"
            className="h-[44px] w-full rounded-2xl border border-slate-800 bg-transparent px-3 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
          <span className="truncate">Kategori</span>
          <select
            value={filters.categoryId}
            onChange={(event) => handleInput(event, 'categoryId')}
            aria-label="Filter kategori wishlist"
            className="h-[44px] w-full rounded-2xl border border-slate-800 bg-transparent px-3 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
          >
            <option value="all">Semua kategori</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-2">
          <label className="flex w-full flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
            <span className="truncate">Harga min</span>
            <input
              type="number"
              inputMode="decimal"
              value={filters.priceMin}
              onChange={(event) => handleInput(event, 'priceMin')}
              aria-label="Harga minimum wishlist"
              placeholder="0"
              min={0}
              className="h-[44px] w-full rounded-2xl border border-slate-800 bg-transparent px-3 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
            />
          </label>
          <label className="flex w-full flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
            <span className="truncate">Harga maks</span>
            <input
              type="number"
              inputMode="decimal"
              value={filters.priceMax}
              onChange={(event) => handleInput(event, 'priceMax')}
              aria-label="Harga maksimum wishlist"
              placeholder="0"
              min={0}
              className="h-[44px] w-full rounded-2xl border border-slate-800 bg-transparent px-3 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
            />
          </label>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex h-[40px] items-center justify-center rounded-2xl border border-slate-800 px-4 text-sm font-medium text-muted transition hover:border-[color:var(--accent)] hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
        >
          <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" /> Reset
        </button>
      </div>
    </form>
  );
}
