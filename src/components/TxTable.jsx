import Row from './Row';

export default function TxTable({ items = [], onRemove, onUpdate }) {
  return (
    <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="p-2">Kategori</th>
            <th className="p-2">Tanggal</th>
            <th className="p-2">Catatan</th>
            <th className="p-2 text-right">Jumlah</th>
            <th className="p-2" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <Row key={item.id} item={item} onRemove={onRemove} onUpdate={onUpdate} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
