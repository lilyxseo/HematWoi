import {
  IconSearch as Search
} from '@tabler/icons-react';
import formatMonth from "../lib/formatMonth";

const defaults = {
  type: "all",
  month: "all",
  category: "all",
  sort: "date-desc",
  q: "",
};

export default function FilterBar({ months = [], categories = [], filter, setFilter }) {
  const reset = () => setFilter({ ...defaults });
  const showReset = Object.keys(defaults).some((k) => filter[k] !== defaults[k] && filter[k] !== "");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className="h-9 rounded-md border bg-surface-1 px-3 text-sm"
        value={filter.type}
        onChange={(e) => setFilter({ ...filter, type: e.target.value })}
      >
        <option value="all">Semua</option>
        <option value="income">Pemasukan</option>
        <option value="expense">Pengeluaran</option>
      </select>
      <select
        className="h-9 rounded-md border bg-surface-1 px-3 text-sm"
        value={filter.month}
        onChange={(e) => setFilter({ ...filter, month: e.target.value })}
      >
        <option value="all">Semua Bulan</option>
        {months.map((m) => (
          <option key={m} value={m}>
            {formatMonth(m)}
          </option>
        ))}
      </select>
      <select
        className="h-9 rounded-md border bg-surface-1 px-3 text-sm"
        value={filter.category}
        onChange={(e) => setFilter({ ...filter, category: e.target.value })}
      >
        <option value="all">Semua Kategori</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        className="h-9 rounded-md border bg-surface-1 px-3 text-sm"
        value={filter.sort}
        onChange={(e) => setFilter({ ...filter, sort: e.target.value })}
      >
        <option value="date-desc">Terbaru</option>
        <option value="date-asc">Terlama</option>
        <option value="amount-desc">Jumlah Terbesar</option>
        <option value="amount-asc">Jumlah Terkecil</option>
      </select>
      <div className="relative flex-1 min-w-[120px]">
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="text"
          placeholder="Cari"
          className="h-9 w-full rounded-md border bg-surface-1 pl-8 pr-3 text-sm"
          value={filter.q}
          onChange={(e) => setFilter({ ...filter, q: e.target.value })}
        />
      </div>
      {showReset && (
        <button className="ml-auto text-sm text-primary" onClick={reset}>
          Reset
        </button>
      )}
    </div>
  );
}
