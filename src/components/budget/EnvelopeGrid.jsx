import { formatCurrency } from "../../lib/format";

function getColor(pct) {
  if (pct >= 100) return "bg-danger";
  if (pct >= 80) return "bg-warning";
  return "bg-brand-soft";
}

export default function EnvelopeGrid({ items, onSelect }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item)}
          className="card flex flex-col gap-1 text-left"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-medium">{item.category}</h3>
            <span className="text-sm">{formatCurrency(item.remaining)}</span>
          </div>
          <div className="text-xs text-muted">
            {formatCurrency(item.actual)} / {formatCurrency(item.amount_planned)}
          </div>
          <div className="h-2 w-full rounded-full bg-surface-2">
            <div
              className={`h-2 rounded-full ${getColor(item.pct)}`}
              style={{ width: `${item.pct}%` }}
            />
          </div>
        </button>
      ))}
    </div>
  );
}
