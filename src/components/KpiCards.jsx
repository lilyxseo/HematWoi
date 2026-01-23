import KpiCard from "./KpiCard";
import { formatMoney } from "../lib/format";

export default function KpiCards({
  income = 0,
  expense = 0,
  net = 0,
  loading = false,
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-8">
      <KpiCard
        label="Pemasukan"
        value={<span className="hw-money">{formatMoney(income, "IDR")}</span>}
        variant="success"
        loading={loading}
      />
      <KpiCard
        label="Pengeluaran"
        value={<span className="hw-money">{formatMoney(expense, "IDR")}</span>}
        variant="danger"
        loading={loading}
      />
      <KpiCard
        label={net < 0 ? "Defisit" : "Saldo"}
        value={<span className="hw-money">{formatMoney(net, "IDR")}</span>}
        variant={net < 0 ? "danger" : "brand"}
        loading={loading}
      />
    </div>
  );
}
