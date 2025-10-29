import clsx from 'clsx';
import { ChangeEvent } from 'react';

export type CalendarFilterState = {
  mode: 'expense' | 'all';
  categoryIds: string[];
  accountIds: string[];
  minAmount?: number | null;
  maxAmount?: number | null;
  search: string;
};

export interface OptionItem {
  id: string;
  name: string;
  type?: string | null;
}

export interface FiltersProps {
  filters: CalendarFilterState;
  onChange: (value: CalendarFilterState) => void;
  onReset: () => void;
  categories: OptionItem[];
  accounts: OptionItem[];
  disabled?: boolean;
}

function parseAmount(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export default function Filters({
  filters,
  onChange,
  onReset,
  categories,
  accounts,
  disabled = false,
}: FiltersProps) {
  const handleModeChange = (mode: 'expense' | 'all') => {
    if (disabled) return;
    onChange({ ...filters, mode });
  };

  const handleCategoryChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(event.target.selectedOptions).map((option) => option.value);
    onChange({ ...filters, categoryIds: values });
  };

  const handleAccountChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(event.target.selectedOptions).map((option) => option.value);
    onChange({ ...filters, accountIds: values });
  };

  const handleAmountChange = (
    event: ChangeEvent<HTMLInputElement>,
    key: 'minAmount' | 'maxAmount',
  ) => {
    const value = parseAmount(event.target.value);
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="rounded-3xl border border-border/70 bg-surface-1/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text">Filter</h3>
          <p className="text-xs text-muted">Sesuaikan tampilan kalender</p>
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface-2 px-3 py-1.5 text-xs font-medium text-text transition hover:bg-surface-1 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Reset
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Tipe
          </legend>
          <div className="inline-flex rounded-full border border-border/60 bg-surface-2 p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => handleModeChange('expense')}
              disabled={disabled}
              className={clsx(
                'rounded-full px-3 py-1 transition',
                filters.mode === 'expense'
                  ? 'bg-brand/20 text-brand'
                  : 'text-muted hover:bg-surface-1',
              )}
            >
              Expense only
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('all')}
              disabled={disabled}
              className={clsx(
                'rounded-full px-3 py-1 transition',
                filters.mode === 'all'
                  ? 'bg-brand/20 text-brand'
                  : 'text-muted hover:bg-surface-1',
              )}
            >
              Expense + Income
            </button>
          </div>
        </fieldset>

        <label className="flex flex-col text-xs font-semibold uppercase tracking-wide text-muted">
          Kategori
          <select
            multiple
            value={filters.categoryIds}
            onChange={handleCategoryChange}
            disabled={disabled}
            className="mt-2 min-h-[3.25rem] rounded-2xl border border-border/60 bg-surface-1 px-3 py-2 text-sm font-medium text-text focus:outline-none focus:ring-2 focus:ring-brand/60"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-xs font-semibold uppercase tracking-wide text-muted">
          Akun
          <select
            multiple
            value={filters.accountIds}
            onChange={handleAccountChange}
            disabled={disabled}
            className="mt-2 min-h-[3.25rem] rounded-2xl border border-border/60 bg-surface-1 px-3 py-2 text-sm font-medium text-text focus:outline-none focus:ring-2 focus:ring-brand/60"
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Nominal Minimum
          <input
            type="number"
            inputMode="numeric"
            disabled={disabled}
            value={filters.minAmount ?? ''}
            onChange={(event) => handleAmountChange(event, 'minAmount')}
            placeholder="0"
            className="rounded-2xl border border-border/60 bg-surface-1 px-3 py-2 text-sm font-medium text-text focus:outline-none focus:ring-2 focus:ring-brand/60"
          />
        </div>

        <div className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Nominal Maksimum
          <input
            type="number"
            inputMode="numeric"
            disabled={disabled}
            value={filters.maxAmount ?? ''}
            onChange={(event) => handleAmountChange(event, 'maxAmount')}
            placeholder="0"
            className="rounded-2xl border border-border/60 bg-surface-1 px-3 py-2 text-sm font-medium text-text focus:outline-none focus:ring-2 focus:ring-brand/60"
          />
        </div>

        <label className="flex flex-col text-xs font-semibold uppercase tracking-wide text-muted md:col-span-2 xl:col-span-3">
          Pencarian
          <input
            type="search"
            value={filters.search}
            disabled={disabled}
            onChange={(event) => onChange({ ...filters, search: event.target.value })}
            placeholder="Cari catatan atau merchant"
            className="mt-2 rounded-2xl border border-border/60 bg-surface-1 px-3 py-2 text-sm font-medium text-text focus:outline-none focus:ring-2 focus:ring-brand/60"
          />
        </label>
      </div>
    </div>
  );
}
