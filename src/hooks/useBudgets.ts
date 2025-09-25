import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  computeSpentByCategory,
  listBudgets,
  type BudgetRecord,
  type SpentByCategoryMap,
} from '../lib/budgetApi';

export interface BudgetRowView {
  id: string;
  categoryId: string | null;
  categoryName: string;
  amountPlanned: number;
  carryoverEnabled: boolean;
  notes: string | null;
  periodMonth: string;
  currentSpent: number;
  remaining: number;
}

export interface BudgetsSummary {
  planned: number;
  spent: number;
  remaining: number;
  percentage: number;
}

const EMPTY_SUMMARY: BudgetsSummary = {
  planned: 0,
  spent: 0,
  remaining: 0,
  percentage: 0,
};

function mapRows(
  budgets: BudgetRecord[],
  spentMap: SpentByCategoryMap,
): BudgetRowView[] {
  return budgets
    .filter((row) => row.category_id && (row.category?.type === 'expense' || !row.category?.type))
    .map((row) => {
      const categoryId = row.category_id ?? null;
      const spent = categoryId ? spentMap[categoryId] ?? 0 : 0;
      return {
        id: row.id,
        categoryId,
        categoryName: row.category?.name ?? 'Tanpa kategori',
        amountPlanned: Number.isFinite(row.amount_planned) ? row.amount_planned : 0,
        carryoverEnabled: Boolean(row.carryover_enabled),
        notes: row.notes ?? null,
        periodMonth: row.period_month,
        currentSpent: spent,
        remaining: (Number.isFinite(row.amount_planned) ? row.amount_planned : 0) - spent,
      } satisfies BudgetRowView;
    });
}

function computeSummary(rows: BudgetRowView[]): BudgetsSummary {
  if (!rows.length) return EMPTY_SUMMARY;
  const planned = rows.reduce((total, row) => total + row.amountPlanned, 0);
  const spent = rows.reduce((total, row) => total + row.currentSpent, 0);
  const remaining = planned - spent;
  const percentage = planned > 0 ? (spent / planned) * 100 : 0;
  return { planned, spent, remaining, percentage };
}

export function useBudgets(period: string) {
  const [rows, setRows] = useState<BudgetRowView[]>([]);
  const [summary, setSummary] = useState<BudgetsSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!period) return;
    setLoading(true);
    setError(null);
    try {
      const [budgets, spentMap] = await Promise.all([
        listBudgets(period),
        computeSpentByCategory(period),
      ]);
      const normalized = mapRows(budgets, spentMap);
      setRows(normalized);
      setSummary(computeSummary(normalized));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memuat data anggaran';
      setError(message);
      setRows([]);
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const memoSummary = useMemo(() => summary, [summary]);

  return { rows, summary: memoSummary, loading, error, refresh };
}
