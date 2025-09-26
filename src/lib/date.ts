export function firstDayOfThisMonthISO(): string {
  const now = new Date()
  const utcDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  return utcDate.toISOString().split('T')[0]
}
