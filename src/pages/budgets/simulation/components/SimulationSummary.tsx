import type { BudgetSimulationScenario } from '../../../../lib/simScenarioApi';
import type { ProjectionMode, SimulationResult } from '../../../../lib/simMath';
import { formatCurrency, formatMonthLabel } from '../../../../lib/simMath';

interface SimulationSummaryProps {
  scenario: BudgetSimulationScenario;
  simulation: SimulationResult | null;
  includeWeekly: boolean;
  projectionMode: ProjectionMode;
  showProjectionHelp: boolean;
  onProjectionChange: (mode: ProjectionMode) => void;
  onToggleProjectionHelp: () => void;
}

const PROJECTION_MODE_OPTIONS: { value: ProjectionMode; label: string; description: string }[] = [
  { value: 'linear-mtd', label: 'Linear MTD', description: 'Rata-rata harian hingga hari ini dikali jumlah hari dalam bulan.' },
  { value: 'four-week', label: '4 Minggu Terakhir', description: 'Rata-rata empat minggu terakhir dikali jumlah minggu bulan ini.' },
  { value: 'static', label: 'Tetap', description: 'Tidak ada proyeksi tambahan, gunakan realisasi MTD saja.' },
];

export default function SimulationSummary({
  scenario,
  simulation,
  includeWeekly,
  projectionMode,
  showProjectionHelp,
  onProjectionChange,
  onToggleProjectionHelp,
}: SimulationSummaryProps) {
  const baselineTotal = simulation?.summary.totalBaselinePlanned ?? 0;
  const simulatedTotal = simulation?.summary.totalSimulatedPlanned ?? 0;
  const delta = simulation?.summary.totalDeltaPlanned ?? 0;
  const actual = simulation?.summary.totalActualMtd ?? 0;
  const projected = simulation?.summary.totalProjected ?? 0;
  const balanceImpact = simulation?.summary.balanceImpact ?? 0;
  const monthLabel = formatMonthLabel(scenario.period_month ?? '');
  const status = scenario.status ?? 'draft';
  const statusClass =
    status === 'applied'
      ? 'bg-emerald-500/15 text-emerald-300'
      : status === 'draft'
        ? 'bg-accent/15 text-accent'
        : 'bg-muted/20 text-muted';

  return (
    <div className="space-y-4 rounded-2xl border border-border-subtle bg-surface/80 p-5 shadow">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-text">Ringkasan Dampak</h3>
            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusClass}`}>
              {status}
            </span>
          </div>
          <p className="text-sm text-muted">
            {scenario.name} • {monthLabel} • {includeWeekly ? 'Menggunakan anggaran mingguan' : 'Fokus anggaran bulanan'}
          </p>
          {scenario.notes ? (
            <p className="rounded-xl border border-border/60 bg-surface-alt/60 px-3 py-2 text-xs text-muted">
              {scenario.notes}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted">Metode Proyeksi</div>
          <div className="flex flex-wrap gap-2">
            {PROJECTION_MODE_OPTIONS.map((option) => {
              const active = option.value === projectionMode;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onProjectionChange(option.value)}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                    active
                      ? 'bg-accent text-accent-foreground shadow'
                      : 'border border-border/60 bg-surface text-muted hover:border-accent/60 hover:text-text'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onToggleProjectionHelp}
            className="text-xs font-semibold text-accent underline-offset-4 hover:underline"
          >
            {showProjectionHelp ? 'Sembunyikan penjelasan' : 'Lihat penjelasan metode'}
          </button>
        </div>
      </div>

      {showProjectionHelp ? (
        <div className="rounded-2xl border border-border/60 bg-surface-alt/70 p-4 text-xs text-muted">
          {PROJECTION_MODE_OPTIONS.find((option) => option.value === projectionMode)?.description}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryStat label="Planned baseline" value={baselineTotal} detail={formatCurrency(baselineTotal)} />
        <SummaryStat
          label="Planned simulasi"
          value={simulatedTotal}
          detail={`${formatCurrency(simulatedTotal)} (${delta >= 0 ? '+' : ''}${formatCurrency(delta)})`}
        />
        <SummaryStat label="Actual MTD" value={actual} detail={formatCurrency(actual)} />
        <SummaryStat label="Projected EOM" value={projected} detail={formatCurrency(projected)} />
      </div>

      <div className="rounded-2xl border border-border-subtle bg-surface-alt/70 px-4 py-3 text-sm text-text">
        Perkiraan dampak saldo akhir bulan: <span className={`font-mono font-semibold ${balanceImpact >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {balanceImpact >= 0 ? '+' : ''}
          {formatCurrency(balanceImpact)}
        </span>
      </div>
    </div>
  );
}

interface SummaryStatProps {
  label: string;
  value: number;
  detail: string;
}

function SummaryStat({ label, value, detail }: SummaryStatProps) {
  return (
    <div className="rounded-2xl border border-border/60 bg-surface px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-lg font-bold text-text">{formatCurrency(value)}</p>
      <p className="text-xs font-mono text-muted">{detail}</p>
    </div>
  );
}
