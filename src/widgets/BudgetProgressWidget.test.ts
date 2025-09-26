import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import { aggregateBudgetProgress } from './BudgetProgressWidget'

describe('aggregateBudgetProgress', () => {
  it('calculates totals and percentage correctly', () => {
    const summary = aggregateBudgetProgress([
      { planned: 1000000, rollover_in: 200000, current_spent: 300000 },
      { planned: 500000, rollover_in: 0, current_spent: 400000 },
    ])

    expect(summary.effectiveBudget).toBe(1700000)
    expect(summary.totalSpent).toBe(700000)
    expect(summary.remaining).toBe(1000000)
    expect(summary.usedPct).toBeCloseTo(41.176, 3)
    expect(summary.hasBudget).toBe(true)
  })

  it('handles nulls and zero budget safely', () => {
    const summary = aggregateBudgetProgress([
      { planned: null, rollover_in: null, current_spent: null },
    ])

    expect(summary.effectiveBudget).toBe(0)
    expect(summary.totalSpent).toBe(0)
    expect(summary.remaining).toBe(0)
    expect(summary.usedPct).toBe(0)
    expect(summary.hasBudget).toBe(false)
  })
})
