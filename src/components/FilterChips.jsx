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
    <div className="mt-2 flex flex-wrap gap-2">
      {chips.map((chip) => (
        <button
          key={chip.key}
          className="rounded-full bg-surface-3 px-3 py-1 text-sm"
          onClick={() => onRemove(chip.key)}
        >
          {chip.label} <span className="ml-1">×</span>
        </button>
      ))}
    </div>
  );
}
