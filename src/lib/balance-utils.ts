export type AccountType = 'cash' | 'bank' | 'ewallet' | 'other' | string;

export interface AccountRow {
  id: string;
  type: AccountType | null;
}

export interface TransactionRow {
  account_id: string | null;
  to_account_id: string | null;
  type: string | null;
  amount: number | null;
}

export interface AccountBalancesResult {
  accountBalances: Record<string, number>;
  cashTotal: number;
  nonCashTotal: number;
  allTotal: number;
}

function normalizeAmount(value: number | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function applyDelta(balances: Record<string, number>, accountId: string | null | undefined, delta: number) {
  if (!accountId) return;
  if (!Object.prototype.hasOwnProperty.call(balances, accountId)) {
    balances[accountId] = 0;
  }
  balances[accountId] += delta;
}

export function calculateAccountBalances(
  accounts: readonly AccountRow[] = [],
  transactions: readonly TransactionRow[] = [],
): AccountBalancesResult {
  const balances: Record<string, number> = {};

  for (const account of accounts) {
    if (!account?.id) continue;
    if (!Object.prototype.hasOwnProperty.call(balances, account.id)) {
      balances[account.id] = 0;
    }
  }

  for (const tx of transactions) {
    if (!tx) continue;
    const type = (tx.type ?? '').toLowerCase();
    const amount = normalizeAmount(tx.amount);

    switch (type) {
      case 'income': {
        applyDelta(balances, tx.account_id, amount);
        break;
      }
      case 'expense': {
        applyDelta(balances, tx.account_id, -amount);
        break;
      }
      case 'transfer': {
        if (tx.account_id && tx.to_account_id && tx.account_id === tx.to_account_id) {
          break;
        }
        applyDelta(balances, tx.account_id, -amount);
        applyDelta(balances, tx.to_account_id, amount);
        break;
      }
      default: {
        if (tx.account_id) {
          applyDelta(balances, tx.account_id, amount);
        }
      }
    }
  }

  let cashTotal = 0;
  let allTotal = 0;

  for (const account of accounts) {
    if (!account?.id) continue;
    const balance = balances[account.id] ?? 0;
    allTotal += balance;
    if ((account.type ?? '').toLowerCase() === 'cash') {
      cashTotal += balance;
    }
  }

  const nonCashTotal = allTotal - cashTotal;

  return {
    accountBalances: balances,
    cashTotal,
    nonCashTotal,
    allTotal,
  };
}
