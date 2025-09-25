export type AccountType = 'cash' | 'bank' | 'ewallet' | 'other' | string;

export interface AccountSummary {
  id: string;
  type: AccountType;
}

export type TransactionType = 'income' | 'expense' | 'transfer' | string;

export interface TransactionSummary {
  account_id: string | null;
  to_account_id: string | null;
  type: TransactionType;
  amount: number | string | null;
}

export interface BalanceAggregation {
  perAccount: Record<string, number>;
  cashTotal: number;
  nonCashTotal: number;
  allTotal: number;
}

const ZERO_TOTALS = {
  perAccount: {},
  cashTotal: 0,
  nonCashTotal: 0,
  allTotal: 0,
} satisfies BalanceAggregation;

function normalizeAmount(value: number | string | null | undefined): number {
  const amount = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(amount) || amount == null) return 0;
  return amount;
}

/**
 * Aggregates balances per account based on income, expense, and transfer transactions.
 *
 * Transfers are treated as a debit on the source account (account_id) and a credit on
 * the destination account (to_account_id) to avoid double counting.
 */
export function aggregateAccountBalances(
  accounts: AccountSummary[] = [],
  transactions: TransactionSummary[] = []
): BalanceAggregation {
  if (!accounts.length) return ZERO_TOTALS;

  const balances = new Map<string, number>();

  for (const account of accounts) {
    if (account?.id) {
      balances.set(account.id, 0);
    }
  }

  for (const tx of transactions) {
    if (!tx) continue;

    const amount = normalizeAmount(tx.amount);
    if (amount === 0) continue;

    const accountId = tx.account_id ?? undefined;
    const destinationId = tx.to_account_id ?? undefined;

    switch (tx.type) {
      case 'income': {
        if (accountId && balances.has(accountId)) {
          balances.set(accountId, balances.get(accountId)! + amount);
        }
        break;
      }
      case 'expense': {
        if (accountId && balances.has(accountId)) {
          balances.set(accountId, balances.get(accountId)! - amount);
        }
        break;
      }
      case 'transfer': {
        if (destinationId && balances.has(destinationId)) {
          balances.set(destinationId, balances.get(destinationId)! + amount);
        }
        if (accountId && destinationId && balances.has(accountId)) {
          balances.set(accountId, balances.get(accountId)! - amount);
        }
        break;
      }
      default:
        break;
    }
  }

  let cashTotal = 0;
  let allTotal = 0;

  for (const account of accounts) {
    const balance = balances.get(account.id) ?? 0;
    if (account.type === 'cash') {
      cashTotal += balance;
    }
    allTotal += balance;
  }

  const nonCashTotal = allTotal - cashTotal;

  return {
    perAccount: Object.fromEntries(balances.entries()),
    cashTotal,
    nonCashTotal,
    allTotal,
  };
}
