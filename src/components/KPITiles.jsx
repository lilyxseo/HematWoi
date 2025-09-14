import { ArrowUpRight, ArrowDownRight } from "lucide-react";

function toRupiah(n = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

function toPercent(n = 0) {
  return (n || 0).toLocaleString("id-ID", {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export default function KPITiles({ income = 0, expense = 0, prevIncome = 0, prevExpense = 0 }) {
  const balance = income - expense;
  const prevBalance = prevIncome - prevExpense;
  const savings = income > 0 ? balance / income : 0;
  const prevSavings = prevIncome > 0 ? prevBalance / prevIncome : 0;

  const incomeDelta = prevIncome ? (income - prevIncome) / prevIncome : null;
  const expenseDelta = prevExpense ? (expense - prevExpense) / prevExpense : null;
  const balanceDelta = prevBalance ? (balance - prevBalance) / prevBalance : null;
  const savingsDelta = prevSavings ? (savings - prevSavings) / prevSavings : null;

  const renderDelta = (delta) => {
    if (delta == null || !isFinite(delta)) return "—";
    const Arrow = delta >= 0 ? ArrowUpRight : ArrowDownRight;
    const color = delta >= 0 ? "text-green-600" : "text-red-600";
    return (
      <span className={`flex items-center justify-center gap-1 ${color}`}>
        <Arrow className="h-3 w-3" />
        {Math.abs(delta).toLocaleString("id-ID", {
          style: "percent",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })}
      </span>
    );
  };

  return (
    <div className="card">
      <div className="grid gap-4 text-center sm:grid-cols-4">
        <div>
          <div className="text-sm">Pemasukan</div>
          <div className="text-lg font-semibold text-green-600">{toRupiah(income)}</div>
          <div className="text-xs">{renderDelta(incomeDelta)}</div>
        </div>
        <div>
          <div className="text-sm">Pengeluaran</div>
          <div className="text-lg font-semibold text-red-600">{toRupiah(expense)}</div>
          <div className="text-xs">{renderDelta(expenseDelta)}</div>
        </div>
        <div>
          <div className="text-sm">Saldo</div>
          <div className="text-lg font-semibold text-blue-600">{toRupiah(balance)}</div>
          <div className="text-xs">{renderDelta(balanceDelta)}</div>
        </div>
        <div>
          <div className="text-sm">Savings Rate</div>
          <div className="text-lg font-semibold">{toPercent(savings)}</div>
          <div className="text-xs">{renderDelta(savingsDelta)}</div>
        </div>
      </div>
    </div>
  );
}
