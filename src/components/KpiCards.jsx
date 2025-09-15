import KpiCard from "./KpiCard";

function toRupiah(n = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

export default function KpiCards({ income = 0, expense = 0, net = 0 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <KpiCard label="Pemasukan" value={toRupiah(income)} variant="success" />
      <KpiCard label="Pengeluaran" value={toRupiah(expense)} variant="danger" />
      <KpiCard label="Saldo" value={toRupiah(net)} variant="brand" />
    </div>
  );
}

