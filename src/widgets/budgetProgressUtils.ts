export function normalizeNumeric(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0
  const numericValue = typeof value === 'string' ? Number.parseFloat(value) : value
  return Number.isFinite(numericValue) ? numericValue : 0
}

export function calculateBudgetUsage(effectiveBudget: number, totalSpent: number) {
  const safeBudget = Number.isFinite(effectiveBudget) ? effectiveBudget : 0
  const safeSpent = Number.isFinite(totalSpent) ? totalSpent : 0
  const remaining = Math.max(safeBudget - safeSpent, 0)

  if (safeBudget <= 0) {
    return {
      usedPct: 0,
      remaining,
    }
  }

  const rawPct = (safeSpent / safeBudget) * 100
  const usedPct = Math.min(Math.max(rawPct, 0), 100)

  return {
    usedPct,
    remaining,
  }
}
