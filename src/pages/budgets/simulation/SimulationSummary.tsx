import clsx from 'clsx';
import { useMemo } from 'react';
import { AlertCircle, RefreshCw, Save, Send } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { formatCurrency } from '../../../lib/format';
import { computeTotals } from '../../../lib/simScenarioApi';
import type { ProjectionMethod } from '../../../lib/simMath';
import type { SimulationSnapshot } from '../../../lib/simScenarioApi';
import RiskList from './RiskList';
import CSVExport from './CSVExport';

interface SimulationSummaryProps {
  snapshot: SimulationSnapshot | null;
  projectionMethod: ProjectionMethod;
  onProjectionMethodChange: (method: ProjectionMethod) => void;
  includeWeekly: boolean;
  onIncludeWeeklyChange: (value: boolean) => void;
  onSaveDraft: () => void;
  onApply: () => void;
  onReset: () => void;
  saving?: boolean;
  applying?: boolean;
  disabled?: boolean;
}

const PROJECTION_OPTIONS: { value: ProjectionMethod; label: string; description: string }[] = [
  { value: 'linear', label: 'Linear MTD', description: 'Rata-rata harian dikalikan jumlah hari bulan.' },
  { value: 'fourWeek', label: '4 Minggu', description: 'Rata-rata 4 minggu terakhir sebagai proyeksi.' },
  { value: 'static', label: 'Tetap', description: 'Gunakan realisasi MTD tanpa proyeksi.' },
];

export default function SimulationSummary({
  snapshot,
  projectionMethod,
  onProjectionMethodChange,
  includeWeekly,
  onIncludeWeeklyChange,
  onSaveDraft,
  onApply,
  onReset,
  saving = false,
  applying = false,
  disabled = false,
}: SimulationSummaryProps) {
  const totals = useMemo(() => {
    if (!snapshot) return null;
    return computeTotals(snapshot, projectionMethod, includeWeekly);
  }, [snapshot, projectionMethod, includeWeekly]);

  const plannedBaseline = totals?.baseline.expense ?? 0;
  const plannedSimulation = totals?.simulation.expense ?? 0;
  const actualMtd = totals?.actual.expense ?? 0;
  const projected = totals?.projected.expense ?? 0;
  const remaining = plannedSimulation - projected;
  const deltaSaldo = totals
    ? (totals.simulation.income - totals.simulation.expense) -
      (totals.baseline.income - totals.baseline.expense)
    : 0;
  const scenarioLabel = snapshot ? format(new Date(snapshot.scenario.period_month), 'LLLL yyyy', { locale: id }) : '';

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-text">Ringkasan Dampak</p>
            {snapshot ? (
              <p className="text-xs text-text-subtle">Periode {scenarioLabel}</p>
            ) : (
              <p className="text-xs text-text-subtle">Pilih skenario untuk melihat ringkasan.</p>
            )}
          </div>
          <CSVExport snapshot={snapshot} projectionMethod={projectionMethod} includeWeekly={includeWeekly} />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border-subtle bg-surface-subtle p-4">
            <p className="text-xs uppercase tracking-wide text-text-subtle">Metode Proyeksi</p>
            <div className="mt-3 flex flex-col gap-2">
              {PROJECTION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onProjectionMethodChange(option.value)}
                  className={clsx(
                    'rounded-2xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    projectionMethod === option.value
                      ? 'border-accent bg-accent/10 text-text'
                      : 'border-border-subtle hover:border-accent/40'
                  )}
                >
                  <p className="text-sm font-medium">{option.label}</p>
                  <p className="text-xs text-text-subtle">{option.description}</p>
                </button>
              ))}
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                className="checkbox"
                checked={includeWeekly}
                onChange={(event) => onIncludeWeeklyChange(event.target.checked)}
              />
              Gunakan planned mingguan sebagai dasar kategori
            </label>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl border border-border-subtle bg-surface-subtle p-3">
                <p className="text-xs uppercase tracking-wide text-text-subtle">Planned Baseline</p>
                <p className="font-mono text-lg font-semibold text-text">{formatCurrency(plannedBaseline)}</p>
              </div>
              <div className="rounded-2xl border border-border-subtle bg-surface-subtle p-3">
                <p className="text-xs uppercase tracking-wide text-text-subtle">Planned Simulasi</p>
                <p className="font-mono text-lg font-semibold text-text">{formatCurrency(plannedSimulation)}</p>
              </div>
              <div className="rounded-2xl border border-border-subtle bg-surface-subtle p-3">
                <p className="text-xs uppercase tracking-wide text-text-subtle">Actual MTD</p>
                <p className="font-mono text-lg font-semibold text-text">{formatCurrency(actualMtd)}</p>
              </div>
              <div className="rounded-2xl border border-border-subtle bg-surface-subtle p-3">
                <p className="text-xs uppercase tracking-wide text-text-subtle">Projected EOM</p>
                <p className="font-mono text-lg font-semibold text-text">{formatCurrency(projected)}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-dashed border-accent bg-accent/5 p-3 text-sm">
              <div className="flex items-center gap-2 text-text">
                <AlertCircle className="h-4 w-4 text-accent" />
                <span className="font-medium">Sisa / Over</span>
              </div>
              <p className={clsx('font-mono text-lg font-semibold', remaining >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                {formatCurrency(remaining)}
              </p>
              <p className="text-xs text-text-subtle">Estimasi perubahan saldo akhir bulan: {formatCurrency(deltaSaldo)}</p>
            </div>
          </div>
        </div>
      </div>
      {snapshot ? (
        <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-sm">
          <p className="text-sm font-semibold text-text">Risiko Over-Budget</p>
          <p className="text-xs text-text-subtle">Kategori ≥90% dari planned simulasi akan tampil di sini.</p>
          <div className="mt-4">
            <RiskList snapshot={snapshot} projectionMethod={projectionMethod} includeWeekly={includeWeekly} />
          </div>
        </div>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-4 shadow-sm">
        <button type="button" className="btn btn-ghost" onClick={onReset} disabled={disabled}>
          <RefreshCw className="mr-2 h-4 w-4" /> Reset
        </button>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn btn-outline"
            onClick={onSaveDraft}
            disabled={disabled || saving}
          >
            <Save className="mr-2 h-4 w-4" /> Simpan Draft
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onApply}
            disabled={disabled || applying}
          >
            <Send className="mr-2 h-4 w-4" /> Terapkan
          </button>
        </div>
      </div>
    </div>
  );
}
