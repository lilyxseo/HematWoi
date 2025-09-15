import Filters from "../components/Filters";
import TxTable from "../components/TxTable";

export default function Transactions({
  months,
  filter,
  setFilter,
  items,
  onRemove,
  onUpdate,
}) {
  return (
    <main className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="card">
        <h1 className="text-sm font-semibold">Transaksi</h1>
      </div>
      <Filters months={months} filter={filter} setFilter={setFilter} />
      <TxTable items={items} onRemove={onRemove} onUpdate={onUpdate} />
    </main>
  );
}
