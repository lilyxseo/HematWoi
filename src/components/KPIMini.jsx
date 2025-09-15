export default function KPIMini({ items = [] }) {
  const income = items.filter((i) => i.type === "income").reduce((a, b) => a + b.amount, 0);
  const expense = items.filter((i) => i.type === "expense").reduce((a, b) => a + b.amount, 0);
  const net = income - expense;

  const Card = ({ title, value, className }) => (
    <div className="rounded-md border bg-surface-1 p-3 shadow-sm">
      <div className="text-xs text-muted">{title}</div>
      <div className={`font-semibold ${className}`}>Rp {value.toLocaleString("id-ID")}</div>
    </div>
  );

  return (
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Card title="Pemasukan" value={income} className="text-success" />
      <Card title="Pengeluaran" value={expense} className="text-danger" />
      <Card title="Net" value={net} className={net >= 0 ? "text-success" : "text-danger"} />
    </div>
  );
}
