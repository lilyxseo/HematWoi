import Row from "./Row.jsx";

export default function TxTable({ items, onRemove, onUpdate }) {
  if (!items.length) return <p className="text-sm text-slate-500">Belum ada data…</p>;

  return (
    <div className="overflow-auto">
      <table className="w-full border-separate [border-spacing:0_0.5rem]">
        <thead>
          <tr>
            <th className="text-left text-xs text-slate-500 px-2 py-1">Tanggal</th>
            <th className="text-left text-xs text-slate-500 px-2 py-1">Jenis</th>
            <th className="text-left text-xs text-slate-500 px-2 py-1">Kategori</th>
            <th className="text-left text-xs text-slate-500 px-2 py-1">Catatan</th>
            <th className="text-right text-xs text-slate-500 px-2 py-1">Jumlah</th>
            <th className="px-2 py-1" />
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <Row key={t.id} t={t} onRemove={onRemove} onUpdate={onUpdate} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
