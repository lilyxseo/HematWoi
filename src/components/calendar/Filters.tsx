import { useId, ChangeEvent } from 'react';
import clsx from 'clsx';
import type { CalendarFilters as CalendarFilterState } from '../../lib/calendarApi';

export interface FilterOption {
  id: string;
  name: string;
  color?: string | null;
}

export interface AccountOption {
  id: string;
  name: string;
}

interface CalendarFiltersProps {
  value: CalendarFilterState;
  onChange: (next: Partial<CalendarFilterState>) => void;
  onReset: () => void;
  categories: FilterOption[];
  accounts: AccountOption[];
  loadingCategories?: boolean;
  loadingAccounts?: boolean;
}

function toggleValue(list: string[], value: string, enabled: boolean): string[] {
  const set = new Set(list);
  if (enabled) {
    set.add(value);
  } else {
    set.delete(value);
  }
  return Array.from(set);
}

function parseAmountInput(value: string): number | null {
  const sanitized = value.replace(/[^0-9.,-]/g, '').replace(/,/g, '.');
  if (!sanitized.trim()) {
    return null;
  }
  const parsed = Number.parseFloat(sanitized);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.max(parsed, 0);
}

export default function CalendarFilters({
  value,
  onChange,
  onReset,
  categories,
  accounts,
  loadingCategories = false,
  loadingAccounts = false,
}: CalendarFiltersProps) {
  const typeId = useId();
  const searchId = useId();
  const minId = useId();
  const maxId = useId();

  const handleTypeChange = (include: boolean) => {
    onChange({ includeIncome: include });
  };

  const handleCategoryChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { checked, value: categoryId } = event.target;
    onChange({ categoryIds: toggleValue(value.categoryIds, categoryId, checked) });
  };

  const handleAccountChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { checked, value: accountId } = event.target;
    onChange({ accountIds: toggleValue(value.accountIds, accountId, checked) });
  };

  return (
    <section
      aria-label="Filter kalender transaksi"
      className="rounded-3xl bg-slate-950/70 p-4 ring-1 ring-slate-800 backdrop-blur"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-wrap items-center gap-3" role="radiogroup" aria-labelledby={typeId}>
          <span id={typeId} className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Tipe
          </span>
          <button
            type="button"
            onClick={() => handleTypeChange(false)}
            className={clsx(
              'rounded-full px-3 py-1 text-sm transition',
              value.includeIncome
                ? 'bg-transparent text-slate-300 ring-1 ring-slate-700'
                : 'bg-accent text-slate-950 shadow',
            )}
            aria-pressed={!value.includeIncome}
          >
            Pengeluaran saja
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange(true)}
            className={clsx(
              'rounded-full px-3 py-1 text-sm transition',
              value.includeIncome
                ? 'bg-accent text-slate-950 shadow'
                : 'bg-transparent text-slate-300 ring-1 ring-slate-700',
            )}
            aria-pressed={value.includeIncome}
          >
            Pengeluaran + Pemasukan
          </button>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <label htmlFor={searchId} className="sr-only">
            Cari catatan atau merchant
          </label>
          <input
            id={searchId}
            type="search"
            value={value.search}
            onChange={(event) => onChange({ search: event.target.value })}
            placeholder="Cari catatan atau merchant"
            className="w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent sm:max-w-xs"
          />
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <label htmlFor={minId} className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Min
              </label>
              <input
                id={minId}
                inputMode="decimal"
                className="w-24 rounded-lg border border-slate-800 bg-slate-900/70 px-2 py-1 text-sm text-slate-200 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="0"
                value={value.minAmount ?? ''}
                onChange={(event) => onChange({ minAmount: parseAmountInput(event.target.value) })}
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor={maxId} className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Max
              </label>
              <input
                id={maxId}
                inputMode="decimal"
                className="w-24 rounded-lg border border-slate-800 bg-slate-900/70 px-2 py-1 text-sm text-slate-200 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="0"
                value={value.maxAmount ?? ''}
                onChange={(event) => onChange({ maxAmount: parseAmountInput(event.target.value) })}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <fieldset className="rounded-2xl border border-slate-800/80 p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Kategori
          </legend>
          <div className="max-h-40 space-y-1 overflow-y-auto pr-1 text-sm">
            {loadingCategories && <p className="text-xs text-slate-500">Memuat kategori...</p>}
            {!loadingCategories && categories.length === 0 && (
              <p className="text-xs text-slate-500">Tidak ada kategori</p>
            )}
            {categories.map((category) => {
              const checked = value.categoryIds.includes(category.id);
              return (
                <label key={category.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-900/70">
                  <input
                    type="checkbox"
                    value={category.id}
                    checked={checked}
                    onChange={handleCategoryChange}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-accent focus:ring-accent"
                  />
                  <span className="flex-1 text-slate-200">{category.name}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <fieldset className="rounded-2xl border border-slate-800/80 p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Akun
          </legend>
          <div className="max-h-40 space-y-1 overflow-y-auto pr-1 text-sm">
            {loadingAccounts && <p className="text-xs text-slate-500">Memuat akun...</p>}
            {!loadingAccounts && accounts.length === 0 && (
              <p className="text-xs text-slate-500">Tidak ada akun</p>
            )}
            {accounts.map((account) => {
              const checked = value.accountIds.includes(account.id);
              return (
                <label key={account.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-900/70">
                  <input
                    type="checkbox"
                    value={account.id}
                    checked={checked}
                    onChange={handleAccountChange}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-accent focus:ring-accent"
                  />
                  <span className="flex-1 text-slate-200">{account.name}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>
    </section>
  );
}
