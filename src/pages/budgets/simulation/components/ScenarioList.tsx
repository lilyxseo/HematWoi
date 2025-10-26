import type { BudgetSimScenario } from '../../../../lib/simScenarioApi';

interface ScenarioListProps {
  scenarios: BudgetSimScenario[];
  loading: boolean;
  activeId: string | null;
  onSelect: (scenarioId: string) => void;
  onRename: (scenario: BudgetSimScenario) => void;
  onDuplicate: (scenarioId: string) => void;
  onArchive: (scenarioId: string) => void;
  onDelete: (scenarioId: string) => void;
}

function formatStatus(status: BudgetSimScenario['status']): { label: string; className: string } {
  switch (status) {
    case 'applied':
      return { label: 'Applied', className: 'bg-emerald-500/10 text-emerald-400' };
    case 'archived':
      return { label: 'Archived', className: 'bg-border/60 text-muted' };
    case 'draft':
    default:
      return { label: 'Draft', className: 'bg-[color:var(--accent)]/10 text-[color:var(--accent)]' };
  }
}

export default function ScenarioList({
  scenarios,
  loading,
  activeId,
  onSelect,
  onRename,
  onDuplicate,
  onArchive,
  onDelete,
}: ScenarioListProps): JSX.Element {
  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-14 animate-pulse rounded-2xl bg-border/40" />
        ))}
      </div>
    );
  }

  if (scenarios.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-surface/40 p-6 text-center text-sm text-muted">
        Belum ada skenario untuk periode ini.
      </div>
    );
  }

  return (
    <ul className="space-y-3" aria-label="Daftar skenario">
      {scenarios.map((scenario) => {
        const active = scenario.id === activeId;
        const status = formatStatus(scenario.status);
        return (
          <li key={scenario.id}>
            <div
              className={`group relative rounded-2xl border px-4 py-3 shadow-sm transition focus-within:ring-2 focus-within:ring-[color:var(--accent)] ${
                active
                  ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10'
                  : 'border-border/60 bg-surface hover:border-[color:var(--accent)]/60'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(scenario.id)}
                className="flex w-full items-center justify-between gap-3 text-left focus-visible:outline-none"
                aria-label={`Pilih skenario ${scenario.name}`}
              >
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-text">{scenario.name}</span>
                  <span className="text-xs text-muted">
                    {new Date(scenario.updated_at).toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </span>
                </div>
                <span
                  className={`inline-flex h-6 items-center rounded-full px-2 text-[11px] font-semibold ${status.className}`}
                >
                  {status.label}
                </span>
              </button>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-muted">
                <button
                  type="button"
                  onClick={() => onRename(scenario)}
                  className="rounded-full border border-border px-3 py-1 transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
                  aria-label={`Ubah nama skenario ${scenario.name}`}
                >
                  Ganti nama
                </button>
                <button
                  type="button"
                  onClick={() => onDuplicate(scenario.id)}
                  className="rounded-full border border-border px-3 py-1 transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
                  aria-label={`Duplikat skenario ${scenario.name}`}
                >
                  Duplikat
                </button>
                {scenario.status !== 'archived' ? (
                  <button
                    type="button"
                    onClick={() => onArchive(scenario.id)}
                    className="rounded-full border border-border px-3 py-1 transition hover:border-amber-500 hover:text-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
                    aria-label={`Arsipkan skenario ${scenario.name}`}
                  >
                    Arsipkan
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onDelete(scenario.id)}
                  className="rounded-full border border-rose-500/40 px-3 py-1 text-rose-400 transition hover:border-rose-500 hover:text-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60"
                  aria-label={`Hapus skenario ${scenario.name}`}
                >
                  Hapus
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

