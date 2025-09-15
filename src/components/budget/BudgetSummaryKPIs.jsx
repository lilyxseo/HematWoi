import { formatCurrency } from "../../lib/format";

export default function BudgetSummaryKPIs({ totals }) {
  const usedPct = totals.planned > 0 ? Math.round((totals.actual / totals.planned) * 100) : 0;
  return (
    <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
      <div>
        <div className="text-muted">Planned</div>
        <div className="font-semibold">{formatCurrency(totals.planned)}</div>
      </div>
      <div>
        <div className="text-muted">Actual</div>
        <div className="font-semibold">{formatCurrency(totals.actual)}</div>
      </div>
      <div>
        <div className="text-muted">Remaining</div>
        <div className="font-semibold">{formatCurrency(totals.remaining)}</div>
      </div>
      <div>
        <div className="text-muted">% Used</div>
        <div className="font-semibold">{usedPct}%</div>
      </div>
    </div>
  );
}
