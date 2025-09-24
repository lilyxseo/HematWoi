import { useEffect, useState } from 'react';
import Modal from '../Modal.jsx';
import {
  bulkUpsertBudgets,
  listRules,
  BudgetRulesUnavailableError,
} from '../../lib/api-budgets';
import type { BudgetRuleRecord } from '../../lib/api-budgets';
import type { BudgetViewModel } from './types';
import { supabase } from '../../lib/supabase';
import { formatBudgetAmount } from '../../lib/api-budgets';
import { useToast } from '../../context/ToastContext';

interface AutoAllocateDialogProps {
  open: boolean;
  onClose: () => void;
  period: string;
  budgets: BudgetViewModel[];
  onApplied: () => Promise<void> | void;
  rulesEnabled?: boolean;
}

interface PreviewRow {
  budget: BudgetViewModel;
  rule?: BudgetRuleRecord;
  recommended: number;
}

async function fetchIncome(period: string) {
  const from = `${period}-01`;
  const base = new Date(`${from}T00:00:00Z`);
  const next = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1));
  const to = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const { data, error } = await supabase
    .from('transactions')
    .select('amount')
    .eq('type', 'income')
    .gte('date', from)
    .lt('date', to);
  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
}

async function fetchHistory(period: string, categoryIds: string[]) {
  if (!categoryIds.length) return new Map<string, number>();
  const baseDate = new Date(`${period}-01T00:00:00Z`);
  const months: string[] = [];
  for (let i = 1; i <= 3; i += 1) {
    const d = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() - i, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`);
  }
  const { data, error } = await supabase
    .from('budget_activity')
    .select('category_id, period_month, actual')
    .in('period_month', months)
    .in('category_id', categoryIds);
  if (error) throw error;
  const map = new Map<string, number>();
  categoryIds.forEach((id) => {
    const values = (data ?? [])
      .filter((row) => row.category_id === id)
      .map((row) => Number(row.actual ?? 0))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);
    if (values.length) {
      const mid = Math.floor(values.length / 2);
      const median = values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
      map.set(id, median);
    }
  });
  return map;
}

export default function AutoAllocateDialog({
  open,
  onClose,
  period,
  budgets,
  onApplied,
  rulesEnabled = true,
}: AutoAllocateDialogProps) {
  const { addToast } = useToast();
  const [rules, setRules] = useState<BudgetRuleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);

  useEffect(() => {
    if (!open || !rulesEnabled) {
      setRules([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const rows = await listRules();
        if (!cancelled) setRules(rows.filter((row) => row.active));
      } catch (error) {
        if (error instanceof BudgetRulesUnavailableError) {
          addToast(error.message, 'warning');
          if (!cancelled) onClose();
        } else {
          addToast(`Gagal memuat aturan: ${error instanceof Error ? error.message : 'tidak diketahui'}`, 'error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, rulesEnabled, addToast, onClose]);

  useEffect(() => {
    if (!open) return;
    const mapped = budgets.map((budget) => {
      const rule = rules.find((item) => item.category_id === budget.categoryId);
      return { budget, rule, recommended: budget.planned };
    });
    setPreviewRows(mapped);
  }, [budgets, rules, open, rulesEnabled]);

  useEffect(() => {
    if (!open || !rules.length || !rulesEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        const incomeTotal = await fetchIncome(period);
        const ruleCategories = rules
          .map((rule) => rule.category_id)
          .filter((id): id is string => Boolean(id));
        const history = await fetchHistory(period, ruleCategories);
        if (cancelled) return;
        setPreviewRows((prev) =>
          prev.map((row) => {
            if (!row.rule) return row;
            let recommended = row.budget.planned;
            if (row.rule.rule_type === 'fixed') {
              recommended = Number(row.rule.value ?? row.budget.planned);
            } else if (row.rule.rule_type === 'percent-income') {
              const percentage = Number(row.rule.value ?? 0) / 100;
              recommended = Math.max(0, incomeTotal * percentage);
            } else if (row.rule.rule_type === 'smart') {
              const historical = row.rule.category_id ? history.get(row.rule.category_id) ?? 0 : 0;
              recommended = historical || row.budget.actual || row.budget.planned;
            }
            return { ...row, recommended };
          })
        );
      } catch (error) {
        addToast(`Gagal menghitung alokasi: ${error instanceof Error ? error.message : 'tidak diketahui'}`, 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, rules, period, addToast, rulesEnabled]);

  const handleApply = async () => {
    if (!rulesEnabled) {
      addToast('Aturan anggaran belum tersedia', 'warning');
      return;
    }
    const payload = previewRows
      .filter((row) => row.rule && row.budget.categoryId)
      .map((row) => ({
        period,
        category_id: row.budget.categoryId ?? undefined,
        planned: row.recommended,
        carry_rule: row.budget.carryRule,
        note: row.budget.note ?? undefined,
        rollover_in: row.budget.rolloverIn,
        rollover_out: row.budget.rolloverOut,
      }));
    if (!payload.length) {
      addToast('Tidak ada aturan aktif untuk diterapkan', 'warning');
      return;
    }
    try {
      setApplying(true);
      await bulkUpsertBudgets(payload);
      addToast('Aturan berhasil diterapkan', 'success');
      await onApplied();
    } catch (error) {
      addToast(`Gagal menerapkan aturan: ${error instanceof Error ? error.message : 'tidak diketahui'}`, 'error');
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal open={open} title="Terapkan aturan anggaran" onClose={onClose}>
      <div className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted">Memuat aturan…</p>
        ) : (
          <div className="max-h-[320px] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted">
                  <th className="px-2 py-2">Anggaran</th>
                  <th className="px-2 py-2 text-right">Planned saat ini</th>
                  <th className="px-2 py-2 text-right">Rekomendasi</th>
                  <th className="px-2 py-2">Aturan</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={row.budget.id} className="border-t border-border">
                    <td className="px-2 py-2">{row.budget.label}</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {formatBudgetAmount(row.budget.planned)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {row.rule ? formatBudgetAmount(row.recommended) : '—'}
                    </td>
                    <td className="px-2 py-2 text-xs text-muted">
                      {row.rule
                        ? row.rule.rule_type === 'fixed'
                          ? `Nominal tetap ${formatBudgetAmount(row.rule.value)}`
                          : row.rule.rule_type === 'percent-income'
                          ? `Persentase pemasukan (${row.rule.value}%)`
                          : 'Smart (median 3 bulan)'
                        : 'Tidak ada aturan aktif'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-end gap-2 text-sm">
          <button
            type="button"
            className="rounded-2xl border border-border px-4 py-2"
            onClick={onClose}
          >
            Tutup
          </button>
          <button
            type="button"
            className="rounded-2xl bg-[var(--brand)] px-4 py-2 font-semibold text-white"
            onClick={handleApply}
            disabled={applying}
          >
            {applying ? 'Menerapkan…' : 'Terapkan aturan'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
