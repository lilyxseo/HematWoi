import { useMemo } from "react";

const mockTxs = [
  {
    date: new Date().toISOString().slice(0, 10),
    type: "income",
    amount: 500000,
    category: "Gaji",
  },
  {
    date: new Date().toISOString().slice(0, 10),
    type: "expense",
    amount: 100000,
    category: "Makan",
  },
];

export default function useFinanceSummary(txs = [], budgets = []) {
  return useMemo(() => {
    const list = Array.isArray(txs) && txs.length ? txs : mockTxs;
    const today = new Date();
    const monthStr = today.toISOString().slice(0, 7);

    const monthTx = list.filter((t) => {
      if (!t?.date) return false;
      const d = new Date(t.date);
      return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
    });

    const income = monthTx
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const expense = monthTx
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const balance = income - expense;

    const day = today.getDate();
    const avgMonthlyExpense = day ? (expense / day) * 30 : 0;

    const getExpenseBetween = (start, end) =>
      list
        .filter((t) => {
          if (t.type !== "expense" || !t?.date) return false;
          const d = new Date(t.date);
          return d > start && d <= end;
        })
        .reduce((s, t) => s + Number(t.amount || 0), 0);

    const end = today;
    const start1 = new Date();
    start1.setDate(end.getDate() - 7);
    const start0 = new Date();
    start0.setDate(end.getDate() - 14);
    const last7 = getExpenseBetween(start1, end);
    const prev7 = getExpenseBetween(start0, start1);
    const weeklyTrend = prev7 ? Math.round(((last7 - prev7) / prev7) * 100) : 0;

    const categoryTotals = monthTx
      .filter((t) => t.type === "expense")
      .reduce((acc, t) => {
        const key = t.category || "";
        acc[key] = (acc[key] || 0) + Number(t.amount || 0);
        return acc;
      }, {});
    const topSpenderCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

    const isAnyOverBudget = budgets.some((b) => {
      if (b.month !== monthStr) return false;
      const spent = monthTx
        .filter((t) => t.type === "expense" && t.category === b.category)
        .reduce((s, t) => s + Number(t.amount || 0), 0);
      return spent > Number(b.amount || 0);
    });

    return {
      balance,
      avgMonthlyExpense,
      weeklyTrend,
      topSpenderCategory,
      isAnyOverBudget,
    };
  }, [txs, budgets]);
}

