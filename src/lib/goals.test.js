import { describe, it, expect } from 'vitest';
import { goalProgress, estimateGoalETA } from './goals';
import { validateGoal } from './goals';

describe('goalProgress', () => {
  it('returns progress ratio', () => {
    const g = { saved: 50, target: 200 };
    expect(goalProgress(g)).toBe(0.25);
  });
});

describe('estimateGoalETA', () => {
  it('estimates completion date', () => {
    const g = { saved: 100, target: 400 };
    const eta = estimateGoalETA(g, 30); // 300 remaining -> 10 days
    const now = new Date();
    const expected = new Date(now);
    expected.setDate(now.getDate() + 10);
    expect(eta.toDateString()).toBe(expected.toDateString());
  });
});

describe('validateGoal', () => {
  it('validates positive numbers', () => {
    expect(validateGoal({ title: 'A', target: 100, saved: 0 })).toBe(true);
    expect(validateGoal({ title: 'A', target: 0, saved: 0 })).toBe(false);
  });
});
