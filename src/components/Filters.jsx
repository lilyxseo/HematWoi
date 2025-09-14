export default function Filters({ months, filter, setFilter }) {
  return (
    <div className="grid gap-2">
      <div>
        <label className="block text-xs text-slate-500 mb-1">Jenis</label>
        <select
          className="input focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20"
          value={filter.type}
          onChange={(e) => setFilter((f) => ({ ...f, type: e.target.value }))}
        >
          <option value="all">Semua</option>
          <option value="income">Pemasukan</option>
          <option value="expense">Pengeluaran</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Bulan</label>
        <select
          className="input focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20"
          value={filter.month}
          onChange={(e) => setFilter((f) => ({ ...f, month: e.target.value }))}
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {m === "all" ? "Semua" : m}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Cari</label>
        <input
          className="input focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20"
          placeholder="kategori / catatan"
          value={filter.q}
          onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
        />
      </div>
    </div>
  );
}
