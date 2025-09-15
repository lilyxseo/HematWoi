import GoalProgressBar from './GoalProgressBar';
import { formatCurrency } from '../lib/format';
import { estimateGoalETA } from '../lib/goals';

export default function GoalCard({ goal, onEdit, onDelete, onQuickAdd }) {
  const avg = (() => {
    if (!goal.history || goal.history.length === 0) return 0;
    const cutoff = Date.now() - 1000 * 60 * 60 * 24 * 30;
    const recent = goal.history.filter((h) => new Date(h.date).getTime() >= cutoff);
    if (recent.length === 0) return 0;
    const total = recent.reduce((s, h) => s + h.amount, 0);
    return total / recent.length;
  })();
  const eta = estimateGoalETA(goal, avg);
  const etaText = eta ? eta.toLocaleDateString('id-ID') : '—';

  const quickAdd = () => {
    const val = parseFloat(prompt('Tambah tabungan', '0'));
    if (!isNaN(val) && val > 0) {
      onQuickAdd && onQuickAdd(goal.id, val);
    }
  };

  return (
    <div className="p-4 border rounded shadow-sm bg-white dark:bg-slate-800 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium truncate" title={goal.name}>{goal.name}</h3>
        <div className="flex gap-2 text-sm">
          {onQuickAdd && (
            <button className="text-brand" onClick={quickAdd} aria-label="Quick add saving">+ Tabung</button>
          )}
          {onEdit && (
            <button className="text-brand" onClick={() => onEdit(goal)} aria-label="Edit goal">Edit</button>
          )}
          {onDelete && (
            <button className="text-red-600" onClick={() => onDelete(goal.id)} aria-label="Delete goal">Delete</button>
          )}
        </div>
      </div>
      <div className="text-sm text-slate-500">
        {formatCurrency(goal.saved)} / {formatCurrency(goal.target)}
      </div>
      <GoalProgressBar goal={goal} />
      <div className="text-xs text-slate-500">ETA: {etaText}</div>
    </div>
  );
}
