import { ChangeEvent, Ref } from "react";
import clsx from "clsx";
import { Search } from "lucide-react";

interface TransactionsFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  type: string;
  onTypeChange: (value: string) => void;
  categories: Array<{ id: string; name: string } | null> | null | undefined;
  selectedCategories: string[];
  onCategoriesChange: (value: string[]) => void;
  dateRange: { start?: string; end?: string };
  onDateRangeChange: (start: string, end: string) => void;
  onClear: () => void;
  className?: string;
  searchInputRef?: Ref<HTMLInputElement>;
}

const TYPE_OPTIONS = [
  { value: "all", label: "Semua" },
  { value: "income", label: "Pemasukan" },
  { value: "expense", label: "Pengeluaran" },
  { value: "transfer", label: "Transfer" },
];

export default function TransactionsFilters({
  searchTerm,
  onSearchChange,
  type,
  onTypeChange,
  categories,
  selectedCategories,
  onCategoriesChange,
  dateRange,
  onDateRangeChange,
  onClear,
  className,
  searchInputRef,
}: TransactionsFiltersProps) {
  const selectedCategory = selectedCategories[0] ?? "";

  const handleCategoryChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (!value) {
      onCategoriesChange([]);
    } else {
      onCategoriesChange([value]);
    }
  };

  return (
    <div
      className={clsx(
        "rounded-2xl bg-slate-950/60 p-4 shadow-lg ring-1 ring-slate-800 backdrop-blur",
        className,
      )}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,240px)_minmax(0,180px)_minmax(0,220px)_repeat(2,minmax(0,160px))]">
        <label className="group relative flex h-11 items-center overflow-hidden rounded-2xl ring-2 ring-slate-800 transition focus-within:ring-[var(--accent)]">
          <Search className="pointer-events-none ml-3 h-4 w-4 text-slate-500 transition group-focus-within:text-[var(--accent)]" aria-hidden="true" />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Cari judul atau catatan"
            className="h-full w-full bg-transparent px-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
            aria-label="Cari transaksi"
            ref={searchInputRef}
          />
        </label>

        <label className="flex h-11 items-center rounded-2xl ring-2 ring-slate-800 focus-within:ring-[var(--accent)]">
          <span className="sr-only">Filter tipe transaksi</span>
          <select
            value={type}
            onChange={(event) => onTypeChange(event.target.value)}
            className="h-full w-full rounded-2xl bg-transparent px-3 text-sm text-slate-200 focus:outline-none"
            aria-label="Filter tipe transaksi"
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} className="bg-slate-900 text-slate-200">
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex h-11 items-center rounded-2xl ring-2 ring-slate-800 focus-within:ring-[var(--accent)]">
          <span className="sr-only">Filter kategori transaksi</span>
          <select
            value={selectedCategory}
            onChange={handleCategoryChange}
            className="h-full w-full rounded-2xl bg-transparent px-3 text-sm text-slate-200 focus:outline-none"
            aria-label="Filter kategori transaksi"
          >
            <option value="" className="bg-slate-900 text-slate-200">
              Semua kategori
            </option>
            {(categories || [])
              ?.filter(Boolean)
              .map((category) => (
                <option key={category!.id} value={category!.id} className="bg-slate-900 text-slate-200">
                  {category!.name || "Tanpa nama"}
                </option>
              ))}
          </select>
        </label>

        <label className="flex h-11 items-center rounded-2xl ring-2 ring-slate-800 focus-within:ring-[var(--accent)]">
          <span className="sr-only">Tanggal mulai</span>
          <input
            type="date"
            value={dateRange.start ?? ""}
            onChange={(event) => onDateRangeChange(event.target.value, dateRange.end ?? "")}
            className="h-full w-full rounded-2xl bg-transparent px-3 text-sm text-slate-200 focus:outline-none"
            aria-label="Tanggal mulai"
          />
        </label>

        <label className="flex h-11 items-center rounded-2xl ring-2 ring-slate-800 focus-within:ring-[var(--accent)]">
          <span className="sr-only">Tanggal akhir</span>
          <input
            type="date"
            value={dateRange.end ?? ""}
            min={dateRange.start ?? undefined}
            onChange={(event) => onDateRangeChange(dateRange.start ?? "", event.target.value)}
            className="h-full w-full rounded-2xl bg-transparent px-3 text-sm text-slate-200 focus:outline-none"
            aria-label="Tanggal akhir"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-11 items-center rounded-2xl px-4 text-sm font-semibold text-slate-300 transition hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Bersihkan
        </button>
      </div>
    </div>
  );
}
