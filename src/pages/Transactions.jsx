import Filters from "../components/Filters";
import TxTable from "../components/TxTable";
import FAB from "../components/FAB";

export default function Transactions({
  months,
  categories,
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
      <Filters
        months={months}
        categories={categories}
        filter={filter}
        setFilter={setFilter}
      />
      <TxTable items={items} onRemove={onRemove} onUpdate={onUpdate} />
      <FAB />
    </main>
  );
}
