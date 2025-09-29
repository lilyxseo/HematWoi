import { useId } from 'react';
import type { BudgetTypeFilter } from '../../lib/budgetsApi';
import { CalendarIcon, FilterIcon, SearchIcon, SwitchIcon } from './InlineIcons';

interface BudgetFiltersProps {
  period: string;
  search: string;
  type: BudgetTypeFilter;
  grouped: boolean;
  onPeriodChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onTypeChange: (value: BudgetTypeFilter) => void;
  onGroupToggle: (value: boolean) => void;
}

const TYPE_OPTIONS: { value: BudgetTypeFilter; label: string }[] = [
  { value: 'expense', label: 'Pengeluaran' },
  { value: 'income', label: 'Pemasukan' },
  { value: 'all', label: 'Semua' },
];

const FIELD_BASE =
  'inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm text-slate-200 ring-1 ring-slate-800 transition focus-within:ring-[var(--accent)]/70';

export default function BudgetFilters({
  period,
  search,
  type,
  grouped,
  onPeriodChange,
  onSearchChange,
  onTypeChange,
  onGroupToggle,
}: BudgetFiltersProps) {
  const searchId = useId();

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <label className={`${FIELD_BASE} cursor-pointer`} htmlFor="budget-period">
          <CalendarIcon className="h-5 w-5 text-slate-400" aria-hidden />
          <input
            id="budget-period"
            type="month"
            value={period}
            onChange={(event) => onPeriodChange(event.target.value)}
            className="bg-transparent text-sm font-medium text-slate-100 outline-none"
            aria-label="Pilih bulan anggaran"
          />
        </label>

        <div className={`${FIELD_BASE} min-w-[150px]`}>
          <FilterIcon className="h-4 w-4 text-slate-400" aria-hidden />
          <select
            value={type}
            onChange={(event) => onTypeChange(event.target.value as BudgetTypeFilter)}
            className="w-full bg-transparent text-sm font-medium text-slate-100 outline-none"
            aria-label="Filter tipe anggaran"
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} className="bg-slate-900 text-slate-100">
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => onGroupToggle(!grouped)}
          aria-pressed={grouped}
          className={`${FIELD_BASE} h-11 px-3 text-sm font-medium transition hover:ring-[var(--accent)]/50`}
          title="Tampilkan grup kategori"
        >
          <SwitchIcon className={`h-5 w-5 ${grouped ? 'text-[var(--accent)]' : 'text-slate-400'}`} aria-hidden />
          <span>Group kategori</span>
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
              grouped ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {grouped ? 'On' : 'Off'}
          </span>
        </button>
      </div>

      <div className="w-full min-w-0 md:w-auto">
        <label htmlFor={searchId} className={`${FIELD_BASE} w-full`}>
          <SearchIcon className="h-4 w-4 text-slate-400" aria-hidden />
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Cari kategori…"
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 outline-none"
          />
        </label>
      </div>
    </div>
  );
}
