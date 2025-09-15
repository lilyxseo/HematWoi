function toRupiah(n = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

export default function WalletPanel({ insights, showTips = true, onClose }) {
  if (!insights) return null;
  const { balance, weeklyTrend, topSpenderCategory, tip } = insights;
  return (
    <div
      className="absolute z-10 mt-2 right-0 w-64 rounded-lg bg-white shadow p-4 text-sm text-text"
      role="dialog"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Tutup"
        className="absolute top-1 right-1 text-xs text-brand hover:text-brand-hover"
      >
        ✕
      </button>
      <ul className="space-y-1 mb-2">
        <li>Saldo bersih: {toRupiah(balance)}</li>
        <li>
          Tren 7D: {weeklyTrend > 0 ? "+" : ""}
          {weeklyTrend}%
        </li>
        <li>Kategori boros: {topSpenderCategory || "-"}</li>
      </ul>
      {showTips && tip && <div className="text-xs">{tip}</div>}
    </div>
  );
}

