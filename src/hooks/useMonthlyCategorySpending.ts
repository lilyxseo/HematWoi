import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import useSupabaseUser from './useSupabaseUser';

type MonthlyCategoryItem = {
  categoryId: string;
  name: string;
  color: string | null;
  amount: number;
  percentage: number;
};

type MonthlyCategorySpendingResult = {
  startISO: string;
  endISO: string;
  userId: string | null;
  enabled: boolean;
  authLoading: boolean;
  status: 'pending' | 'error' | 'success';
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  items: MonthlyCategoryItem[];
  totalExpense: number;
};

type TransactionRow = {
  amount?: number | string | null;
  category_id?: string | null;
  category?: {
    id?: string | null;
    name?: string | null;
    color?: string | null;
  } | null;
};

function toDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentMonthPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startISO: toDateISO(start),
    endISO: toDateISO(end),
  };
}

function toAmount(value: number | string | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.abs(value);
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return Math.abs(parsed);
  }
  return 0;
}

export default function useMonthlyCategorySpending(): MonthlyCategorySpendingResult {
  const { user, loading: authLoading } = useSupabaseUser();
  const { startISO, endISO } = useMemo(() => getCurrentMonthPeriod(), []);
  const userId = user?.id ?? null;
  const enabled = Boolean(userId && startISO && endISO) && !authLoading;

  const query = useQuery({
    queryKey: ['monthly-category-spending', userId, startISO, endISO],
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('amount,category_id,category:category_id(id,name,color)')
        .eq('user_id', userId)
        .eq('type', 'expense')
        .is('deleted_at', null)
        .gte('date', startISO)
        .lte('date', endISO);

      if (error) {
        throw new Error(error.message || 'Gagal memuat analisis bulanan.');
      }

      const groups = new Map<string, { amount: number; name: string; color: string | null }>();

      (data ?? []).forEach((row) => {
        const tx = row as TransactionRow;
        const amount = toAmount(tx.amount);
        if (amount <= 0) return;

        const categoryId = tx.category_id ?? tx.category?.id ?? 'uncategorized';
        const categoryName = tx.category?.name ?? 'Tanpa Kategori';
        const categoryColor = tx.category?.color ?? null;

        const prev = groups.get(categoryId);
        if (prev) {
          groups.set(categoryId, {
            ...prev,
            amount: prev.amount + amount,
          });
          return;
        }

        groups.set(categoryId, {
          amount,
          name: categoryName,
          color: categoryColor,
        });
      });

      const totalExpense = Array.from(groups.values()).reduce((sum, entry) => sum + entry.amount, 0);

      const items: MonthlyCategoryItem[] = Array.from(groups.entries()).map(([categoryId, value]) => ({
        categoryId,
        name: value.name,
        color: value.color,
        amount: value.amount,
        percentage: totalExpense > 0 ? value.amount / totalExpense : 0,
      }));

      return {
        totalExpense,
        items,
      };
    },
  });

  return {
    startISO,
    endISO,
    userId,
    enabled,
    authLoading,
    status: query.status,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error instanceof Error ? query.error : null,
    items: query.data?.items ?? [],
    totalExpense: query.data?.totalExpense ?? 0,
  };
}
