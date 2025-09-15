function formatMonth(m) {
  if (!m) return '';
  const date = new Date(`${m}-01`);
  return date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
}

export default function Filters({
  months = [],
  categories = [],
  filter,
  setFilter,
}) {
  return (
    <div className="card flex flex-wrap items-center gap-2">
      <select
        className="rounded-lg border px-3 py-2"
        value={filter.type}
        onChange={(e) => setFilter({ ...filter, type: e.target.value })}
      >
        <option value="all">Semua</option>
        <option value="income">Pemasukan</option>
        <option value="expense">Pengeluaran</option>
      </select>
      <select
        className="rounded-lg border px-3 py-2"
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
        className="rounded-lg border px-3 py-2"
        value={filter.category}
        onChange={(e) => setFilter({ ...filter, category: e.target.value })}
      >
        <option value="all">Semua Kategori</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <select
        className="rounded-lg border px-3 py-2"
        value={filter.sort}
        onChange={(e) => setFilter({ ...filter, sort: e.target.value })}
      >
        <option value="date-desc">Terbaru</option>
        <option value="date-asc">Terlama</option>
        <option value="amount-desc">Jumlah Terbesar</option>
        <option value="amount-asc">Jumlah Terkecil</option>
      </select>
      <input
        type="text"
        placeholder="Cari"
        className="rounded-lg border px-3 py-2 flex-1 min-w-[120px]"
        value={filter.q}
        onChange={(e) => setFilter({ ...filter, q: e.target.value })}
      />
    </div>
  );
}
