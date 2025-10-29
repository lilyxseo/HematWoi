import { ChangeEvent } from "react";
import clsx from "clsx";

export interface CalendarFilterFormState {
  includeIncome: boolean;
  categories: string[];
  accounts: string[];
  amountMin: number | null;
  amountMax: number | null;
  search: string;
}

export interface CalendarFiltersProps {
  filters: CalendarFilterFormState;
  categories: { id: string; name: string; type?: string | null }[];
  accounts: { id: string; name: string }[];
  isCategoryLoading?: boolean;
  isAccountLoading?: boolean;
  onChange: (next: CalendarFilterFormState) => void;
  onReset: () => void;
  resetDisabled?: boolean;
}

function toMultiValue(event: ChangeEvent<HTMLSelectElement>): string[] {
  return Array.from(event.target.selectedOptions).map((option) => option.value);
}

export default function Filters({
  filters,
  categories,
  accounts,
  isCategoryLoading = false,
  isAccountLoading = false,
  onChange,
  onReset,
  resetDisabled = false,
}: CalendarFiltersProps) {
  const handleChange = (patch: Partial<CalendarFilterFormState>) => {
    onChange({ ...filters, ...patch });
  };

  return (
    <div className="rounded-3xl border border-slate-900/60 bg-slate-950/60 p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Filter</h2>
          <p className="text-xs text-slate-400">Sesuaikan jenis transaksi yang ingin ditampilkan.</p>
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={resetDisabled}
          className={clsx(
            "inline-flex items-center gap-2 rounded-xl border border-slate-800 px-3 py-2 text-sm font-medium transition",
            resetDisabled
              ? "cursor-not-allowed bg-slate-900/40 text-slate-500"
              : "bg-slate-900/70 text-slate-200 hover:bg-slate-900",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
          )}
        >
          Reset
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Jenis Transaksi
          </label>
          <div className="mt-2 inline-flex rounded-2xl border border-slate-900/70 bg-slate-900/40 p-1 text-sm">
            <button
              type="button"
              onClick={() => handleChange({ includeIncome: false })}
              className={clsx(
                "flex-1 rounded-2xl px-3 py-2 font-medium transition",
                !filters.includeIncome
                  ? "bg-[var(--accent)]/20 text-[var(--accent)]"
                  : "text-slate-400 hover:text-slate-200",
              )}
            >
              Expense saja
            </button>
            <button
              type="button"
              onClick={() => handleChange({ includeIncome: true })}
              className={clsx(
                "flex-1 rounded-2xl px-3 py-2 font-medium transition",
                filters.includeIncome
                  ? "bg-[var(--accent)]/20 text-[var(--accent)]"
                  : "text-slate-400 hover:text-slate-200",
              )}
            >
              Expense + Income
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Kategori
          </label>
          <select
            multiple
            value={filters.categories}
            onChange={(event) => handleChange({ categories: toMultiValue(event) })}
            className="mt-2 h-28 w-full rounded-2xl border border-slate-900/70 bg-slate-900/60 p-3 text-sm text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            {isCategoryLoading ? (
              <option value="" disabled>
                Memuat kategori...
              </option>
            ) : categories.length === 0 ? (
              <option value="" disabled>
                Tidak ada kategori
              </option>
            ) : (
              categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))
            )}
          </select>
          <p className="mt-1 text-[11px] text-slate-500">
            Pilih lebih dari satu kategori dengan menahan tombol Ctrl (Windows) atau Command (Mac).
          </p>
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Akun
          </label>
          <select
            multiple
            value={filters.accounts}
            onChange={(event) => handleChange({ accounts: toMultiValue(event) })}
            className="mt-2 h-28 w-full rounded-2xl border border-slate-900/70 bg-slate-900/60 p-3 text-sm text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            {isAccountLoading ? (
              <option value="" disabled>
                Memuat akun...
              </option>
            ) : accounts.length === 0 ? (
              <option value="" disabled>
                Tidak ada akun
              </option>
            ) : (
              accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Nominal Minimum
            </label>
            <input
              type="number"
              min={0}
              step={1000}
              inputMode="numeric"
              value={filters.amountMin ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                handleChange({ amountMin: value === "" ? null : Number(value) });
              }}
              className="mt-2 h-11 w-full rounded-2xl border border-slate-900/70 bg-slate-900/60 px-3 text-sm text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Nominal Maksimum
            </label>
            <input
              type="number"
              min={0}
              step={1000}
              inputMode="numeric"
              value={filters.amountMax ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                handleChange({ amountMax: value === "" ? null : Number(value) });
              }}
              className="mt-2 h-11 w-full rounded-2xl border border-slate-900/70 bg-slate-900/60 px-3 text-sm text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              placeholder="0"
            />
          </div>
        </div>

        <div className="md:col-span-2 xl:col-span-3">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Cari Catatan atau Merchant
          </label>
          <input
            type="search"
            value={filters.search}
            onChange={(event) => handleChange({ search: event.target.value })}
            placeholder="Cari berdasarkan catatan atau merchant"
            className="mt-2 h-11 w-full rounded-2xl border border-slate-900/70 bg-slate-900/60 px-3 text-sm text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          />
        </div>
      </div>
    </div>
  );
}
