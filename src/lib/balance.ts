export type AccountType = 'cash' | 'bank' | 'ewallet' | 'other' | (string & {});

export interface BalanceAccount {
  id: string;
  type: AccountType | null | undefined;
}

export interface BalanceTransaction {
  account_id: string | null;
  to_account_id: string | null;
  type: string | null;
  amount: number | string | null;
  deleted_at?: string | null;
}

export interface BalanceSummary {
  perAccount: Record<string, number>;
  cashTotal: number;
  nonCashTotal: number;
  allTotal: number;
}

const EMPTY_SUMMARY: BalanceSummary = {
  perAccount: {},
  cashTotal: 0,
  nonCashTotal: 0,
  allTotal: 0,
};

const normalizeAmount = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : value;
  return Number.isFinite(parsed) ? parsed : 0;
};

const isCashAccount = (type: AccountType | null | undefined): boolean =>
  (type ?? '').toLowerCase() === 'cash';

export function aggregateAccountBalances(
  accounts: BalanceAccount[] | null | undefined,
  transactions: BalanceTransaction[] | null | undefined
): BalanceSummary {
  if (!accounts?.length) {
    return { ...EMPTY_SUMMARY };
  }

  const balances = new Map<string, number>();

  for (const account of accounts) {
    if (!account?.id) continue;
    balances.set(account.id, 0);
  }

  if (!balances.size) {
    return { ...EMPTY_SUMMARY };
  }

  for (const tx of transactions ?? []) {
    if (!tx || tx.deleted_at) continue;

    const amount = normalizeAmount(tx.amount);
    if (!amount) continue;

    const txType = (tx.type ?? '').toLowerCase();

    if (txType === 'income') {
      if (tx.account_id && balances.has(tx.account_id)) {
        balances.set(tx.account_id, balances.get(tx.account_id)! + amount);
      }
      continue;
    }

    if (txType === 'expense') {
      if (tx.account_id && balances.has(tx.account_id)) {
        balances.set(tx.account_id, balances.get(tx.account_id)! - amount);
      }
      continue;
    }

    if (txType === 'transfer') {
      if (tx.account_id && balances.has(tx.account_id)) {
        balances.set(tx.account_id, balances.get(tx.account_id)! - amount);
      }
      if (tx.to_account_id && balances.has(tx.to_account_id)) {
        balances.set(tx.to_account_id, balances.get(tx.to_account_id)! + amount);
      }
      continue;
    }

    // Fallback for any other type - treat as income on account_id
    if (tx.account_id && balances.has(tx.account_id)) {
      balances.set(tx.account_id, balances.get(tx.account_id)! + amount);
    }
  }

  const perAccount: Record<string, number> = {};
  let cashTotal = 0;
  let allTotal = 0;

  for (const account of accounts) {
    if (!account?.id) continue;
    const balance = balances.get(account.id) ?? 0;
    perAccount[account.id] = balance;
    allTotal += balance;
    if (isCashAccount(account.type)) {
      cashTotal += balance;
    }
  }

  return {
    perAccount,
    cashTotal,
    nonCashTotal: allTotal - cashTotal,
    allTotal,
  };
}
