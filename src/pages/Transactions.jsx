import Filters from "../components/Filters";
import TxTable from "../components/TxTable";
import FAB from "../components/FAB";
import PageHeader from "../layout/PageHeader";

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
      <PageHeader title="Transaksi" description="Kelola catatan keuangan" />
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
