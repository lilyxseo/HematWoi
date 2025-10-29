import { ChangeEvent } from 'react';
import clsx from 'clsx';
import type { CalendarFilters, CalendarTypeFilter } from '../../lib/calendarApi';

interface OptionItem {
  id: string;
  name: string;
  color?: string | null;
}

interface FiltersProps {
  filters: CalendarFilters;
  onChange: (value: Partial<CalendarFilters>) => void;
  onReset: () => void;
  categories: OptionItem[];
  accounts: OptionItem[];
  loadingCategories?: boolean;
  loadingAccounts?: boolean;
}

const TYPE_OPTIONS: { value: CalendarTypeFilter; label: string; description: string }[] = [
  { value: 'expense', label: 'Expense only', description: 'Hanya pengeluaran' },
  { value: 'all', label: 'Expense + Income', description: 'Sertakan pemasukan' },
];

function toggleValue(list: string[], value: string): string[] {
  const set = new Set(list);
  if (set.has(value)) {
    set.delete(value);
  } else {
    set.add(value);
  }
  return Array.from(set);
}

function parseAmountValue(event: ChangeEvent<HTMLInputElement>): number | null {
  const raw = event.target.value;
  if (!raw || raw.trim() === '') {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

export default function Filters({
  filters,
  onChange,
  onReset,
  categories,
  accounts,
  loadingCategories = false,
  loadingAccounts = false,
}: FiltersProps) {
  const handleTypeChange = (value: CalendarTypeFilter) => {
    onChange({ type: value });
  };

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ search: event.target.value });
  };

  const handleMinChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ minAmount: parseAmountValue(event) });
  };

  const handleMaxChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ maxAmount: parseAmountValue(event) });
  };

  const handleCategoryToggle = (id: string) => {
    onChange({ categories: toggleValue(filters.categories ?? [], id) });
  };

  const handleAccountToggle = (id: string) => {
    onChange({ accounts: toggleValue(filters.accounts ?? [], id) });
  };

  return (
    <section
      className="rounded-3xl bg-slate-950/70 p-4 text-slate-100 shadow-lg ring-1 ring-slate-900/60"
      aria-label="Filter kalender"
    >
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Jenis
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {TYPE_OPTIONS.map((option) => {
              const selected = filters.type === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleTypeChange(option.value)}
                  className={clsx(
                    'flex flex-col rounded-2xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60',
                    selected
                      ? 'border-brand/80 bg-brand/20 text-white'
                      : 'border-slate-800 bg-slate-900/50 text-slate-300 hover:bg-slate-900',
                  )}
                  aria-pressed={selected}
                >
                  <span className="text-sm font-semibold">{option.label}</span>
                  <span className="text-xs text-slate-400">{option.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Kategori
            </p>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/40 p-3 text-sm">
              {loadingCategories ? (
                <p className="text-xs text-slate-500">Memuat kategori…</p>
              ) : categories.length === 0 ? (
                <p className="text-xs text-slate-500">Belum ada kategori</p>
              ) : (
                categories.map((category) => {
                  const selected = filters.categories?.includes(category.id) ?? false;
                  return (
                    <label
                      key={category.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-brand focus:ring-brand"
                        checked={selected}
                        onChange={() => handleCategoryToggle(category.id)}
                      />
                      <span className="flex items-center gap-2">
                        {category.color ? (
                          <span
                            className="inline-flex h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                        ) : null}
                        <span>{category.name}</span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Akun
            </p>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/40 p-3 text-sm">
              {loadingAccounts ? (
                <p className="text-xs text-slate-500">Memuat akun…</p>
              ) : accounts.length === 0 ? (
                <p className="text-xs text-slate-500">Belum ada akun</p>
              ) : (
                accounts.map((account) => {
                  const selected = filters.accounts?.includes(account.id) ?? false;
                  return (
                    <label key={account.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-brand focus:ring-brand"
                        checked={selected}
                        onChange={() => handleAccountToggle(account.id)}
                      />
                      <span>{account.name}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="calendar-filter-min" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Nominal minimal
            </label>
            <input
              id="calendar-filter-min"
              type="number"
              inputMode="numeric"
              className="h-11 rounded-2xl border border-slate-800 bg-slate-900/60 px-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
              value={filters.minAmount ?? ''}
              onChange={handleMinChange}
              placeholder="0"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="calendar-filter-max" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Nominal maksimal
            </label>
            <input
              id="calendar-filter-max"
              type="number"
              inputMode="numeric"
              className="h-11 rounded-2xl border border-slate-800 bg-slate-900/60 px-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
              value={filters.maxAmount ?? ''}
              onChange={handleMaxChange}
              placeholder=""
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="calendar-filter-search" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Cari catatan / merchant
          </label>
          <input
            id="calendar-filter-search"
            type="search"
            value={filters.search ?? ''}
            onChange={handleSearchChange}
            placeholder="Contoh: kopi, supermarket"
            className="h-11 rounded-2xl border border-slate-800 bg-slate-900/60 px-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            Reset
          </button>
        </div>
      </div>
    </section>
  );
}
