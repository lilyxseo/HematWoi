import { goalProgress } from '../lib/goals';

export default function GoalProgressBar({ goal }) {
  const pct = goalProgress(goal) * 100;
  return (
    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded h-2">
      <div className="h-2 bg-brand rounded" style={{ width: `${pct}%` }} />
    </div>
  );
}
