import { ChangeEvent, FormEvent } from 'react';
import { RotateCcw, Search } from 'lucide-react';
import type { GoalPriority, GoalStatus } from '../../lib/api-goals';

export interface GoalsFilterState {
  q: string;
  status: GoalStatus | 'all';
  priority: GoalPriority | 'all';
  dateField: 'created_at' | 'due_date';
  dateFrom: string | null;
  dateTo: string | null;
  categoryId: string | 'all';
  sort: 'newest' | 'oldest' | 'deadline';
}

interface CategoryOption {
  id: string;
  name: string;
}

interface GoalsFilterBarProps {
  filters: GoalsFilterState;
  categories: CategoryOption[];
  onChange: (filters: GoalsFilterState) => void;
  onReset?: () => void;
}

const STATUS_OPTIONS: { value: GoalsFilterState['status']; label: string }[] = [
  { value: 'all', label: 'Semua status' },
  { value: 'active', label: 'Aktif' },
  { value: 'paused', label: 'Ditahan' },
  { value: 'achieved', label: 'Tercapai' },
  { value: 'archived', label: 'Diarsipkan' },
];

const PRIORITY_OPTIONS: { value: GoalsFilterState['priority']; label: string }[] = [
  { value: 'all', label: 'Semua prioritas' },
  { value: 'low', label: 'Rendah' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Tinggi' },
  { value: 'urgent', label: 'Mendesak' },
];

const RANGE_OPTIONS: { value: GoalsFilterState['dateField']; label: string }[] = [
  { value: 'created_at', label: 'Tanggal dibuat' },
  { value: 'due_date', label: 'Tanggal target' },
];

const SORT_OPTIONS: { value: GoalsFilterState['sort']; label: string }[] = [
  { value: 'newest', label: 'Terbaru' },
  { value: 'oldest', label: 'Terlama' },
  { value: 'deadline', label: 'Deadline terdekat' },
];

export default function GoalsFilterBar({ filters, categories, onChange, onReset }: GoalsFilterBarProps) {
  const handleSelect = (event: ChangeEvent<HTMLSelectElement>, key: keyof GoalsFilterState) => {
    const value = event.target.value as GoalsFilterState[keyof GoalsFilterState];
    onChange({ ...filters, [key]: value });
  };

  const handleInput = (event: ChangeEvent<HTMLInputElement>, key: keyof GoalsFilterState) => {
    const value = event.target.value as GoalsFilterState[keyof GoalsFilterState];
    onChange({ ...filters, [key]: value });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  const handleReset = () => {
    onReset?.();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="min-w-0 rounded-3xl border border-border/60 bg-surface-1/90 p-4 shadow-sm"
    >
      <div className="grid grid-cols-2 items-center gap-3 md:grid-cols-8">
        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
          <span className="truncate">Status</span>
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

        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
          <span className="truncate">Prioritas</span>
          <select
            value={filters.priority}
            onChange={(event) => handleSelect(event, 'priority')}
            className="h-[40px] w-full rounded-xl border border-border bg-surface-1 px-3 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
          <span className="truncate">Rentang</span>
          <select
            value={filters.dateField}
            onChange={(event) => handleSelect(event, 'dateField')}
            className="h-[40px] w-full rounded-xl border border-border bg-surface-1 px-3 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
          <span className="truncate">Dari</span>
          <input
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(event) => handleInput(event, 'dateFrom')}
            className="h-[40px] w-full rounded-xl border border-border bg-surface-1 px-3 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
          />
        </label>

        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
          <span className="truncate">Sampai</span>
          <input
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(event) => handleInput(event, 'dateTo')}
            className="h-[40px] w-full rounded-xl border border-border bg-surface-1 px-3 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
          />
        </label>

        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
          <span className="truncate">Kategori</span>
          <select
            value={filters.categoryId}
            onChange={(event) => handleSelect(event, 'categoryId')}
            className="h-[40px] w-full rounded-xl border border-border bg-surface-1 px-3 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
          >
            <option value="all">Semua kategori</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
          <span className="truncate">Urutkan</span>
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

        <div className="col-span-2 flex h-[40px] min-w-0 items-center gap-2 rounded-xl border border-border bg-surface-1 px-3 text-sm text-text shadow-sm focus-within:ring-2 focus-within:ring-[color:var(--brand-ring)] md:col-span-2 lg:col-span-2 xl:col-span-2">
          <Search className="h-4 w-4 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={filters.q}
            onChange={(event) => handleInput(event, 'q')}
            placeholder="Cari judul atau catatan"
            className="h-full w-full min-w-0 bg-transparent text-sm text-text placeholder:text-muted focus-visible:outline-none"
            aria-label="Pencarian goal"
          />
          {onReset ? (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
              aria-label="Reset filter goal"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
    </form>
  );
}
