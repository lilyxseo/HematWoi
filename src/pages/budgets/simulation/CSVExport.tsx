import { useCallback } from 'react';
import { Download } from 'lucide-react';
import type { SimulationCategoryResult, SimulationTotals } from '../../../lib/simMath';

interface CSVExportProps {
  categories: SimulationCategoryResult[];
  totals: SimulationTotals;
  filename?: string;
}

export default function CSVExport({ categories, totals, filename = 'budget-simulation.csv' }: CSVExportProps) {
  const handleExport = useCallback(() => {
    const header = ['Kategori', 'Planned Baseline', 'Penyesuaian', 'Planned Simulasi', 'Projected EOM'];
    const numberFormatter = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const rows = categories.map((category) => [
      category.categoryName,
      numberFormatter.format(category.baselinePlanned),
      numberFormatter.format(category.totalDelta),
      numberFormatter.format(category.simulationPlanned),
      numberFormatter.format(category.projectedEom),
    ]);
    rows.push([
      'TOTAL',
      numberFormatter.format(totals.baselinePlanned),
      numberFormatter.format(totals.deltaPlanned),
      numberFormatter.format(totals.simulationPlanned),
      numberFormatter.format(totals.projectedEom),
    ]);
    const csvContent = [header, ...rows]
      .map((row) => row.map(escapeCsv).join(','))
      .join('\n');
    const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [categories, totals, filename]);

  return (
    <button
      type="button"
      onClick={handleExport}
      className="inline-flex items-center gap-2 rounded-2xl border border-border/60 px-4 py-2 text-sm font-semibold text-muted transition hover:border-brand/40 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      aria-label="Ekspor simulasi ke CSV"
    >
      <Download className="h-4 w-4" />
      Export CSV
    </button>
  );
}

function escapeCsv(value: string | number): string {
  const text = typeof value === 'number' ? String(value) : value;
  if (text.includes(',') || text.includes('\"') || text.includes('\n')) {
    return `"${text.replace(/\"/g, '""')}"`;
  }
  return text;
}

