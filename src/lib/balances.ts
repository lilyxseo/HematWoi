export type AccountType = 'cash' | 'bank' | 'ewallet' | 'other';

export interface AccountRow {
  id: string;
  type: AccountType;
}

export type TransactionType = 'income' | 'expense' | 'transfer';

export interface TransactionRow {
  account_id: string | null;
  to_account_id: string | null;
  type: TransactionType;
  amount: number | string | null;
  deleted_at?: string | null;
}

export interface AggregateResult {
  perAccount: Record<string, number>;
  cashTotal: number;
  nonCashTotal: number;
  allTotal: number;
}

export const fmtIDR = (n: number): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  })
    .format(n || 0)
    .replace(/ /g, '');

const NORMALIZED_ZERO = 0;

const toNumber = (value: number | string | null | undefined): number => {
  if (value == null) return NORMALIZED_ZERO;
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : NORMALIZED_ZERO;
};

export function aggregateAccountBalances(
  accounts: AccountRow[] = [],
  transactions: TransactionRow[] = []
): AggregateResult {
  const perAccount = new Map<string, { balance: number; type: AccountType }>();

  for (const account of accounts) {
    if (!account?.id) continue;
    perAccount.set(account.id, { balance: 0, type: account.type });
  }

  for (const tx of transactions) {
    if (!tx || tx.deleted_at) continue;

    const amount = toNumber(tx.amount);
    if (!amount) {
      continue;
    }

    const sourceId = tx.account_id ?? null;
    const targetId = tx.to_account_id ?? null;

    if (tx.type === 'income' && sourceId && perAccount.has(sourceId)) {
      perAccount.get(sourceId)!.balance += amount;
    } else if (tx.type === 'expense' && sourceId && perAccount.has(sourceId)) {
      perAccount.get(sourceId)!.balance -= amount;
    } else if (tx.type === 'transfer') {
      if (sourceId && perAccount.has(sourceId)) {
        perAccount.get(sourceId)!.balance -= amount;
      }
      if (targetId && perAccount.has(targetId)) {
        perAccount.get(targetId)!.balance += amount;
      }
    }
  }

  let cashTotal = 0;
  let allTotal = 0;

  for (const { balance, type } of perAccount.values()) {
    allTotal += balance;
    if (type === 'cash') {
      cashTotal += balance;
    }
  }

  const perAccountRecord: Record<string, number> = {};
  for (const [id, { balance }] of perAccount) {
    perAccountRecord[id] = balance;
  }

  const nonCashTotal = allTotal - cashTotal;

  return {
    perAccount: perAccountRecord,
    cashTotal,
    nonCashTotal,
    allTotal,
  };
}
