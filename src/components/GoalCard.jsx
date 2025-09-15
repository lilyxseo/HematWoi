import GoalProgressBar from './GoalProgressBar';
import { formatCurrency } from '../lib/format';

export default function GoalCard({ goal, onEdit, onDelete }) {
  return (
    <div className="p-4 border rounded shadow-sm bg-white dark:bg-slate-800 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium truncate" title={goal.name}>{goal.name}</h3>
        {onEdit && (
          <button className="text-sm text-brand" onClick={() => onEdit(goal)}>
            Edit
          </button>
        )}
      </div>
      <div className="text-sm text-slate-500">
        {formatCurrency(goal.allocated)} / {formatCurrency(goal.target)}
      </div>
      <GoalProgressBar goal={goal} />
      {onDelete && (
        <button
          className="self-end text-xs text-red-600 hover:underline"
          onClick={() => onDelete(goal.id)}
        >
          Delete
        </button>
      )}
    </div>
  );
}
