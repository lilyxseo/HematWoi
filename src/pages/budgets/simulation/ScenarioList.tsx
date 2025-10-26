import { Calendar, Copy, Edit3, FolderMinus, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import type { BudgetSimScenario } from '../../../lib/simScenarioApi';

interface ScenarioListProps {
  scenarios: BudgetSimScenario[];
  selectedId: string | null;
  onSelect: (scenario: BudgetSimScenario) => void;
  onCreate: () => void;
  onRename: (scenario: BudgetSimScenario) => void;
  onDuplicate: (scenario: BudgetSimScenario) => void;
  onArchive: (scenario: BudgetSimScenario) => void;
  onDelete: (scenario: BudgetSimScenario) => void;
  loading?: boolean;
  periodMonth: string;
  onChangePeriod: (value: string) => void;
}

function formatPeriodLabel(periodMonth: string): string {
  try {
    const date = new Date(periodMonth);
    return format(date, 'LLLL yyyy', { locale: id });
  } catch (error) {
    return periodMonth;
  }
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  applied: 'Diterapkan',
  archived: 'Arsip',
};

const STATUS_CLASS: Record<string, string> = {
  draft: 'bg-accent/10 text-accent',
  applied: 'bg-emerald-500/15 text-emerald-400',
  archived: 'bg-slate-500/20 text-slate-300',
};

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
  periodMonth,
  onChangePeriod,
}: ScenarioListProps) {
  const monthValue = periodMonth.slice(0, 7);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-text-subtle">
            <Calendar className="h-4 w-4" aria-hidden="true" />
            <span>{formatPeriodLabel(periodMonth)}</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary h-10 rounded-2xl px-3 text-sm"
            onClick={onCreate}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Buat Skenario
          </button>
        </div>
        <label className="flex items-center gap-2 text-xs text-text-subtle">
          <span className="font-medium uppercase tracking-wide">Bulan</span>
          <input
            type="month"
            className="input input-sm input-bordered w-full"
            value={monthValue}
            onChange={(event) => {
              if (!event.target.value) return;
              onChangePeriod(`${event.target.value}-01`);
            }}
            aria-label="Pilih bulan simulasi"
          />
        </label>
      </div>
      <div className="flex-1 overflow-auto rounded-2xl border border-border-subtle bg-surface shadow-inner">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-xl bg-surface-subtle" />
            ))}
          </div>
        ) : scenarios.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center text-sm text-text-subtle">
            <div className="text-4xl">💡</div>
            <p className="max-w-[16rem] text-pretty">
              Belum ada skenario untuk bulan ini. Mulai dengan menekan tombol &quot;Buat Skenario&quot;.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {scenarios.map((scenario) => {
              const active = scenario.id === selectedId;
              return (
                <li key={scenario.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(scenario)}
                    className={clsx(
                      'group flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition',
                      active ? 'bg-accent/10 text-text' : 'hover:bg-surface-subtle'
                    )}
                    aria-current={active ? 'true' : undefined}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{scenario.name}</p>
                      <p className="truncate text-xs text-text-subtle">
                        {formatPeriodLabel(scenario.period_month)} ·{' '}
                        <span
                          className={clsx(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide',
                            STATUS_CLASS[scenario.status] ?? STATUS_CLASS.draft
                          )}
                        >
                          {STATUS_LABEL[scenario.status] ?? scenario.status}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRename(scenario);
                        }}
                        aria-label={`Ubah nama ${scenario.name}`}
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDuplicate(scenario);
                        }}
                        aria-label={`Duplikasi ${scenario.name}`}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={(event) => {
                          event.stopPropagation();
                          onArchive(scenario);
                        }}
                        aria-label={`Arsipkan ${scenario.name}`}
                      >
                        <FolderMinus className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-rose-500 hover:bg-rose-500/10"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete(scenario);
                        }}
                        aria-label={`Hapus ${scenario.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
