import { useMemo, useState } from "react";

function toRupiah(n = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

export default function TopSpendsTable({ data = [], onSelect }) {
  const [sort, setSort] = useState("desc");

  const sorted = useMemo(() => {
    return [...data].sort((a, b) =>
      sort === "asc" ? a.amount - b.amount : b.amount - a.amount
    );
  }, [data, sort]);

  const toggleSort = () => setSort((s) => (s === "asc" ? "desc" : "asc"));

  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">Top Pengeluaran</h2>
        <button className="btn" onClick={toggleSort}>
          Sort {sort === "asc" ? "↑" : "↓"}
        </button>
      </div>
      <div className="table-wrap overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left">
            <tr>
              <th className="p-2">Catatan</th>
              <th className="p-2">Tanggal</th>
              <th className="p-2 text-right">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => (
              <tr
                key={t.id}
                className="cursor-pointer hover:bg-surface-2"
                onClick={() => onSelect && onSelect(t)}
              >
                <td className="p-2">{t.note || t.category || "-"}</td>
                <td className="p-2">{t.date}</td>
                <td className="p-2 text-right text-danger">
                  {toRupiah(t.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

