import type { SimulationResult } from '../../../../lib/simScenarioApi';

interface CSVExportProps {
  simulation: SimulationResult | null;
  fileName: string;
  disabled?: boolean;
}

export default function CSVExport({ simulation, fileName, disabled }: CSVExportProps): JSX.Element {
  const handleExport = () => {
    if (!simulation) return;
    const headers = ['Kategori', 'Baseline Planned', 'Delta', 'Planned Simulasi', 'Projected'];
    const rows = simulation.categories.map((category) => [
      category.name,
      String(category.baselinePlanned),
      String(category.simulationPlanned - category.baselinePlanned),
      String(category.simulationPlanned),
      String(category.projected),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={disabled}
      className="inline-flex h-11 items-center rounded-2xl border border-border px-5 text-sm font-semibold text-text transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      Export CSV
    </button>
  );
}

