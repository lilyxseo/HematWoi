import type { ProjectionMethod } from '../../../lib/simMath';
import { projectAmount } from '../../../lib/simMath';
import type { SimulationSnapshot } from '../../../lib/simScenarioApi';

interface CSVExportProps {
  snapshot: SimulationSnapshot | null;
  projectionMethod: ProjectionMethod;
  includeWeekly: boolean;
}

function sumRecord(record: Record<string, number>): number {
  return Object.values(record).reduce((acc, value) => acc + (value ?? 0), 0);
}

function formatNumber(value: number): string {
  return value.toFixed(2);
}

export default function CSVExport({ snapshot, projectionMethod, includeWeekly }: CSVExportProps) {
  function handleExport() {
    if (!snapshot) return;
    const context = {
      periodMonth: snapshot.baseline.periodMonth,
      daysInMonth: snapshot.baseline.daysInMonth,
      daysElapsed: snapshot.baseline.daysElapsed,
      totalWeeks: Math.max(snapshot.baseline.weeks.length, 1),
    };
    const header = [
      'Kategori',
      'Tipe',
      'Planned Baseline',
      'Delta',
      'Planned Simulasi',
      'Projected',
    ];
    const rows = snapshot.categories.map((category) => {
      const baseline = includeWeekly ? sumRecord(category.plannedWeekly) : category.plannedMonthly;
      const simulation = includeWeekly ? sumRecord(category.simulatedWeekly) : category.simulatedMonthly;
      const delta = simulation - baseline;
      const projected = projectAmount(projectionMethod, context, {
        actualMtd: category.actualMtd,
        weeklyActuals: snapshot.baseline.weeks.map((week) => category.weeklyActuals[week] ?? 0),
        trailingWeeklyActuals: category.trailingWeeklyActuals,
      });
      return [
        category.name,
        category.type,
        formatNumber(baseline),
        formatNumber(delta),
        formatNumber(simulation),
        formatNumber(projected),
      ];
    });
    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `hematwoi-simulation-${snapshot.scenario.period_month}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      className="btn btn-outline h-10 rounded-2xl px-4"
      onClick={handleExport}
      disabled={!snapshot}
    >
      Export CSV
    </button>
  );
}
