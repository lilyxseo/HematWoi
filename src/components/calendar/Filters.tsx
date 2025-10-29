import { ChangeEvent } from 'react';
import clsx from 'clsx';
import { CalendarFilters } from '../../lib/calendarApi';

export type FilterOption = {
  id: string;
  name: string;
};

interface FiltersProps {
  value: CalendarFilters;
  onChange: (next: Partial<CalendarFilters>) => void;
  onReset: () => void;
  categories: FilterOption[];
  accounts: FilterOption[];
  loading?: boolean;
}

export default function Filters({
  value,
  onChange,
  onReset,
  categories,
  accounts,
  loading = false,
}: FiltersProps) {
  const handleTypeChange = (includeIncome: boolean) => {
    onChange({ includeIncome });
  };

  const handleCategoryToggle = (event: ChangeEvent<HTMLInputElement>) => {
    const { checked, value: categoryId } = event.target;
    const current = new Set(value.categories);
    if (checked) {
      current.add(categoryId);
    } else {
      current.delete(categoryId);
    }
    onChange({ categories: Array.from(current) });
  };

  const handleAccountChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value || null;
    onChange({ accountId: next || null });
  };

  const handleMinChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value.trim();
    onChange({ amountMin: next ? Number.parseInt(next, 10) : null });
  };

  const handleMaxChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value.trim();
    onChange({ amountMax: next ? Number.parseInt(next, 10) : null });
  };

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ search: event.target.value });
  };

  const isCategoryChecked = (id: string) => value.categories.includes(id);

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-border/60 bg-surface-1/80 p-4 text-text shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-300">Tipe</span>
        <div className="inline-flex overflow-hidden rounded-2xl border border-border/60 bg-surface-2 text-sm font-medium">
          <button
            type="button"
            onClick={() => handleTypeChange(false)}
            className={clsx(
              'px-4 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              !value.includeIncome
                ? 'bg-brand/20 text-white'
                : 'text-slate-300 hover:bg-slate-900/60',
            )}
            aria-pressed={!value.includeIncome}
          >
            Expense Only
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange(true)}
            className={clsx(
              'px-4 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              value.includeIncome
                ? 'bg-brand/20 text-white'
                : 'text-slate-300 hover:bg-slate-900/60',
            )}
            aria-pressed={value.includeIncome}
          >
            Expense + Income
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <fieldset className="flex flex-col gap-2" aria-label="Filter kategori">
          <legend className="text-sm font-semibold text-slate-300">Kategori</legend>
          <div className="max-h-40 overflow-y-auto rounded-2xl border border-border/60 bg-slate-950/40 p-3 text-sm text-slate-200">
            {categories.length === 0 ? (
              <p className="text-xs text-slate-500">
                {loading ? 'Memuat kategori…' : 'Tidak ada kategori tersedia'}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {categories.map((category) => (
                  <label key={category.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      value={category.id}
                      checked={isCategoryChecked(category.id)}
                      onChange={handleCategoryToggle}
                      className="h-4 w-4 rounded border-border/60 bg-surface-1 text-brand focus:ring-brand"
                    />
                    <span className="truncate">{category.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </fieldset>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-slate-300" htmlFor="calendar-account-filter">
            Akun
          </label>
          <select
            id="calendar-account-filter"
            value={value.accountId ?? ''}
            onChange={handleAccountChange}
            className="h-11 w-full rounded-2xl border border-border/60 bg-background px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <option value="">Semua akun</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-slate-300" htmlFor="calendar-min-amount">
                Nominal min
              </label>
              <input
                id="calendar-min-amount"
                type="number"
                inputMode="numeric"
                min={0}
                value={value.amountMin ?? ''}
                onChange={handleMinChange}
                className="h-11 w-full rounded-2xl border border-border/60 bg-background px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-slate-300" htmlFor="calendar-max-amount">
                Nominal max
              </label>
              <input
                id="calendar-max-amount"
                type="number"
                inputMode="numeric"
                min={0}
                value={value.amountMax ?? ''}
                onChange={handleMaxChange}
                className="h-11 w-full rounded-2xl border border-border/60 bg-background px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-slate-300" htmlFor="calendar-search">
              Pencarian
            </label>
            <input
              id="calendar-search"
              type="search"
              value={value.search ?? ''}
              onChange={handleSearchChange}
              placeholder="Cari judul, catatan, atau merchant"
              className="h-11 w-full rounded-2xl border border-border/60 bg-background px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-border/60 bg-surface-2 px-5 text-sm font-semibold text-slate-200 transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          Reset
        </button>
      </div>
    </section>
  );
}
