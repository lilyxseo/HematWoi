import { PropsWithChildren } from 'react';
import type { SimulationResult } from '../../../../lib/simMath';

interface CSVExportProps extends PropsWithChildren {
  simulation: SimulationResult | null;
  filename: string;
  className?: string;
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default function CSVExport({ simulation, filename, className, children }: CSVExportProps) {
  const disabled = !simulation || simulation.categories.length === 0;

  const handleExport = () => {
    if (!simulation) return;
    const headers = ['Kategori', 'Planned baseline', 'Penyesuaian', 'Planned simulasi', 'Projected EOM'];
    const rows = simulation.categories.map((category) => {
      const delta = category.deltaPlanned;
      return [
        escapeCsv(category.categoryName),
        escapeCsv(String(Math.round(category.baselinePlanned))),
        escapeCsv(String(Math.round(delta))),
        escapeCsv(String(Math.round(category.simulatedPlanned))),
        escapeCsv(String(Math.round(category.projectedEom))),
      ].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={disabled}
      className={`${className ?? ''} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`.trim()}
    >
      {children}
    </button>
  );
}
