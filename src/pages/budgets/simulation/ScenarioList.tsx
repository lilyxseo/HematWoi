import { useState } from 'react';
import {
  Archive,
  Copy,
  Edit2,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react';
import type { BudgetSimScenario } from '../../../lib/simScenarioApi';

type ScenarioListProps = {
  scenarios: BudgetSimScenario[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (scenario: BudgetSimScenario) => void;
  onDuplicate: (scenario: BudgetSimScenario) => void;
  onArchive: (scenario: BudgetSimScenario) => void;
  onDelete: (scenario: BudgetSimScenario) => void;
  loading?: boolean;
};

function StatusBadge({ status }: { status: BudgetSimScenario['status'] }) {
  const labels: Record<BudgetSimScenario['status'], string> = {
    draft: 'Draft',
    applied: 'Diterapkan',
    archived: 'Diarsipkan',
  };
  const colors: Record<BudgetSimScenario['status'], string> = {
    draft: 'bg-brand/10 text-brand',
    applied: 'bg-emerald-500/10 text-emerald-400',
    archived: 'bg-muted/10 text-muted',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${colors[status]}`}>
      {labels[status]}
    </span>
  );
}

export default function ScenarioList({
  scenarios,
  selectedId,
  onSelect,
  onCreate,
  onRename,
  onDuplicate,
  onArchive,
  onDelete,
  loading = false,
}: ScenarioListProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const handleMenuToggle = (id: string) => {
    setOpenMenu((prev) => (prev === id ? null : id));
  };

  const handleAction = (callback: () => void) => {
    callback();
    setOpenMenu(null);
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-text">Skenario</h2>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex h-10 items-center gap-2 rounded-2xl border border-dashed border-brand/40 px-4 text-sm font-semibold text-brand transition hover:border-brand hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <Plus className="h-4 w-4" />
          Buat Skenario
        </button>
      </div>
      <div className="flex-1 overflow-y-auto rounded-2xl border border-border/60 bg-surface/80 p-3 shadow-inner">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-xl bg-border/40" />
            ))}
          </div>
        ) : scenarios.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted">
            <span className="text-4xl">💡</span>
            <p className="max-w-[220px] leading-relaxed">
              Belum ada skenario. Mulai dengan membuat simulasi baru untuk bulan ini.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {scenarios.map((scenario) => {
              const active = scenario.id === selectedId;
              return (
                <li key={scenario.id}>
                  <div
                    className={`group relative flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition focus-within:ring-2 focus-within:ring-brand/40 ${
                      active
                        ? 'border-brand/60 bg-brand/10 text-brand'
                        : 'border-transparent bg-surface/60 text-text hover:border-border'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(scenario.id)}
                      className="flex flex-1 flex-col items-start gap-1 text-left focus-visible:outline-none"
                      aria-label={`Pilih skenario ${scenario.name}`}
                    >
                      <span className="text-sm font-semibold leading-tight">{scenario.name}</span>
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <StatusBadge status={scenario.status} />
                        <span>
                          Diperbarui{' '}
                          {new Intl.DateTimeFormat('id-ID', {
                            day: 'numeric',
                            month: 'short',
                          }).format(new Date(scenario.updated_at))}
                        </span>
                      </div>
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-border/60 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                        aria-haspopup="menu"
                        aria-expanded={openMenu === scenario.id}
                        onClick={() => handleMenuToggle(scenario.id)}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {openMenu === scenario.id ? (
                        <div
                          role="menu"
                          className="absolute right-0 top-10 z-20 w-44 rounded-xl border border-border/60 bg-surface shadow-lg"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text transition hover:bg-brand/10"
                            onClick={() => handleAction(() => onRename(scenario))}
                          >
                            <Edit2 className="h-4 w-4" /> Ganti nama
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text transition hover:bg-brand/10"
                            onClick={() => handleAction(() => onDuplicate(scenario))}
                          >
                            <Copy className="h-4 w-4" /> Duplikat
                          </button>
                          {scenario.status !== 'archived' ? (
                            <button
                              type="button"
                              role="menuitem"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text transition hover:bg-amber-500/10 hover:text-amber-500"
                              onClick={() => handleAction(() => onArchive(scenario))}
                            >
                              <Archive className="h-4 w-4" /> Arsipkan
                            </button>
                          ) : null}
                          <button
                            type="button"
                            role="menuitem"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-500 transition hover:bg-rose-500/10"
                            onClick={() => handleAction(() => onDelete(scenario))}
                          >
                            <Trash2 className="h-4 w-4" /> Hapus
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

