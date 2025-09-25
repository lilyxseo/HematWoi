import { describe, expect, it } from 'vitest';
import { calculateAccountBalances, type AccountRow, type TransactionRow } from './balance-utils';

describe('calculateAccountBalances', () => {
  const accounts: AccountRow[] = [
    { id: 'cash-1', type: 'cash' },
    { id: 'bank-1', type: 'bank' },
    { id: 'ewallet-1', type: 'ewallet' },
  ];

  it('computes balances for income and expense transactions', () => {
    const transactions: TransactionRow[] = [
      { account_id: 'cash-1', to_account_id: null, type: 'income', amount: 100_000 },
      { account_id: 'cash-1', to_account_id: null, type: 'expense', amount: 25_000 },
      { account_id: 'bank-1', to_account_id: null, type: 'income', amount: 50_000 },
    ];

    const result = calculateAccountBalances(accounts, transactions);

    expect(result.accountBalances).toMatchObject({
      'cash-1': 75_000,
      'bank-1': 50_000,
      'ewallet-1': 0,
    });
    expect(result.cashTotal).toBe(75_000);
    expect(result.allTotal).toBe(125_000);
    expect(result.nonCashTotal).toBe(50_000);
  });

  it('keeps transfers net neutral across accounts', () => {
    const transactions: TransactionRow[] = [
      { account_id: 'cash-1', to_account_id: 'bank-1', type: 'transfer', amount: 40_000 },
      { account_id: 'bank-1', to_account_id: 'ewallet-1', type: 'transfer', amount: 10_000 },
    ];

    const result = calculateAccountBalances(accounts, transactions);

    expect(result.accountBalances).toMatchObject({
      'cash-1': -40_000,
      'bank-1': 30_000,
      'ewallet-1': 10_000,
    });
    expect(result.cashTotal).toBe(-40_000);
    expect(result.allTotal).toBe(0);
    expect(result.nonCashTotal).toBe(40_000);
  });

  it('ignores invalid transaction types gracefully', () => {
    const transactions: TransactionRow[] = [
      { account_id: 'cash-1', to_account_id: null, type: 'bonus', amount: 12_500 },
      { account_id: 'missing', to_account_id: null, type: 'income', amount: 5_000 },
    ];

    const result = calculateAccountBalances(accounts, transactions);

    expect(result.accountBalances['cash-1']).toBe(12_500);
    expect(result.accountBalances['missing']).toBe(5_000);
    expect(result.allTotal).toBe(12_500);
    expect(result.cashTotal).toBe(12_500);
  });
});
