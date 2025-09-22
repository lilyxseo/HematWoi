import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatBudgetAmount } from '../../lib/api-budgets';
import type { BudgetViewModel } from './types';

interface BudgetDetailDrawerProps {
  budget: BudgetViewModel | null;
  onClose: () => void;
  period: string;
}

interface TxRow {
  id: string;
  date: string;
  amount: number;
  note: string | null;
}

export default function BudgetDetailDrawer({ budget, onClose, period }: BudgetDetailDrawerProps) {
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!budget) {
      setTxs([]);
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const from = `${period}-01`;
        const baseDate = new Date(`${from}T00:00:00Z`);
        const next = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + 1, 1));
        const to = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`;
        let query = supabase
          .from('transactions')
          .select('id, date, amount, notes')
          .gte('date', from)
          .lt('date', to)
          .order('date', { ascending: false })
          .limit(25);
        if (budget.categoryId) {
          query = query.eq('category_id', budget.categoryId);
        } else {
          query = query.is('category_id', null);
        }
        const { data, error } = await query;
        if (error) throw error;
        setTxs(
          (data ?? []).map((row) => ({
            id: String(row.id),
            date: row.date ?? new Date().toISOString(),
            amount: Number(row.amount ?? 0),
            note: row.notes ?? null,
          }))
        );
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[HW][budget-detail]', error);
        setTxs([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [budget, period]);

  const progress = useMemo(() => {
    if (!budget) return 0;
    const base = budget.planned + budget.rolloverIn;
    if (base <= 0) return 0;
    return Math.min(1, budget.actual / base);
  }, [budget]);

  if (!budget) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/30"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative h-full w-full max-w-md bg-surface-1 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="absolute right-4 top-4 rounded-full border border-border px-3 py-1 text-sm"
          onClick={onClose}
        >
          Tutup
        </button>
        <div className="flex h-full flex-col gap-4 overflow-y-auto px-6 py-8">
          <div>
            <h2 className="text-xl font-semibold">{budget.label}</h2>
            <p className="mt-1 text-sm text-muted">Periode {period}</p>
          </div>
          <div className="space-y-3 rounded-2xl border border-border bg-surface-2 p-4">
            <div className="flex items-center justify-between text-sm">
              <span>Rencana</span>
              <span className="tabular-nums font-medium">{formatBudgetAmount(budget.planned)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Rollover masuk</span>
              <span className="tabular-nums">{formatBudgetAmount(budget.rolloverIn)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Aktual</span>
              <span className="tabular-nums font-semibold">{formatBudgetAmount(budget.actual)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Sisa</span>
              <span className={`tabular-nums font-semibold ${budget.remaining < 0 ? 'text-red-500' : ''}`}>
                {formatBudgetAmount(budget.remaining)}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-border">
              <div
                className={`h-2 rounded-full ${
                  budget.status === 'overspend'
                    ? 'bg-red-500'
                    : budget.status === 'warning'
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Transaksi terbaru</h3>
            {loading ? (
              <p className="text-sm text-muted">Memuat…</p>
            ) : txs.length === 0 ? (
              <p className="text-sm text-muted">Belum ada transaksi untuk anggaran ini.</p>
            ) : (
              <ul className="space-y-2">
                {txs.map((tx) => (
                  <li key={tx.id} className="rounded-2xl border border-border bg-surface-2 p-3">
                    <p className="text-sm font-medium tabular-nums">{formatBudgetAmount(tx.amount)}</p>
                    <p className="text-xs text-muted">{new Date(tx.date).toLocaleDateString('id-ID')}</p>
                    {tx.note && <p className="mt-1 text-xs text-muted">{tx.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
