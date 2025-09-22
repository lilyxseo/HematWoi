import { useEffect, useMemo, useState } from 'react';

export type SubscriptionSortOption =
  | 'due-asc'
  | 'due-desc'
  | 'name-asc'
  | 'name-desc'
  | 'amount-desc'
  | 'amount-asc'
  | 'created-desc'
  | 'created-asc';

export interface SubscriptionFilterState {
  q: string;
  status: 'all' | 'active' | 'paused' | 'canceled';
  categoryId: string | 'all';
  accountId: string | 'all';
  unit: 'all' | 'day' | 'week' | 'month' | 'year';
  dueFrom: string | null;
  dueTo: string | null;
  createdFrom: string | null;
  createdTo: string | null;
  sort: SubscriptionSortOption;
  open?: boolean;
}

export interface FilterOption {
  id: string;
  name: string;
}

interface SubscriptionsFilterBarProps {
  filters: SubscriptionFilterState;
  onChange(next: Partial<SubscriptionFilterState>): void;
  onReset(): void;
  categories: FilterOption[];
  accounts: FilterOption[];
}

const statusOptions: Array<{ value: SubscriptionFilterState['status']; label: string }> = [
  { value: 'all', label: 'Semua status' },
  { value: 'active', label: 'Aktif' },
  { value: 'paused', label: 'Paused' },
  { value: 'canceled', label: 'Canceled' },
];

const unitOptions: Array<{ value: SubscriptionFilterState['unit']; label: string }> = [
  { value: 'all', label: 'Semua periode' },
  { value: 'month', label: 'Bulanan' },
  { value: 'week', label: 'Mingguan' },
  { value: 'year', label: 'Tahunan' },
  { value: 'day', label: 'Harian' },
];

const sortOptions: Array<{ value: SubscriptionSortOption; label: string }> = [
  { value: 'due-asc', label: 'Due terdekat' },
  { value: 'due-desc', label: 'Due terjauh' },
  { value: 'name-asc', label: 'Nama A-Z' },
  { value: 'name-desc', label: 'Nama Z-A' },
  { value: 'amount-desc', label: 'Nominal tertinggi' },
  { value: 'amount-asc', label: 'Nominal terendah' },
  { value: 'created-desc', label: 'Terbaru dibuat' },
  { value: 'created-asc', label: 'Terlama dibuat' },
];

export default function SubscriptionsFilterBar({
  filters,
  onChange,
  onReset,
  categories,
  accounts,
}: SubscriptionsFilterBarProps) {
  const [expanded, setExpanded] = useState(Boolean(filters.open));

  useEffect(() => {
    setExpanded(Boolean(filters.open));
  }, [filters.open]);

  const categoryOptions = useMemo(
    () => [{ id: 'all', name: 'Semua kategori' }, ...categories],
    [categories],
  );
  const accountOptions = useMemo(
    () => [{ id: 'all', name: 'Semua akun' }, ...accounts],
    [accounts],
  );

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    onChange({ open: next });
  };

  return (
    <div className="rounded-3xl border border-border-subtle bg-surface p-4 shadow-sm shadow-black/5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex-1 text-sm">
          <span className="sr-only">Cari langganan</span>
          <input
            type="search"
            value={filters.q}
            onChange={(event) => onChange({ q: event.target.value })}
            placeholder="Cari nama atau vendor"
            className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-4 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        <div className="flex items-center justify-between gap-2 sm:hidden">
          <button
            type="button"
            onClick={handleToggle}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-surface-2 px-3 text-sm font-medium text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-expanded={expanded}
            aria-controls="subscriptions-filter-panel"
          >
            <span>{expanded ? 'Sembunyikan filter' : 'Tampilkan filter'}</span>
          </button>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-surface-2 px-3 text-sm font-medium text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            Reset
          </button>
        </div>
      </div>
      <div
        id="subscriptions-filter-panel"
        className={`mt-4 grid grid-cols-1 gap-4 transition-[max-height,opacity] duration-200 ease-out sm:grid-cols-2 lg:grid-cols-4 ${expanded ? 'max-h-[999px] opacity-100' : 'max-h-0 overflow-hidden opacity-0 sm:max-h-none sm:opacity-100'}`}
      >
        <label className="text-sm">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted">Status</span>
          <select
            className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
            value={filters.status}
            onChange={(event) => onChange({ status: event.target.value as SubscriptionFilterState['status'] })}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted">Kategori</span>
          <select
            className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
            value={filters.categoryId}
            onChange={(event) => onChange({ categoryId: event.target.value as SubscriptionFilterState['categoryId'] })}
          >
            {categoryOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted">Akun</span>
          <select
            className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
            value={filters.accountId}
            onChange={(event) => onChange({ accountId: event.target.value as SubscriptionFilterState['accountId'] })}
          >
            {accountOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted">Periode</span>
          <select
            className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
            value={filters.unit}
            onChange={(event) => onChange({ unit: event.target.value as SubscriptionFilterState['unit'] })}
          >
            {unitOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted">Due dari</span>
          <input
            type="date"
            value={filters.dueFrom ?? ''}
            onChange={(event) => onChange({ dueFrom: event.target.value || null })}
            className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        <label className="text-sm">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted">Due sampai</span>
          <input
            type="date"
            value={filters.dueTo ?? ''}
            onChange={(event) => onChange({ dueTo: event.target.value || null })}
            className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        <label className="text-sm">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted">Dibuat dari</span>
          <input
            type="date"
            value={filters.createdFrom ?? ''}
            onChange={(event) => onChange({ createdFrom: event.target.value || null })}
            className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        <label className="text-sm">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted">Dibuat sampai</span>
          <input
            type="date"
            value={filters.createdTo ?? ''}
            onChange={(event) => onChange({ createdTo: event.target.value || null })}
            className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        <label className="text-sm">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted">Urutkan</span>
          <select
            className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
            value={filters.sort}
            onChange={(event) => onChange({ sort: event.target.value as SubscriptionSortOption })}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="hidden sm:flex sm:flex-col sm:justify-end">
          <button
            type="button"
            onClick={onReset}
            className="h-11 rounded-2xl border border-border bg-surface-2 px-4 text-sm font-medium text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            Reset filter
          </button>
        </div>
      </div>
    </div>
  );
}
