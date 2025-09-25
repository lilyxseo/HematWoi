import { describe, expect, it } from 'vitest';
import { aggregateAccountBalances } from './balance';

describe('aggregateAccountBalances', () => {
  it('returns zero balances when there are no accounts', () => {
    const summary = aggregateAccountBalances([], []);
    expect(summary).toEqual({
      perAccount: {},
      cashTotal: 0,
      nonCashTotal: 0,
      allTotal: 0,
    });
  });

  it('calculates balances across income, expense, and transfers', () => {
    const accounts = [
      { id: 'cash-1', type: 'cash' },
      { id: 'bank-1', type: 'bank' },
      { id: 'wallet-1', type: 'ewallet' },
    ];

    const transactions = [
      { account_id: 'cash-1', to_account_id: null, type: 'income', amount: 200_000 },
      { account_id: 'cash-1', to_account_id: null, type: 'expense', amount: 25_000 },
      { account_id: 'cash-1', to_account_id: 'bank-1', type: 'transfer', amount: 50_000 },
      { account_id: 'bank-1', to_account_id: 'wallet-1', type: 'transfer', amount: '30000' },
      { account_id: 'wallet-1', to_account_id: 'cash-1', type: 'transfer', amount: 10_000 },
      { account_id: 'cash-1', to_account_id: null, type: 'income', amount: '15500' },
      { account_id: 'wallet-1', to_account_id: null, type: 'expense', amount: 5_500, deleted_at: '2024-01-01' },
    ];

    const summary = aggregateAccountBalances(accounts, transactions);

    expect(summary.perAccount).toEqual({
      'cash-1': 150_500,
      'bank-1': 20_000,
      'wallet-1': 20_000,
    });
    expect(summary.cashTotal).toBe(150_500);
    expect(summary.nonCashTotal).toBe(40_000);
    expect(summary.allTotal).toBe(190_500);
  });

  it('ignores transactions that reference unknown accounts', () => {
    const accounts = [{ id: 'cash-1', type: 'cash' }];

    const transactions = [
      { account_id: 'cash-1', to_account_id: null, type: 'income', amount: 100_000 },
      { account_id: 'missing', to_account_id: 'missing', type: 'transfer', amount: 20_000 },
    ];

    const summary = aggregateAccountBalances(accounts, transactions);

    expect(summary.perAccount['cash-1']).toBe(100_000);
    expect(summary.cashTotal).toBe(100_000);
    expect(summary.nonCashTotal).toBe(0);
    expect(summary.allTotal).toBe(100_000);
  });
});
