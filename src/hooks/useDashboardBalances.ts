import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { toQueryDate } from "../lib/date-range";

type AccountRow = {
  id: string;
  type: "cash" | "bank" | "ewallet" | "other" | null;
};

type TransactionRow = {
  account_id: string | null;
  to_account_id: string | null;
  type: "income" | "expense" | null;
  amount: number | null;
  date: string | null;
};

export interface UseDashboardBalancesParams {
  start: Date;
  end: Date;
}

export interface DashboardBalancesResult {
  income: number;
  expense: number;
  cashBalance: number;
  nonCashBalance: number;
  totalBalance: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const toNumber = (value: number | null) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const increment = (map: Map<string, number>, key: string | null, amount: number) => {
  if (!key) return;
  const next = (map.get(key) ?? 0) + amount;
  map.set(key, next);
};

const TRANSACTION_COLUMNS =
  "account_id, to_account_id, type, amount, date" as const;

export default function useDashboardBalances({
  start,
  end,
}: UseDashboardBalancesParams): DashboardBalancesResult {
  const [income, setIncome] = useState(0);
  const [expense, setExpense] = useState(0);
  const [cashBalance, setCashBalance] = useState(0);
  const [nonCashBalance, setNonCashBalance] = useState(0);
  const [totalBalance, setTotalBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const startKey = start.getTime();
  const endKey = end.getTime();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [{ data: userData, error: userError }] = await Promise.all([
        supabase.auth.getUser(),
      ]);

      if (userError) {
        throw userError;
      }

      const user = userData?.user;
      if (!user) {
        throw new Error("Pengguna tidak ditemukan");
      }

      const uid = user.id;

      const [accountsRes, txRangeRes, txAllRes] = await Promise.all([
        supabase
          .from("accounts")
          .select("id, type")
          .eq("user_id", uid),
        supabase
          .from("transactions")
          .select(TRANSACTION_COLUMNS)
          .eq("user_id", uid)
          .is("deleted_at", null)
          .gte("date", toQueryDate(start))
          .lte("date", toQueryDate(end)),
        supabase
          .from("transactions")
          .select(TRANSACTION_COLUMNS)
          .eq("user_id", uid)
          .is("deleted_at", null),
      ]);

      if (accountsRes.error) {
        throw accountsRes.error;
      }
      if (txRangeRes.error) {
        throw txRangeRes.error;
      }
      if (txAllRes.error) {
        throw txAllRes.error;
      }

      const accounts = (accountsRes.data ?? []) as AccountRow[];
      const rangeTransactions = (txRangeRes.data ?? []) as TransactionRow[];
      const allTransactions = (txAllRes.data ?? []) as TransactionRow[];

      const computedIncome = rangeTransactions
        .filter((tx) => tx.type === "income" && !tx.to_account_id)
        .reduce((sum, tx) => sum + toNumber(tx.amount), 0);

      const computedExpense = rangeTransactions
        .filter((tx) => tx.type === "expense" && !tx.to_account_id)
        .reduce((sum, tx) => sum + toNumber(tx.amount), 0);

      const perAccount = new Map<string, number>();
      for (const tx of allTransactions) {
        const amount = toNumber(tx.amount);
        if (!amount) continue;

        if (tx.type === "income" && !tx.to_account_id) {
          increment(perAccount, tx.account_id, amount);
        }

        if (tx.type === "expense" && !tx.to_account_id) {
          increment(perAccount, tx.account_id, -amount);
        }

        if (tx.to_account_id) {
          increment(perAccount, tx.account_id, -amount);
          increment(perAccount, tx.to_account_id, amount);
        }
      }

      const cash = accounts
        .filter((acc) => acc.type === "cash")
        .reduce((sum, acc) => sum + (perAccount.get(acc.id) ?? 0), 0);

      const nonCash = accounts
        .filter((acc) => acc.type !== "cash")
        .reduce((sum, acc) => sum + (perAccount.get(acc.id) ?? 0), 0);

      if (!mountedRef.current) {
        return;
      }

      setIncome(computedIncome);
      setExpense(computedExpense);
      setCashBalance(cash);
      setNonCashBalance(nonCash);
      setTotalBalance(cash + nonCash);
      setLoading(false);
    } catch (err) {
      if (!mountedRef.current) {
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }, [startKey, endKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return useMemo(
    () => ({
      income,
      expense,
      cashBalance,
      nonCashBalance,
      totalBalance,
      loading,
      error,
      refresh,
    }),
    [income, expense, cashBalance, nonCashBalance, totalBalance, loading, error, refresh]
  );
}

