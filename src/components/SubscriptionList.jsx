import { nextDue } from '../lib/subscriptions';

const fmt = new Intl.NumberFormat('id-ID');

export default function SubscriptionList({ items = [], onEdit, onDelete }) {
  if (!items.length) {
    return <div className="card p-4 text-sm text-center">Belum ada langganan.</div>;
  }
  return (
    <div className="space-y-3">
      {items.map((s) => {
        const due = nextDue(s);
        return (
          <div key={s.id} className="card p-3 flex justify-between items-start">
            <div className="space-y-1">
              <div className="font-semibold">{s.name}</div>
              <div className="text-xs text-slate-500">
                Rp {fmt.format(s.amount)} - {s.category}
              </div>
              <div className="text-xs flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700">
                  {s.period === 'monthly' ? 'Bulanan' : 'Tahunan'}
                </span>
                <span>Jatuh tempo {due.toLocaleDateString('id-ID')}</span>
              </div>
              {s.note && <div className="text-xs">{s.note}</div>}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn text-xs"
                onClick={() => onEdit(s)}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn text-xs"
                onClick={() => onDelete(s.id)}
              >
                Hapus
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

