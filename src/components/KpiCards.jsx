function toRupiah(n = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

export default function KpiCards({ income = 0, expense = 0, net = 0, avgDaily = 0 }) {
  return (
    <div className="card">
      <div className="grid gap-4 text-center sm:grid-cols-4">
        <div className="space-y-1">
          <div className="text-sm">Pemasukan</div>
          <div className="text-lg font-semibold text-green-600">{toRupiah(income)}</div>
        </div>
        <div className="space-y-1">
          <div className="text-sm">Pengeluaran</div>
          <div className="text-lg font-semibold text-red-600">{toRupiah(expense)}</div>
        </div>
        <div className="space-y-1">
          <div className="text-sm">Saldo</div>
          <div className="text-lg font-semibold text-blue-600">{toRupiah(net)}</div>
        </div>
        <div className="space-y-1">
          <div className="text-sm">Rata-rata/Hari</div>
          <div className="text-lg font-semibold">{toRupiah(avgDaily)}</div>
        </div>
      </div>
    </div>
  );
}

