import { forwardRef } from "react";
import { CalendarDays, FilterX, Search } from "lucide-react";

interface TransactionsFiltersProps {
  categories: Array<{ id: string; name: string; color?: string | null }>;
  filter: {
    type: string;
    categories: string[];
    period: { start?: string; end?: string; preset?: string };
  };
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onCategoryChange: (value: string | null) => void;
  onDateChange: (range: { start: string; end: string }) => void;
  onClear: () => void;
}

const TransactionsFilters = forwardRef<HTMLInputElement, TransactionsFiltersProps>(
  (
    {
      categories,
      filter,
      searchTerm,
      onSearchChange,
      onTypeChange,
      onCategoryChange,
      onDateChange,
      onClear,
    },
    searchInputRef,
  ) => {
    const selectedCategory = filter.categories[0] ?? "";
    const startValue = filter.period.start ? filter.period.start.slice(0, 10) : "";
    const endValue = filter.period.end ? filter.period.end.slice(0, 10) : "";

    return (
      <div className="rounded-2xl bg-slate-900/80 p-4 ring-1 ring-slate-800 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <label className="relative flex h-11 items-center rounded-2xl ring-2 ring-slate-800 focus-within:ring-[var(--accent)]">
            <span className="sr-only">Cari transaksi</span>
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-500" aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="search"
              value={searchTerm}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Cari judul atau catatan"
              className="h-full w-full rounded-2xl bg-transparent pl-10 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
              aria-label="Cari transaksi"
            />
          </label>
          <label className="flex h-11 items-center rounded-2xl ring-2 ring-slate-800 focus-within:ring-[var(--accent)]">
            <span className="sr-only">Filter tipe transaksi</span>
            <select
              value={filter.type}
              onChange={(event) => onTypeChange(event.target.value)}
              className="h-full w-full rounded-2xl bg-transparent px-3 text-sm font-medium text-slate-200 focus:outline-none"
              aria-label="Filter tipe transaksi"
            >
              <option value="all">Semua tipe</option>
              <option value="income">Pemasukan</option>
              <option value="expense">Pengeluaran</option>
              <option value="transfer">Transfer</option>
            </select>
          </label>
          <label className="flex h-11 items-center rounded-2xl ring-2 ring-slate-800 focus-within:ring-[var(--accent)]">
            <span className="sr-only">Filter kategori transaksi</span>
            <select
              value={selectedCategory}
              onChange={(event) => {
                const value = event.target.value;
                onCategoryChange(value ? value : null);
              }}
              className="h-full w-full rounded-2xl bg-transparent px-3 text-sm font-medium text-slate-200 focus:outline-none"
              aria-label="Filter kategori transaksi"
            >
              <option value="">Semua kategori</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex h-11 items-center gap-2 rounded-2xl bg-slate-900/40 px-3 ring-2 ring-slate-800 focus-within:ring-[var(--accent)]">
            <CalendarDays className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <label className="flex-1 text-xs uppercase tracking-wide text-slate-500">
              <span className="sr-only">Tanggal mulai</span>
              <input
                type="date"
                value={startValue}
                onChange={(event) => onDateChange({ start: event.target.value, end: endValue })}
                className="h-6 w-full bg-transparent text-sm font-medium text-slate-200 focus:outline-none"
                aria-label="Tanggal mulai"
              />
            </label>
            <span className="text-slate-600">—</span>
            <label className="flex-1 text-xs uppercase tracking-wide text-slate-500">
              <span className="sr-only">Tanggal akhir</span>
              <input
                type="date"
                value={endValue}
                onChange={(event) => onDateChange({ start: startValue, end: event.target.value })}
                className="h-6 w-full bg-transparent text-sm font-medium text-slate-200 focus:outline-none"
                aria-label="Tanggal akhir"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900/40 text-sm font-semibold text-slate-300 ring-2 ring-slate-800 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <FilterX className="h-4 w-4" aria-hidden="true" />
            Reset
          </button>
        </div>
      </div>
    );
  },
);

TransactionsFilters.displayName = "TransactionsFilters";

export default TransactionsFilters;
