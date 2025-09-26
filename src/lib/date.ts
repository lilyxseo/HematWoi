export function firstDayOfThisMonthISO(): string {
  const today = new Date();
  const firstDay = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));

  return firstDay.toISOString().split('T')[0] ?? '';
}
