import { useMemo } from "react";

export function getWalletStatus(
  { balance = 0, avgMonthlyExpense = 0, weeklyTrend = 0 },
  sensitivity = "default"
) {
  const factor =
    sensitivity === "low" ? 0.8 : sensitivity === "high" ? 1.2 : 1;
  const ratio = avgMonthlyExpense > 0 ? balance / avgMonthlyExpense : 0;
  let status = "FLAT";
  if (ratio >= 1.5 * factor) status = "FAT";
  else if (ratio >= 0.8 * factor) status = "NORMAL";
  else if (ratio >= 0.4 * factor) status = "THIN";

  const expressions = {
    FAT: "😄",
    NORMAL: "🙂",
    THIN: "😟",
    FLAT: "😢",
  };

  let tip = "";
  if (status === "FAT") tip = "Saldo sehat";
  else if (status === "NORMAL")
    tip = weeklyTrend > 0 ? `Hati-hati, pengeluaran naik ${weeklyTrend}%` : "Saldo cukup";
  else if (status === "THIN")
    tip = weeklyTrend > 0
      ? `Pengeluaran naik ${weeklyTrend}% minggu ini`
      : "Jaga pengeluaran ya";
  else tip = "Dompet kempes, kurangi pengeluaran!";

  return { status, expression: expressions[status], tip };
}

export default function useWalletStatus(values = {}, opts = {}) {
  return useMemo(
    () => getWalletStatus(values, opts.sensitivity || "default"),
    [values, opts.sensitivity]
  );
}

