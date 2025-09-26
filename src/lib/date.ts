export function firstDayOfThisMonthISO(): string {
  const now = new Date()
  const utcFirstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  return utcFirstDay.toISOString().split('T')[0]
}
