const idr = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" });

function SmallStat({ label, value, note, pos = false, bold = false }) {
  return (
    <div className="p-3 rounded-lg border bg-slate-50">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-base ${bold ? "font-bold" : "font-semibold"}`}>{value}</div>
      <div className={`text-[11px] ${pos ? "text-emerald-600" : "text-slate-500"}`}>{note}</div>
    </div>
  );
}

export default function Summary({ stats }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <SmallStat label="Pemasukan" value={idr.format(stats.income)} note="Total" pos />
      <SmallStat label="Pengeluaran" value={idr.format(stats.expense)} note="Total" />
      <SmallStat label="Saldo" value={idr.format(stats.balance)} note="(In - Out)" bold />
    </div>
  );
}
