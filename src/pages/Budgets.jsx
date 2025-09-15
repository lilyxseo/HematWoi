import BudgetSection from "../components/BudgetSection";

export default function Budgets({ currentMonth, data, onAdd, onRemove }) {
  return (
    <main className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="card">
        <h1 className="text-sm font-semibold">Anggaran</h1>
      </div>
      <BudgetSection
        filterMonth={currentMonth}
        budgets={data.budgets}
        txs={data.txs}
        categories={data.cat}
        onAdd={onAdd}
        onRemove={onRemove}
      />
    </main>
  );
}
