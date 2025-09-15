import { describe, it, expect } from 'vitest';
import { dummySeed } from './dummySeed';

describe('dummySeed', () => {
  it('generates sample data', () => {
    const data = dummySeed();
    expect(data.categories.length).toBeGreaterThan(0);
    expect(data.budgets.length).toBeGreaterThan(0);
    expect(data.goals.length).toBeGreaterThan(0);
    expect(data.transactions.length).toBeGreaterThanOrEqual(30);
  });
});
