import { useMemo } from 'react';
import type { ChangeEvent } from 'react';

export type BudgetSortOption = 'name' | 'planned' | 'actual' | 'remaining';
export type BudgetStatusOption = 'all' | 'on-track' | 'overspend' | 'warning';

export interface BudgetsFilterState {
  q: string;
  categoryId: string | 'all';
  status: BudgetStatusOption;
  sort: BudgetSortOption;
  open: boolean;
}

interface BudgetsFilterBarProps {
  filters: BudgetsFilterState;
  onChange: (next: BudgetsFilterState) => void;
  categories: { id: string; name: string; type: 'income' | 'expense' }[];
}

export default function BudgetsFilterBar({ filters, onChange, categories }: BudgetsFilterBarProps) {
  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filters, q: event.target.value });
  };

  const handleSelect = (key: keyof Pick<BudgetsFilterState, 'categoryId' | 'status' | 'sort'>) =>
    (event: ChangeEvent<HTMLSelectElement>) => {
      onChange({ ...filters, [key]: event.target.value });
    };

  const categoryOptions = useMemo(() => {
    return [
      { id: 'all', name: 'Semua Kategori', type: 'expense' as const },
      ...categories,
    ];
  }, [categories]);

  return (
    <div className="rounded-2xl border border-border bg-surface-1 p-4">
      <div className="flex items-center justify-between lg:hidden">
        <p className="text-sm font-medium">Filter</p>
        <button
          type="button"
          className="text-sm font-medium text-[var(--brand)]"
          onClick={() => onChange({ ...filters, open: !filters.open })}
        >
          {filters.open ? 'Sembunyikan ▴' : 'Filter ▾'}
        </button>
      </div>
      <div
        className={`mt-4 grid gap-4 lg:mt-0 lg:grid-cols-[1fr_1fr_1fr_1fr] ${
          filters.open ? 'grid' : 'hidden lg:grid'
        }`}
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted" htmlFor="budget-filter-search">
            Cari
          </label>
          <input
            id="budget-filter-search"
            className="h-11 rounded-2xl border border-border bg-surface-2 px-3 text-sm"
            value={filters.q}
            onChange={handleInput}
            placeholder="Cari anggaran atau catatan"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted" htmlFor="budget-filter-category">
            Kategori
          </label>
          <select
            id="budget-filter-category"
            className="h-11 rounded-2xl border border-border bg-surface-2 px-3 text-sm"
            value={filters.categoryId}
            onChange={handleSelect('categoryId')}
          >
            {categoryOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted" htmlFor="budget-filter-status">
            Status
          </label>
          <select
            id="budget-filter-status"
            className="h-11 rounded-2xl border border-border bg-surface-2 px-3 text-sm"
            value={filters.status}
            onChange={handleSelect('status')}
          >
            <option value="all">Semua</option>
            <option value="on-track">On Track</option>
            <option value="warning">Mendekati Batas</option>
            <option value="overspend">Overspend</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted" htmlFor="budget-filter-sort">
            Urutkan
          </label>
          <select
            id="budget-filter-sort"
            className="h-11 rounded-2xl border border-border bg-surface-2 px-3 text-sm"
            value={filters.sort}
            onChange={handleSelect('sort')}
          >
            <option value="name">Nama</option>
            <option value="planned">Rencana</option>
            <option value="actual">Aktual</option>
            <option value="remaining">Sisa</option>
          </select>
        </div>
      </div>
    </div>
  );
}
