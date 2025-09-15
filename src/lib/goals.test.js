import { describe, it, expect } from 'vitest';
import { goalProgress, estimateGoalETA } from './goals';

describe('goalProgress', () => {
  it('returns progress ratio', () => {
    const g = { allocated: 50, target: 200 };
    expect(goalProgress(g)).toBe(0.25);
  });
});

describe('estimateGoalETA', () => {
  it('estimates completion date', () => {
    const g = { allocated: 100, target: 400 };
    const eta = estimateGoalETA(g, 30); // 300 remaining -> 10 days
    const now = new Date();
    const expected = new Date(now);
    expected.setDate(now.getDate() + 10);
    expect(eta.toDateString()).toBe(expected.toDateString());
  });
});
