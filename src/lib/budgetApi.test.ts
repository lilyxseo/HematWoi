import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.VITE_SUPABASE_URL = 'http://localhost';
  process.env.VITE_SUPABASE_ANON_KEY = 'test-key';
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'test-key';
});

const { getWeeklyTransactionEndExclusive } = await import('./budgetApi');

describe('getWeeklyTransactionEndExclusive', () => {
  it('extends to the end of the final week when the month ends mid-week', () => {
    expect(getWeeklyTransactionEndExclusive('2024-05')).toBe('2024-06-03');
  });

  it('matches the next month start when the month ends on a Sunday', () => {
    expect(getWeeklyTransactionEndExclusive('2024-03')).toBe('2024-04-01');
  });
});

