/**
 * WishlistFilterBar renders the compact responsive filter + sort controls for wishlist listing.
 * It receives the current filter state and notifies parent components when values change or reset.
 */
import type { ChangeEvent } from 'react';
import clsx from 'clsx';
import { IconFunnel, IconSort, IconX } from './icons';

export type WishlistStatusFilter = 'all' | 'planned' | 'deferred' | 'purchased' | 'archived';

export interface WishlistFilterState {
  search: string;
  status: WishlistStatusFilter;
  priority: 'all' | '1' | '2' | '3' | '4' | '5';
  categoryId: 'all' | string;
  priceMin: string;
  priceMax: string;
  sort: 'newest' | 'oldest' | 'price-asc' | 'price-desc' | 'priority-asc' | 'priority-desc';
}

export interface WishlistFilterBarProps {
  filters: WishlistFilterState;
  categories: Array<{ id: string; name: string }>;
  onChange: (next: WishlistFilterState) => void;
  onReset: () => void;
}

function buildInputClassName(extra?: string) {
  return clsx(
    'h-11 w-full rounded-2xl border-none bg-slate-900/60 px-4 text-sm text-slate-100 shadow-sm',
    'ring-2 ring-slate-800 transition focus:outline-none focus:ring-[var(--accent)] focus:ring-2',
    extra
  );
}

export default function WishlistFilterBar({ filters, categories, onChange, onReset }: WishlistFilterBarProps) {
  const handleInput = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    onChange({ ...filters, [name]: value } as WishlistFilterState);
  };

  return (
    <section
      aria-label="Filter wishlist"
      className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-4 shadow-sm backdrop-blur"
    >
      <div className="flex flex-wrap gap-3">
        <div className="flex min-w-[220px] flex-1 items-center gap-2">
          <IconFunnel className="h-5 w-5 flex-shrink-0 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            inputMode="search"
            name="search"
            value={filters.search}
            onChange={handleInput}
            placeholder="Cari judul atau catatan"
            className={buildInputClassName('pl-2')}
            aria-label="Cari wishlist"
            autoComplete="off"
          />
        </div>
        <select
          name="status"
          value={filters.status}
          onChange={handleInput}
          className={buildInputClassName('md:max-w-[160px]')}
          aria-label="Filter status"
        >
          <option value="all">Semua status</option>
          <option value="planned">Direncanakan</option>
          <option value="deferred">Ditunda</option>
          <option value="purchased">Dibeli</option>
          <option value="archived">Diarsipkan</option>
        </select>
        <select
          name="priority"
          value={filters.priority}
          onChange={handleInput}
          className={buildInputClassName('md:max-w-[140px]')}
          aria-label="Filter prioritas"
        >
          <option value="all">Prioritas</option>
          {[1, 2, 3, 4, 5].map((level) => (
            <option key={level} value={String(level)}>
              Prioritas {level}
            </option>
          ))}
        </select>
        <select
          name="categoryId"
          value={filters.categoryId}
          onChange={handleInput}
          className={buildInputClassName('md:max-w-[180px]')}
          aria-label="Filter kategori"
        >
          <option value="all">Semua kategori</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <div className="flex min-w-[200px] flex-1 items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            name="priceMin"
            value={filters.priceMin}
            onChange={handleInput}
            placeholder="Harga min"
            className={buildInputClassName('font-mono text-xs md:text-sm')}
            aria-label="Harga minimum"
            min={0}
          />
          <span className="text-sm text-slate-500">–</span>
          <input
            type="number"
            inputMode="decimal"
            name="priceMax"
            value={filters.priceMax}
            onChange={handleInput}
            placeholder="Harga max"
            className={buildInputClassName('font-mono text-xs md:text-sm')}
            aria-label="Harga maksimum"
            min={0}
          />
        </div>
        <div className="flex min-w-[200px] flex-1 items-center gap-2 md:min-w-[220px]">
          <IconSort className="h-5 w-5 flex-shrink-0 text-slate-400" aria-hidden="true" />
          <select
            name="sort"
            value={filters.sort}
            onChange={handleInput}
            className={buildInputClassName('pl-2')}
            aria-label="Urutkan wishlist"
          >
            <option value="newest">Terbaru</option>
            <option value="oldest">Tertua</option>
            <option value="price-asc">Harga naik</option>
            <option value="price-desc">Harga turun</option>
            <option value="priority-desc">Prioritas tinggi</option>
            <option value="priority-asc">Prioritas rendah</option>
          </select>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-800/70 px-4 text-sm font-medium text-slate-100 transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          aria-label="Reset filter"
        >
          <IconX className="h-4 w-4" aria-hidden="true" /> Reset
        </button>
      </div>
    </section>
  );
}
