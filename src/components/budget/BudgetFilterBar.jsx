export default function BudgetFilterBar({ filter, setFilter }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="month"
        className="input"
        value={filter.month}
        onChange={(e) => setFilter({ ...filter, month: e.target.value })}
      />
      <input
        type="text"
        className="input flex-1 min-w-[12rem]"
        placeholder="Cari kategori"
        value={filter.search || ""}
        onChange={(e) => setFilter({ ...filter, search: e.target.value })}
      />
    </div>
  );
}
