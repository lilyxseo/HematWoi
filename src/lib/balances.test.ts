import { describe, expect, it } from 'vitest';
import { aggregateAccountBalances, fmtIDR } from './balances';

describe('aggregateAccountBalances', () => {
  const accounts = [
    { id: 'cash-1', type: 'cash' as const },
    { id: 'bank-1', type: 'bank' as const },
  ];

  it('calculates income and expense balances correctly', () => {
    const { perAccount, cashTotal, nonCashTotal, allTotal } = aggregateAccountBalances(accounts, [
      { account_id: 'cash-1', to_account_id: null, type: 'income', amount: 100_000 },
      { account_id: 'cash-1', to_account_id: null, type: 'expense', amount: 25_000 },
      { account_id: 'bank-1', to_account_id: null, type: 'income', amount: '50000' },
    ]);

    expect(perAccount['cash-1']).toBe(75_000);
    expect(perAccount['bank-1']).toBe(50_000);
    expect(cashTotal).toBe(75_000);
    expect(nonCashTotal).toBe(50_000);
    expect(allTotal).toBe(125_000);
  });

  it('ignores deleted transactions', () => {
    const { allTotal } = aggregateAccountBalances(accounts, [
      { account_id: 'cash-1', to_account_id: null, type: 'income', amount: 100_000, deleted_at: '2024-01-01' },
    ]);

    expect(allTotal).toBe(0);
  });

  it('handles transfers between accounts without duplication', () => {
    const { perAccount, cashTotal, nonCashTotal, allTotal } = aggregateAccountBalances(accounts, [
      { account_id: 'cash-1', to_account_id: null, type: 'income', amount: 200_000 },
      { account_id: 'cash-1', to_account_id: 'bank-1', type: 'transfer', amount: 50_000 },
    ]);

    expect(perAccount['cash-1']).toBe(150_000);
    expect(perAccount['bank-1']).toBe(50_000);
    expect(cashTotal).toBe(150_000);
    expect(nonCashTotal).toBe(50_000);
    expect(allTotal).toBe(200_000);
  });
});

describe('fmtIDR', () => {
  it('formats numbers as Indonesian Rupiah', () => {
    expect(fmtIDR(123456)).toBe('Rp123.456');
    expect(fmtIDR(0)).toBe('Rp0');
  });
});
