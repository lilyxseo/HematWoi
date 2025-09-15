import { useState, useMemo } from "react";

export function shouldActivateLateMonthMode({ date = new Date(), balance = 0, avgMonthlyExpense = 0 } = {}, prefs = {}) {
  const {
    lateMode = "auto",
    lateModeDay = 24,
    lateModeBalance = 0.4,
  } = prefs;
  const isLate = date.getDate() >= lateModeDay;
  const isLow = avgMonthlyExpense > 0 ? balance < lateModeBalance * avgMonthlyExpense : false;
  if (lateMode === "on") return true;
  if (lateMode === "off") return false;
  return isLate && isLow;
}

export default function useLateMonthMode(values = {}, prefs = {}) {
  const [dismissed, setDismissed] = useState(false);
  const active = useMemo(
    () => !dismissed && shouldActivateLateMonthMode(values, prefs),
    [dismissed, values, prefs]
  );
  const dismiss = () => setDismissed(true);
  return { active, dismiss };
}
