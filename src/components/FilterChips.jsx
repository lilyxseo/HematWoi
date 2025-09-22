import { X } from "lucide-react";
import formatMonth from "../lib/formatMonth";

export default function FilterChips({ filter, categories = [], onRemove }) {
  const chips = [];
  if (filter.type && filter.type !== "all") {
    chips.push({ key: "type", label: filter.type === "income" ? "Pemasukan" : "Pengeluaran" });
  }
  if (filter.month && filter.month !== "all") {
    chips.push({ key: "month", label: formatMonth(filter.month) });
  }
  if (filter.category && filter.category !== "all") {
    const cat = categories.find((c) => c.id === filter.category);
    if (cat) chips.push({ key: "category", label: cat.name });
  }
  if (filter.q && filter.q.trim()) {
    chips.push({ key: "q", label: `Cari: ${filter.q}` });
  }
  if (filter.sort && filter.sort !== "date-desc") {
    const text =
      filter.sort === "date-asc"
        ? "Terlama"
        : filter.sort === "amount-asc"
        ? "Jumlah Terkecil"
        : filter.sort === "amount-desc"
        ? "Jumlah Terbesar"
        : "";
    if (text) chips.push({ key: "sort", label: text });
  }

  if (!chips.length) return null;

  return (
    <div className="mt-2 overflow-x-auto">
      <div className="flex w-max gap-2 py-1">
        {chips.map((chip) => (
          <button
            key={chip.key}
            className="chip whitespace-nowrap text-sm transition hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
            onClick={() => onRemove(chip.key)}
          >
            {chip.label} <X className="h-3 w-3" />
          </button>
        ))}
      </div>
    </div>
  );
}
