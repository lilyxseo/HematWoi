import clsx from "clsx";
import { Calendar, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";

interface PeriodFilter {
  preset: string;
  start: string;
  end: string;
}

interface TransactionsFilterValue {
  search: string;
  type: string;
  categories: string[];
  period: PeriodFilter;
}

interface CategoryOption {
  id: string;
  name?: string | null;
}

interface TransactionsFiltersProps {
  filter: TransactionsFilterValue;
  categories: CategoryOption[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onFilterChange: (patch: Partial<TransactionsFilterValue>) => void;
  onReset: () => void;
  searchInputRef?: MutableRefObject<{ focus: () => void } | null>;
}

const controlClass =
  "h-11 w-full rounded-2xl bg-slate-900/60 px-4 text-sm text-slate-200 ring-2 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

export default function TransactionsFilters({
  filter,
  categories,
  searchTerm,
  onSearchChange,
  onFilterChange,
  onReset,
  searchInputRef,
}: TransactionsFiltersProps) {
  const [categoryOpen, setCategoryOpen] = useState(false);
  const categoryButtonRef = useRef<HTMLButtonElement | null>(null);
  const categoryPanelRef = useRef<HTMLDivElement | null>(null);
  const searchFieldRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!searchInputRef) return;
    searchInputRef.current = {
      focus: () => {
        searchFieldRef.current?.focus();
        searchFieldRef.current?.select();
      },
    };
  }, [searchInputRef]);

  useEffect(() => {
    if (!categoryOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (categoryButtonRef.current?.contains(target)) return;
      if (categoryPanelRef.current?.contains(target)) return;
      setCategoryOpen(false);
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [categoryOpen]);

  const selectedCategoryNames = useMemo(() => {
    if (!filter.categories?.length) return [] as string[];
    const index = new Map(categories.map((cat) => [cat.id, cat.name || "(Tanpa kategori)"]));
    return filter.categories.map((id) => index.get(id) || "Kategori");
  }, [categories, filter.categories]);

  const categoryLabel = selectedCategoryNames.length
    ? selectedCategoryNames.slice(0, 2).join(", ") + (selectedCategoryNames.length > 2 ? ` +${selectedCategoryNames.length - 2}` : "")
    : "Semua kategori";

  const handleToggleCategory = (categoryId: string) => {
    const next = new Set(filter.categories);
    if (next.has(categoryId)) {
      next.delete(categoryId);
    } else {
      next.add(categoryId);
    }
    onFilterChange({ categories: Array.from(next) });
  };

  const handleStartDateChange = (value: string) => {
    const trimmed = value;
    const nextPeriod: PeriodFilter = {
      ...filter.period,
      start: trimmed,
      preset: trimmed || filter.period.end ? "custom" : "all",
    };
    if (!nextPeriod.preset) nextPeriod.preset = "all";
    onFilterChange({ period: nextPeriod });
  };

  const handleEndDateChange = (value: string) => {
    const trimmed = value;
    const nextPeriod: PeriodFilter = {
      ...filter.period,
      end: trimmed,
      preset: filter.period.start || trimmed ? "custom" : "all",
    };
    if (!nextPeriod.preset) nextPeriod.preset = "all";
    onFilterChange({ period: nextPeriod });
  };

  const startValue = filter.period.preset === "custom" ? filter.period.start : "";
  const endValue = filter.period.preset === "custom" ? filter.period.end : "";

  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-slate-900/60 p-4 ring-1 ring-slate-800 backdrop-blur">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <div className="md:col-span-2">
          <label htmlFor="transactions-search" className="sr-only">
            Cari transaksi
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="transactions-search"
              type="search"
              value={searchTerm}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Cari judul atau catatan"
              ref={searchFieldRef}
              className={clsx(controlClass, "pl-10")}
              aria-label="Cari transaksi"
            />
          </div>
        </div>
        <div>
          <label htmlFor="transactions-type" className="sr-only">
            Filter jenis transaksi
          </label>
          <select
            id="transactions-type"
            value={filter.type}
            onChange={(event) => onFilterChange({ type: event.target.value })}
            className={controlClass}
            aria-label="Filter jenis transaksi"
          >
            <option value="all">Semua tipe</option>
            <option value="income">Pemasukan</option>
            <option value="expense">Pengeluaran</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>
        <div className="relative">
          <button
            type="button"
            ref={categoryButtonRef}
            onClick={() => setCategoryOpen((open) => !open)}
            className={clsx(controlClass, "flex items-center justify-between gap-2 px-4 text-left")}
            aria-haspopup="listbox"
            aria-expanded={categoryOpen}
          >
            <span className="truncate text-sm font-medium text-slate-200">{categoryLabel}</span>
            <ChevronDown className={clsx("h-4 w-4 transition-transform", categoryOpen ? "rotate-180" : "rotate-0")} aria-hidden="true" />
          </button>
          {categoryOpen && (
            <div
              ref={categoryPanelRef}
              role="listbox"
              aria-multiselectable="true"
              className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl bg-slate-900/95 p-2 text-sm text-slate-200 shadow-xl ring-1 ring-slate-800"
            >
              <button
                type="button"
                onClick={() => onFilterChange({ categories: [] })}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
              >
                <span>Semua kategori</span>
                {!filter.categories.length && <span className="text-[var(--accent)]">Aktif</span>}
              </button>
              <div className="my-2 h-px bg-slate-800" aria-hidden="true" />
              {categories.map((category) => {
                const checked = filter.categories.includes(category.id);
                return (
                  <label
                    key={category.id}
                    className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-slate-800 focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--accent)]/60"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleCategory(category.id)}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
                    />
                    <span className="truncate">{category.name || "(Tanpa kategori)"}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="transactions-start-date" className="sr-only">
            Tanggal mulai
          </label>
          <div className="relative flex-1">
            <Calendar className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="transactions-start-date"
              type="date"
              value={startValue}
              onChange={(event) => handleStartDateChange(event.target.value)}
              className={clsx(controlClass, "pl-10")}
              aria-label="Tanggal mulai"
            />
          </div>
          <label htmlFor="transactions-end-date" className="sr-only">
            Tanggal selesai
          </label>
          <div className="relative flex-1">
            <Calendar className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="transactions-end-date"
              type="date"
              value={endValue}
              onChange={(event) => handleEndDateChange(event.target.value)}
              className={clsx(controlClass, "pl-10")}
              aria-label="Tanggal selesai"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 md:justify-start">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-sm font-medium text-slate-300 ring-2 ring-slate-800 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Bersihkan
          </button>
        </div>
      </div>
    </div>
  );
}
