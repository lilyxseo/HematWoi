import type { SimulationSummary as SimulationSummaryData } from '../../../../lib/simScenarioApi';

interface SimulationSummaryProps {
  loading: boolean;
  summary: SimulationSummaryData | null;
  scenarioName: string;
  useWeeklyBudgets: boolean;
}

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(Math.round(value ?? 0));
}

export default function SimulationSummary({
  loading,
  summary,
  scenarioName,
  useWeeklyBudgets,
}: SimulationSummaryProps): JSX.Element {
  if (loading) {
    return (
      <div className="space-y-3 p-6" aria-busy="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-2xl bg-border/40" />
        ))}
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="p-6 text-sm text-muted">Pilih skenario untuk melihat ringkasan dampak.</div>
    );
  }

  const plannedLabel = useWeeklyBudgets ? 'Planned (mingguan)' : 'Planned (bulanan)';
  const remainderLabel = summary.remaining >= 0 ? 'Sisa anggaran' : 'Potensi over';
  const remainderClass = summary.remaining >= 0 ? 'text-emerald-400' : 'text-rose-400';

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-sm font-semibold text-text">Ringkasan Dampak</h2>
        <p className="text-xs text-muted">{scenarioName || 'Tanpa nama'}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-surface/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{plannedLabel}</p>
          <div className="mt-2 flex items-center justify-between font-mono text-sm">
            <span className="text-muted">Baseline</span>
            <span>{formatCurrency(summary.baselinePlanned)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-sm">
            <span className="text-text">Simulasi</span>
            <span className="text-[color:var(--accent)]">{formatCurrency(summary.simulationPlanned)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-xs text-muted">
            <span>Δ</span>
            <span className={summary.deltaPlanned >= 0 ? 'text-[color:var(--accent)]' : 'text-rose-400'}>
              {formatCurrency(summary.deltaPlanned)}
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-surface/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Actual &amp; Projection</p>
          <div className="mt-2 flex items-center justify-between font-mono text-sm">
            <span className="text-muted">Actual MTD</span>
            <span>{formatCurrency(summary.actualMtd)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-sm">
            <span className="text-text">Projected EOM</span>
            <span className="text-amber-400">{formatCurrency(summary.projected)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-xs text-muted">
            <span>{remainderLabel}</span>
            <span className={remainderClass}>{formatCurrency(summary.remaining)}</span>
          </div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-surface/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Δ Income</p>
          <div className="mt-3 text-right font-mono text-sm text-emerald-400">
            {formatCurrency(summary.incomeDelta)}
          </div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-surface/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Δ Expense</p>
          <div className="mt-3 text-right font-mono text-sm text-rose-400">
            {formatCurrency(summary.expenseDelta)}
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-border/60 bg-surface/80 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Impact Saldo</p>
            <p className="mt-1 text-sm text-muted">Perkiraan perubahan saldo akhir bulan</p>
          </div>
          <div className={`font-mono text-lg ${summary.netImpact >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatCurrency(summary.netImpact)}
          </div>
        </div>
      </div>
    </div>
  );
}

