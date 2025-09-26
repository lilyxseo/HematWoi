import { describe, expect, it } from 'vitest'
import { calculateBudgetUsage } from '../budgetProgressUtils'

describe('calculateBudgetUsage', () => {
  it('returns 0 percent when budget is zero', () => {
    const result = calculateBudgetUsage(0, 500_000)
    expect(result.usedPct).toBe(0)
    expect(result.remaining).toBe(0)
  })

  it('calculates usage percentage within range', () => {
    const result = calculateBudgetUsage(1_000_000, 250_000)
    expect(result.usedPct).toBeCloseTo(25)
    expect(result.remaining).toBe(750_000)
  })

  it('clamps percentage between 0 and 100', () => {
    expect(calculateBudgetUsage(1_000_000, -200_000).usedPct).toBe(0)
    expect(calculateBudgetUsage(1_000_000, 2_000_000).usedPct).toBe(100)
  })
})
