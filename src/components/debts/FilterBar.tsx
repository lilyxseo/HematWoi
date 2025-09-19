import { ChangeEvent, FormEvent } from 'react';
import { Search, RotateCcw } from 'lucide-react';
import type { DebtStatus, DebtType } from '../../lib/api-debts';

export type DebtsFilterState = {
  q: string;
  type: DebtType | 'all';
  status: DebtStatus | 'all';
  dateField: 'created_at' | 'due_date';
  dateFrom: string | null;
  dateTo: string | null;
  sort: 'newest' | 'oldest' | 'due_soon' | 'amount';
};

interface FilterBarProps {
  filters: DebtsFilterState;
  onChange: (filters: DebtsFilterState) => void;
  onReset?: () => void;
}

const TYPE_OPTIONS: { value: DebtsFilterState['type']; label: string }[] = [
  { value: 'all', label: 'Semua tipe' },
  { value: 'debt', label: 'Hutang' },
  { value: 'receivable', label: 'Piutang' },
];

const STATUS_OPTIONS: { value: DebtsFilterState['status']; label: string }[] = [
  { value: 'all', label: 'Semua status' },
  { value: 'ongoing', label: 'Berjalan' },
  { value: 'paid', label: 'Lunas' },
  { value: 'overdue', label: 'Jatuh Tempo' },
];

const DATE_FIELD_OPTIONS: { value: DebtsFilterState['dateField']; label: string }[] = [
  { value: 'created_at', label: 'Tanggal dibuat' },
  { value: 'due_date', label: 'Jatuh tempo' },
];

const SORT_OPTIONS: { value: DebtsFilterState['sort']; label: string }[] = [
  { value: 'newest', label: 'Terbaru' },
  { value: 'oldest', label: 'Terlama' },
  { value: 'due_soon', label: 'Jatuh tempo terdekat' },
  { value: 'amount', label: 'Jumlah terbesar' },
];

export default function FilterBar({ filters, onChange, onReset }: FilterBarProps) {
  const handleSelect = (
    event: ChangeEvent<HTMLSelectElement>,
    key: keyof DebtsFilterState,
  ) => {
    const value = event.target.value as DebtsFilterState[keyof DebtsFilterState];
    onChange({ ...filters, [key]: value });
  };

  const handleInput = (
    event: ChangeEvent<HTMLInputElement>,
    key: keyof DebtsFilterState,
  ) => {
    const value = event.target.value as DebtsFilterState[keyof DebtsFilterState];
    onChange({ ...filters, [key]: value });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  const handleReset = () => {
    onReset?.();
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-border/60 bg-surface-1/90 p-4 shadow-sm">
      <div className="grid gap-3 min-[420px]:grid-cols-2 lg:grid-cols-7">
        <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-muted min-w-0">
          <span>Tipe</span>
          <select
            value={filters.type}
            onChange={(event) => handleSelect(event, 'type')}
            className="h-[40px] w-full rounded-xl border border-border bg-surface-1 px-3 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-muted min-w-0">
          <span>Status</span>
          <select
            value={filters.status}
            onChange={(event) => handleSelect(event, 'status')}
            className="h-[40px] w-full rounded-xl border border-border bg-surface-1 px-3 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-muted min-w-0">
          <span>Rentang</span>
          <select
            value={filters.dateField}
            onChange={(event) => handleSelect(event, 'dateField')}
            className="h-[40px] w-full rounded-xl border border-border bg-surface-1 px-3 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
          >
            {DATE_FIELD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-muted min-w-0">
          <span>Dari</span>
          <input
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(event) => handleInput(event, 'dateFrom')}
            className="h-[40px] w-full rounded-xl border border-border bg-surface-1 px-3 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-muted min-w-0">
          <span>Sampai</span>
          <input
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(event) => handleInput(event, 'dateTo')}
            className="h-[40px] w-full rounded-xl border border-border bg-surface-1 px-3 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-muted min-w-0">
          <span>Urutkan</span>
          <select
            value={filters.sort}
            onChange={(event) => handleSelect(event, 'sort')}
            className="h-[40px] w-full rounded-xl border border-border bg-surface-1 px-3 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="col-span-full flex min-w-0 items-center gap-2 rounded-xl border border-border bg-surface-1 px-3 text-sm text-text shadow-sm focus-within:ring-2 focus-within:ring-[color:var(--brand-ring)] min-[420px]:col-span-2 lg:col-span-2">
          <Search className="h-4 w-4 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={filters.q}
            onChange={(event) => handleInput(event, 'q')}
            placeholder="Cari pihak, judul, atau catatan"
            className="h-[38px] w-full min-w-0 bg-transparent text-sm text-text placeholder:text-muted focus-visible:outline-none"
            aria-label="Pencarian hutang"
          />
          {onReset ? (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
              aria-label="Reset filter"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
    </form>
  );
}
