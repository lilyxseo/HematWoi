import { ChangeEvent } from 'react';
import type { CalendarFilters } from '../../lib/calendarApi';

type Option = {
  id: string;
  name: string;
  type?: 'income' | 'expense';
};

export interface CalendarFiltersProps {
  filters: CalendarFilters;
  onChange: (filters: CalendarFilters) => void;
  onReset: () => void;
  categories: Option[];
  accounts: Option[];
  loading?: boolean;
}

function handleMultiSelect(event: ChangeEvent<HTMLSelectElement>): string[] {
  return Array.from(event.target.selectedOptions).map((option) => option.value);
}

export default function Filters({
  filters,
  onChange,
  onReset,
  categories,
  accounts,
  loading,
}: CalendarFiltersProps) {
  const updateFilters = (patch: Partial<CalendarFilters>) => {
    onChange({ ...filters, ...patch });
  };

  return (
    <div className="grid gap-3 rounded-2xl border border-border/60 bg-surface-1/80 p-4 backdrop-blur sm:grid-cols-2 lg:grid-cols-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium uppercase text-muted">Tipe</span>
        <select
          className="rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,theme(colors.rose.500))]"
          value={filters.type}
          onChange={(event) => updateFilters({ type: event.target.value as CalendarFilters['type'] })}
          disabled={loading}
        >
          <option value="expense">Pengeluaran saja</option>
          <option value="all">Pengeluaran + Pemasukan</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium uppercase text-muted">Kategori</span>
        <select
          multiple
          value={filters.categories}
          onChange={(event) => updateFilters({ categories: handleMultiSelect(event) })}
          className="h-28 rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,theme(colors.rose.500))]"
          disabled={loading}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
              {category.type ? ` (${category.type === 'expense' ? 'Pengeluaran' : 'Pemasukan'})` : ''}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium uppercase text-muted">Akun</span>
        <select
          multiple
          value={filters.accountIds}
          onChange={(event) => updateFilters({ accountIds: handleMultiSelect(event) })}
          className="h-28 rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,theme(colors.rose.500))]"
          disabled={loading}
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium uppercase text-muted">Nominal minimum</span>
          <input
            type="number"
            inputMode="decimal"
            className="rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,theme(colors.rose.500))]"
            value={filters.minAmount ?? ''}
            onChange={(event) =>
              updateFilters({
                minAmount: event.target.value ? Number(event.target.value) : undefined,
              })
            }
            placeholder="0"
            disabled={loading}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium uppercase text-muted">Nominal maksimum</span>
          <input
            type="number"
            inputMode="decimal"
            className="rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,theme(colors.rose.500))]"
            value={filters.maxAmount ?? ''}
            onChange={(event) =>
              updateFilters({
                maxAmount: event.target.value ? Number(event.target.value) : undefined,
              })
            }
            placeholder=""
            disabled={loading}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2 lg:col-span-1">
          <span className="text-xs font-medium uppercase text-muted">Cari catatan / merchant</span>
          <input
            type="search"
            className="rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,theme(colors.rose.500))]"
            value={filters.search ?? ''}
            onChange={(event) => updateFilters({ search: event.target.value || undefined })}
            placeholder="Contoh: kopi, grab"
            disabled={loading}
          />
        </label>
        <div className="flex items-end justify-start">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-[42px] items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold text-muted transition hover:border-[color:var(--accent,theme(colors.rose.400))] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,theme(colors.rose.500))]"
            disabled={loading}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
