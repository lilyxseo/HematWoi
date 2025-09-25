import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  computeSpentByCategory,
  listBudgets,
  listExpenseCategories,
  type BudgetCategory,
  type BudgetRecord,
} from '../lib/budgetApi.ts';

export interface BudgetRow {
  id: string;
  categoryId: string | null;
  categoryName: string;
  amountPlanned: number;
  carryoverEnabled: boolean;
  notes: string | null;
  periodMonth: string;
  spent: number;
  remaining: number;
  raw: BudgetRecord;
}

export interface BudgetSummary {
  totalPlanned: number;
  totalSpent: number;
  remaining: number;
  percentage: number;
}

export interface UseBudgetsState {
  rows: BudgetRow[];
  categories: BudgetCategory[];
  summary: BudgetSummary;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  periodDate: string | null;
}

const EMPTY_SUMMARY: BudgetSummary = {
  totalPlanned: 0,
  totalSpent: 0,
  remaining: 0,
  percentage: 0,
};

function ensurePeriod(period: string | null): string | null {
  if (!period) return null;
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return null;
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toISOString().slice(0, 10);
}

function formatCategoryName(record: BudgetRecord, categories: BudgetCategory[]): string {
  const fallback = record.category?.name ?? 'Tanpa Kategori';
  if (!record.category_id) return fallback;
  const match = categories.find((item) => item.id === record.category_id);
  return match?.name ?? fallback;
}

function buildRow(
  record: BudgetRecord,
  categories: BudgetCategory[],
  spentLookup: Record<string, number>
): BudgetRow {
  const spent = record.category_id ? spentLookup[record.category_id] ?? 0 : 0;
  const amountPlanned = Number(record.amount_planned ?? 0);
  const remaining = amountPlanned - spent;
  return {
    id: record.id,
    categoryId: record.category_id,
    categoryName: formatCategoryName(record, categories),
    amountPlanned,
    carryoverEnabled: Boolean(record.carryover_enabled),
    notes: record.notes ?? null,
    periodMonth: record.period_month,
    spent,
    remaining,
    raw: record,
  };
}

function sortRows(rows: BudgetRow[]): BudgetRow[] {
  return [...rows].sort((a, b) => a.categoryName.localeCompare(b.categoryName, 'id', { sensitivity: 'base' }));
}

export default function useBudgets(period: string | null, userId: string | null): UseBudgetsState {
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const periodDate = useMemo(() => ensurePeriod(period), [period]);

  const load = useCallback(async () => {
    if (!period || !userId) {
      setRows([]);
      setCategories([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [categoryRows, budgetRecords, spent] = await Promise.all([
        listExpenseCategories(userId),
        listBudgets(userId, period),
        computeSpentByCategory(userId, period),
      ]);

      const expenseCategoryIds = new Set(categoryRows.map((cat) => cat.id));
      const filteredBudgets = budgetRecords.filter((record) => {
        if (!record.category_id) return false;
        return expenseCategoryIds.has(record.category_id);
      });
      const builtRows = filteredBudgets.map((record) => buildRow(record, categoryRows, spent));

      setCategories(categoryRows);
      setRows(sortRows(builtRows));
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'Gagal memuat anggaran. Silakan coba lagi.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [period, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    if (!rows.length) return EMPTY_SUMMARY;
    const totalPlanned = rows.reduce((sum, row) => sum + row.amountPlanned, 0);
    const totalSpent = rows.reduce((sum, row) => sum + row.spent, 0);
    const remaining = totalPlanned - totalSpent;
    const percentage = totalPlanned > 0 ? Math.max(0, Math.min((totalSpent / totalPlanned) * 100, 999)) : 0;
    return {
      totalPlanned,
      totalSpent,
      remaining,
      percentage,
    } satisfies BudgetSummary;
  }, [rows]);

  return {
    rows,
    categories,
    summary,
    loading,
    error,
    refresh: load,
    periodDate,
  };
}
