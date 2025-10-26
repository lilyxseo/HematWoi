import { CalendarCheck2, FolderPlus, PenLine, Trash2, Copy, Archive } from 'lucide-react';
import clsx from 'clsx';
import type { BudgetSimulationScenario } from '../../../../lib/simScenarioApi';

interface ScenarioListProps {
  scenarios: BudgetSimulationScenario[];
  loading: boolean;
  selectedScenarioId: string | null;
  onSelect: (scenario: BudgetSimulationScenario | null) => void;
  onCreate: () => void;
  onEdit: (scenario: BudgetSimulationScenario) => void;
  onDuplicate: (scenario: BudgetSimulationScenario) => void;
  onArchive: (scenario: BudgetSimulationScenario) => void;
  onDelete: (scenario: BudgetSimulationScenario) => void;
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  applied: 'Terapkan',
  archived: 'Arsip',
};

const STATUS_CLASS: Record<string, string> = {
  draft: 'bg-accent/15 text-accent',
  applied: 'bg-emerald-500/15 text-emerald-400',
  archived: 'bg-muted/20 text-muted',
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const date = new Date(iso);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
    }).format(date);
  } catch (error) {
    return '';
  }
}

export default function ScenarioList({
  scenarios,
  loading,
  selectedScenarioId,
  onSelect,
  onCreate,
  onEdit,
  onDuplicate,
  onArchive,
  onDelete,
}: ScenarioListProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-alt/70 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text">Skenario</h2>
          <p className="text-xs text-muted">Kelola semua simulasi untuk bulan ini.</p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex h-9 items-center gap-1 rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-text transition hover:border-accent/60 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
          Baru
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="animate-pulse rounded-xl border border-border/60 bg-surface/60 p-3">
              <div className="h-4 w-32 rounded bg-border" />
              <div className="mt-2 h-3 w-20 rounded bg-border" />
            </div>
          ))}
        </div>
      ) : scenarios.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-surface/60 p-4 text-center text-xs text-muted">
          Belum ada skenario. Klik "Baru" untuk membuat.
        </div>
      ) : (
        <ul className="space-y-3">
          {scenarios.map((scenario) => {
            const active = scenario.id === selectedScenarioId;
            const status = scenario.status ?? 'draft';
            return (
              <li key={scenario.id}>
                <button
                  type="button"
                  onClick={() => onSelect(scenario)}
                  className={clsx(
                    'w-full rounded-xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
                    active
                      ? 'border-accent/50 bg-accent/10 shadow'
                      : 'border-border/60 bg-surface/70 hover:border-accent/40 hover:bg-accent/5'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-semibold text-text">{scenario.name}</div>
                    <span
                      className={clsx(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        STATUS_CLASS[status] ?? 'bg-muted/20 text-muted'
                      )}
                    >
                      {STATUS_LABEL[status] ?? status}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-muted">
                    <CalendarCheck2 className="h-3 w-3" aria-hidden="true" />
                    {formatDate(scenario.updated_at)}
                  </div>
                </button>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => onEdit(scenario)}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-border/60 bg-surface px-2 py-1 font-semibold text-muted transition hover:border-accent/50 hover:text-text"
                  >
                    <PenLine className="h-3 w-3" aria-hidden="true" />
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => onDuplicate(scenario)}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-border/60 bg-surface px-2 py-1 font-semibold text-muted transition hover:border-accent/50 hover:text-text"
                  >
                    <Copy className="h-3 w-3" aria-hidden="true" />
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => onArchive(scenario)}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-border/60 bg-surface px-2 py-1 font-semibold text-muted transition hover:border-accent/50 hover:text-text"
                  >
                    <Archive className="h-3 w-3" aria-hidden="true" />
                    Archive
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(scenario)}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-border/60 bg-surface px-2 py-1 font-semibold text-muted transition hover:border-rose-400/70 hover:text-rose-400"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
