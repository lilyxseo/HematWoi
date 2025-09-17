import KpiCard from "./KpiCard";

function toRupiah(n = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

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
        value={toRupiah(income)}
        variant="success"
        loading={loading}
      />
      <KpiCard
        label="Pengeluaran"
        value={toRupiah(expense)}
        variant="danger"
        loading={loading}
      />
      <KpiCard
        label={net < 0 ? "Defisit" : "Saldo"}
        value={toRupiah(net)}
        variant={net < 0 ? "danger" : "brand"}
        loading={loading}
      />
    </div>
  );
}

