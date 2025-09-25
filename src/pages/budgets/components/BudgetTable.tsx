import { Pencil, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../../lib/format';
import type { BudgetWithSpent } from '../../../lib/budgetApi';

interface BudgetTableProps {
  rows: BudgetWithSpent[];
  loading?: boolean;
  onEdit: (row: BudgetWithSpent) => void;
  onDelete: (row: BudgetWithSpent) => void;
  onToggleCarryover: (row: BudgetWithSpent, carryover: boolean) => void;
}

const TABLE_WRAPPER_CLASS = 'card overflow-hidden p-0';

function LoadingRows() {
  return (
    <tbody>
      {Array.from({ length: 5 }).map((_, index) => (
        <tr key={index} className="animate-pulse border-b border-white/10 last:border-0">
          {Array.from({ length: 7 }).map((__, cellIndex) => (
            <td key={cellIndex} className="px-4 py-4">
              <div className="h-4 w-full rounded-full bg-zinc-200/60 dark:bg-zinc-700/60" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

function EmptyState() {
  return (
    <tbody>
      <tr>
        <td colSpan={7} className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Belum ada anggaran untuk periode ini. Tambahkan kategori agar pengeluaran lebih terkontrol.
        </td>
      </tr>
    </tbody>
  );
}

export default function BudgetTable({ rows, loading, onEdit, onDelete, onToggleCarryover }: BudgetTableProps) {
  return (
    <div className={TABLE_WRAPPER_CLASS}>
      <div className="max-h-[520px] overflow-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-white/90 text-xs uppercase tracking-wide text-zinc-500 backdrop-blur dark:bg-zinc-950/70 dark:text-zinc-400">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Kategori</th>
              <th scope="col" className="px-4 py-3 font-semibold">Planned</th>
              <th scope="col" className="px-4 py-3 font-semibold">Spent</th>
              <th scope="col" className="px-4 py-3 font-semibold">Remaining</th>
              <th scope="col" className="px-4 py-3 font-semibold">Carryover</th>
              <th scope="col" className="px-4 py-3 font-semibold">Catatan</th>
              <th scope="col" className="px-4 py-3 font-semibold">Aksi</th>
            </tr>
          </thead>
          {loading ? (
            <LoadingRows />
          ) : rows.length === 0 ? (
            <EmptyState />
          ) : (
            <tbody className="divide-y divide-border-subtle text-sm text-text">
              {rows.map((row) => {
                const remainingClass = row.remaining < 0 ? 'text-danger' : 'text-success';
                return (
                  <tr
                    key={row.id}
                    className="transition-colors odd:bg-surface-alt/40 even:bg-surface-alt/60 hover:bg-surface-alt"
                  >
                    <td className="px-4 py-4 font-medium text-text">
                      {row.category?.name ?? 'Tanpa kategori'}
                    </td>
                    <td className="px-4 py-4">{formatCurrency(row.amount_planned, 'IDR')}</td>
                    <td className="px-4 py-4">{formatCurrency(row.spent, 'IDR')}</td>
                    <td className={`px-4 py-4 font-semibold ${remainingClass}`}>
                      {formatCurrency(row.remaining, 'IDR')}
                    </td>
                    <td className="px-4 py-4">
                      <label className="relative inline-flex h-6 w-12 cursor-pointer items-center">
                        <input
                          type="checkbox"
                          checked={row.carryover_enabled}
                          onChange={(event) => onToggleCarryover(row, event.target.checked)}
                          className="peer sr-only"
                        />
                        <span className="absolute inset-0 rounded-full bg-surface-alt transition peer-checked:bg-primary" />
                        <span className="relative ml-1 h-4 w-4 rounded-full bg-surface shadow-sm transition-transform peer-checked:translate-x-6" />
                      </label>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted">
                      {row.notes?.trim() ? row.notes : '—'}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onEdit(row)}
                          className="btn btn-secondary btn-sm"
                        >
                          <Pencil className="h-4 w-4" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(row)}
                          className="btn btn-danger btn-sm"
                        >
                          <Trash2 className="h-4 w-4" /> Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}

