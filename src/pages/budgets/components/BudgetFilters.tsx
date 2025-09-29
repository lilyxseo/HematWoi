import clsx from 'clsx';
import { CalendarIcon, SearchIcon, ToggleIcon } from '../../../components/budgets/InlineIcons';

type BudgetTypeFilter = 'all' | 'expense' | 'income';

interface BudgetFiltersProps {
  period: string;
  onPeriodChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  type: BudgetTypeFilter;
  onTypeChange: (value: BudgetTypeFilter) => void;
  groupBy: boolean;
  onGroupByChange: (value: boolean) => void;
}

export default function BudgetFilters({
  period,
  onPeriodChange,
  search,
  onSearchChange,
  type,
  onTypeChange,
  groupBy,
  onGroupByChange,
}: BudgetFiltersProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-2 text-sm text-slate-300">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Bulan</span>
          <div className="flex items-center gap-2 rounded-xl bg-slate-900/80 px-3 py-2 ring-1 ring-slate-800 focus-within:ring-[var(--accent)]/60">
            <CalendarIcon className="h-4 w-4 text-slate-500" />
            <input
              type="month"
              value={period}
              onChange={(event) => onPeriodChange(event.target.value)}
              className="w-full bg-transparent text-sm text-slate-100 outline-none"
              aria-label="Pilih bulan"
            />
          </div>
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-300">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cari kategori</span>
          <div className="flex items-center gap-2 rounded-xl bg-slate-900/80 px-3 py-2 ring-1 ring-slate-800 focus-within:ring-[var(--accent)]/60">
            <SearchIcon className="h-4 w-4 text-slate-500" />
            <input
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Nama kategori atau grup"
              className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-600 outline-none"
              aria-label="Cari kategori"
            />
          </div>
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-300">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tipe</span>
          <div className="rounded-xl bg-slate-900/80 px-3 py-2 ring-1 ring-slate-800 focus-within:ring-[var(--accent)]/60">
            <select
              value={type}
              onChange={(event) => onTypeChange(event.target.value as BudgetTypeFilter)}
              className="w-full bg-transparent text-sm text-slate-100 outline-none"
              aria-label="Filter tipe kategori"
            >
              <option value="all">Semua tipe</option>
              <option value="expense">Expense saja</option>
              <option value="income">Income saja</option>
            </select>
          </div>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onGroupByChange(!groupBy)}
          className={clsx(
            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60',
            groupBy ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'bg-slate-900/80 text-slate-300'
          )}
          aria-pressed={groupBy}
        >
          <ToggleIcon className="h-4 w-4" />
          Group by grup kategori
        </button>
      </div>
    </div>
  );
}
