import { describe, expect, it } from 'vitest';

import { aggregateAccountBalances } from './balances';

describe('aggregateAccountBalances', () => {
  it('sums balances per account with incomes, expenses, and transfers', () => {
    const accounts = [
      { id: 'a1', type: 'cash' },
      { id: 'a2', type: 'bank' },
      { id: 'a3', type: 'ewallet' },
    ];

    const transactions = [
      { account_id: 'a1', to_account_id: null, type: 'income', amount: 500_000 },
      { account_id: 'a1', to_account_id: null, type: 'expense', amount: 200_000 },
      { account_id: 'a2', to_account_id: 'a3', type: 'transfer', amount: 150_000 },
      { account_id: 'a3', to_account_id: null, type: 'income', amount: 50_000 },
      { account_id: 'a2', to_account_id: null, type: 'expense', amount: 20_000 },
    ];

    const result = aggregateAccountBalances(accounts, transactions);

    expect(result.perAccount).toEqual({
      a1: 300_000,
      a2: -170_000,
      a3: 200_000,
    });
    expect(result.cashTotal).toBe(300_000);
    expect(result.allTotal).toBe(330_000);
    expect(result.nonCashTotal).toBe(30_000);
  });

  it('ignores unknown accounts and empty datasets', () => {
    const accounts = [{ id: 'cash-1', type: 'cash' }];
    const transactions = [
      { account_id: 'unknown', to_account_id: 'cash-1', type: 'transfer', amount: 80_000 },
      { account_id: 'cash-1', to_account_id: null, type: 'income', amount: '100000' },
      { account_id: null, to_account_id: 'cash-1', type: 'income', amount: 20_000 },
      { account_id: 'cash-1', to_account_id: null, type: 'unknown', amount: 5_000 },
    ];

    const result = aggregateAccountBalances(accounts, transactions);

    expect(result.perAccount).toEqual({ 'cash-1': 180_000 });
    expect(result.cashTotal).toBe(180_000);
    expect(result.allTotal).toBe(180_000);
    expect(result.nonCashTotal).toBe(0);

    const emptyResult = aggregateAccountBalances([], []);
    expect(emptyResult.perAccount).toEqual({});
    expect(emptyResult.cashTotal).toBe(0);
    expect(emptyResult.allTotal).toBe(0);
    expect(emptyResult.nonCashTotal).toBe(0);
  });
});
