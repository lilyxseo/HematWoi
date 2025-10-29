import { useMemo } from 'react';
import { Loader2, RefreshCcw } from 'lucide-react';
import clsx from 'clsx';
import type { CalendarFilterState } from '../../lib/calendarApi';

export interface CalendarFiltersProps {
  value: CalendarFilterState;
  onChange: (next: CalendarFilterState) => void;
  className?: string;
  categories?: { id: string; name: string }[];
  categoriesLoading?: boolean;
  accounts?: AccountOption[];
  accountsLoading?: boolean;
}

type AccountOption = {
  id: string;
  name: string;
};

const TYPE_OPTIONS = [
  { value: 'expense' as const, label: 'Expense saja' },
  { value: 'all' as const, label: 'Expense + Income' },
];

function toggleItem(list: string[], id: string): string[] {
  if (list.includes(id)) {
    return list.filter((item) => item !== id);
  }
  return [...list, id];
}

function normalizeNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

export default function Filters({
  value,
  onChange,
  className,
  categories = [],
  categoriesLoading = false,
  accounts = [],
  accountsLoading = false,
}: CalendarFiltersProps) {

  const handleTypeChange = (mode: 'expense' | 'all') => {
    onChange({ ...value, mode });
  };

  const handleCategoryToggle = (id: string) => {
    onChange({ ...value, categories: toggleItem(value.categories, id) });
  };

  const handleAccountToggle = (id: string) => {
    onChange({ ...value, accounts: toggleItem(value.accounts, id) });
  };

  const resetFilters = () => {
    onChange({ ...value, categories: [], accounts: [], minAmount: null, maxAmount: null, search: '', mode: 'all' });
  };

  const selectedCategoryNames = useMemo(() => {
    if (!value.categories.length) return 'Semua kategori';
    const lookup = new Map(categories.map((item) => [item.id, item.name]));
    const names = value.categories
      .map((id) => lookup.get(id))
      .filter((name): name is string => Boolean(name));
    if (!names.length) return `${value.categories.length} kategori`;
    return names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length - 2}` : '');
  }, [categories, value.categories]);

  const selectedAccountNames = useMemo(() => {
    if (!value.accounts.length) return 'Semua akun';
    const lookup = new Map(accounts.map((item) => [item.id, item.name]));
    const names = value.accounts
      .map((id) => lookup.get(id))
      .filter((name): name is string => Boolean(name));
    if (!names.length) return `${value.accounts.length} akun`;
    return names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length - 2}` : '');
  }, [accounts, value.accounts]);

  const minValue = value.minAmount != null ? String(value.minAmount) : '';
  const maxValue = value.maxAmount != null ? String(value.maxAmount) : '';

  const hasCustomFilter =
    value.mode !== 'all' ||
    value.categories.length > 0 ||
    value.accounts.length > 0 ||
    (value.minAmount != null && value.minAmount !== 0) ||
    (value.maxAmount != null && value.maxAmount !== 0) ||
    value.search.trim() !== '';

  return (
    <section
      className={clsx(
        'rounded-2xl border border-border bg-surface-1/70 p-4 text-sm text-muted-foreground shadow-sm sm:p-5',
        className,
      )}
      aria-label="Filter kalender"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Tipe Transaksi</p>
          <div className="mt-2 inline-flex w-full rounded-xl border border-border bg-background p-1 text-sm">
            {TYPE_OPTIONS.map((option) => {
              const active = value.mode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleTypeChange(option.value)}
                  className={clsx(
                    'flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60',
                    active
                      ? 'bg-brand/10 text-brand'
                      : 'text-muted hover:bg-muted/10',
                  )}
                  aria-pressed={active}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="calendar-search">
            Pencarian
          </label>
          <input
            id="calendar-search"
            type="search"
            placeholder="Cari judul, catatan, merchant"
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-text shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            value={value.search}
            onChange={(event) => onChange({ ...value, search: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="calendar-amount-min">
            Nominal (Min)
          </label>
          <input
            id="calendar-amount-min"
            inputMode="numeric"
            type="number"
            min={0}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-text shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            value={minValue}
            onChange={(event) => onChange({ ...value, minAmount: normalizeNumber(event.target.value) })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="calendar-amount-max">
            Nominal (Max)
          </label>
          <input
            id="calendar-amount-max"
            inputMode="numeric"
            type="number"
            min={0}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-text shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            value={maxValue}
            onChange={(event) => onChange({ ...value, maxAmount: normalizeNumber(event.target.value) })}
          />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <details className="rounded-xl border border-border bg-background p-3">
          <summary className="cursor-pointer select-none text-sm font-semibold text-text">
            {categoriesLoading ? 'Memuat kategori…' : selectedCategoryNames}
          </summary>
          <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
            {categoriesLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Memuat kategori
              </div>
            ) : categories.length ? (
              categories.map((category) => (
                <label key={category.id} className="flex items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
                    checked={value.categories.includes(category.id)}
                    onChange={() => handleCategoryToggle(category.id)}
                  />
                  <span className="truncate">{category.name}</span>
                </label>
              ))
            ) : (
              <p className="text-sm text-muted">Tidak ada kategori</p>
            )}
          </div>
        </details>
        <details className="rounded-xl border border-border bg-background p-3">
          <summary className="cursor-pointer select-none text-sm font-semibold text-text">
            {accountsLoading ? 'Memuat akun…' : selectedAccountNames}
          </summary>
          <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
            {accountsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Memuat akun
              </div>
            ) : accounts.length ? (
              accounts.map((account) => (
                <label key={account.id} className="flex items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
                    checked={value.accounts.includes(account.id)}
                    onChange={() => handleAccountToggle(account.id)}
                  />
                  <span className="truncate">{account.name}</span>
                </label>
              ))
            ) : (
              <p className="text-sm text-muted">Tidak ada akun</p>
            )}
          </div>
        </details>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          Filter akan diterapkan ke ringkasan bulan dan detail harian.
        </p>
        <button
          type="button"
          onClick={resetFilters}
          disabled={!hasCustomFilter}
          className={clsx(
            'inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60',
            hasCustomFilter
              ? 'text-text hover:bg-muted/10'
              : 'cursor-not-allowed text-muted'
          )}
          aria-disabled={!hasCustomFilter}
        >
          <RefreshCcw className="h-4 w-4" /> Reset
        </button>
      </div>
    </section>
  );
}
