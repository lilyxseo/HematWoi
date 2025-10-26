import { useCallback, useEffect, useMemo, useState } from 'react';
import Page from '../../../layout/Page';
import PageHeader from '../../../layout/PageHeader';
import Section from '../../../layout/Section';
import { useToast } from '../../../context/ToastContext';
import {
  archiveScenario,
  applyScenario,
  buildSimulation,
  computeBaseline,
  createScenario,
  deleteScenario,
  duplicateScenario,
  listScenarioItems,
  listScenarios,
  type BaselineData,
  type BudgetSimItem,
  type BudgetSimScenario,
  type SimulationResult,
  type ScenarioItemInput,
  type ProjectionMode,
  updateScenario,
  upsertScenarioItem,
  deleteScenarioItem,
} from '../../../lib/simScenarioApi';
import ScenarioList from './components/ScenarioList';
import ScenarioFormDialog from './components/ScenarioFormDialog';
import BudgetSimulationEditor from './components/BudgetSimulationEditor';
import SimulationSummary from './components/SimulationSummary';
import RiskList from './components/RiskList';
import CSVExport from './components/CSVExport';

interface DraftItem {
  id?: string;
  categoryId: string;
  deltaMonthly: number;
  deltaWeekly: Record<string, number>;
}

const PROJECTION_OPTIONS: Array<{ value: ProjectionMode; label: string }> = [
  { value: 'linear-mtd', label: 'Linear MTD' },
  { value: 'trailing-weeks', label: 'Rata-rata 4 minggu' },
  { value: 'flat', label: 'Tetap' },
];

const EDITOR_TABS = [
  { value: 'monthly', label: 'Bulanan' },
  { value: 'weekly', label: 'Mingguan' },
] as const;

type EditorTab = (typeof EDITOR_TABS)[number]['value'];

function getCurrentPeriod(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = `${today.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function formatPeriodLabel(period: string): string {
  const [year, month] = period.split('-').map((value) => Number.parseInt(value, 10));
  if (!year || !month) return period;
  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));
}

function normalizeDeltaWeekly(source?: Record<string, number> | null): Record<string, number> {
  if (!source) return {};
  const next: Record<string, number> = {};
  for (const [key, value] of Object.entries(source)) {
    const parsed = Number.isFinite(value) ? value : 0;
    if (parsed !== 0) {
      next[key] = parsed;
    }
  }
  return next;
}

function isEmptyDraft(item: DraftItem): boolean {
  const monthlyZero = Math.abs(item.deltaMonthly) < 0.00001;
  const weeklyZero = Object.values(item.deltaWeekly).every((value) => Math.abs(value) < 0.00001);
  return monthlyZero && weeklyZero;
}

function periodToMonthStart(period: string): string {
  return period.length === 7 ? `${period}-01` : period;
}

export default function BudgetSimulationPage(): JSX.Element {
  const { addToast } = useToast();
  const [period, setPeriod] = useState<string>(getCurrentPeriod());
  const [scenarios, setScenarios] = useState<BudgetSimScenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<BaselineData | null>(null);
  const [loadingBaseline, setLoadingBaseline] = useState<boolean>(true);
  const [scenarioItems, setScenarioItems] = useState<Record<string, BudgetSimItem>>({});
  const [draftItems, setDraftItems] = useState<Record<string, DraftItem>>({});
  const [lockedCategories, setLockedCategories] = useState<Set<string>>(new Set());
  const [projectionMode, setProjectionMode] = useState<ProjectionMode>('linear-mtd');
  const [useWeeklyBudgets, setUseWeeklyBudgets] = useState<boolean>(false);
  const [editorTab, setEditorTab] = useState<EditorTab>('monthly');
  const [creating, setCreating] = useState<boolean>(false);
  const [showScenarioDialog, setShowScenarioDialog] = useState<boolean>(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'rename'>('create');
  const [dialogScenario, setDialogScenario] = useState<BudgetSimScenario | null>(null);
  const [savingDraft, setSavingDraft] = useState<boolean>(false);
  const [applying, setApplying] = useState<boolean>(false);
  const [dirty, setDirty] = useState<boolean>(false);
  const [loadingScenarios, setLoadingScenarios] = useState<boolean>(true);

  const selectedScenario = useMemo(() => {
    if (!selectedScenarioId) return null;
    return scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? null;
  }, [selectedScenarioId, scenarios]);

  const simulation: SimulationResult | null = useMemo(() => {
    if (!baseline) return null;
    const items = Object.values(draftItems).map((item) => ({
      category_id: item.categoryId,
      delta_monthly: item.deltaMonthly,
      delta_weekly: item.deltaWeekly,
    }));
    return buildSimulation({
      baseline,
      items,
      useWeeklyBudgets,
      projectionMode,
      lockedCategoryIds: Array.from(lockedCategories),
    });
  }, [baseline, draftItems, useWeeklyBudgets, projectionMode, lockedCategories]);

  const refreshScenarios = useCallback(async () => {
    setLoadingScenarios(true);
    try {
      const periodMonth = periodToMonthStart(period);
      const rows = await listScenarios({ period_month: periodMonth });
      setScenarios(rows);
      if (rows.length > 0) {
        setSelectedScenarioId((current) => {
          if (current && rows.some((row) => row.id === current)) {
            return current;
          }
          return rows[0]?.id ?? null;
        });
      } else {
        setSelectedScenarioId(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memuat skenario';
      addToast(message, 'error');
    } finally {
      setLoadingScenarios(false);
    }
  }, [period, addToast]);

  const refreshBaseline = useCallback(async () => {
    setLoadingBaseline(true);
    try {
      const data = await computeBaseline(period);
      setBaseline(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memuat baseline';
      addToast(message, 'error');
      setBaseline(null);
    } finally {
      setLoadingBaseline(false);
    }
  }, [period, addToast]);

  const loadScenarioItems = useCallback(
    async (scenarioId: string) => {
      try {
        const items = await listScenarioItems(scenarioId);
        const itemMap: Record<string, BudgetSimItem> = {};
        const drafts: Record<string, DraftItem> = {};
        for (const item of items) {
          itemMap[item.category_id] = item;
          drafts[item.category_id] = {
            id: item.id,
            categoryId: item.category_id,
            deltaMonthly: Number.isFinite(item.delta_monthly) ? item.delta_monthly : 0,
            deltaWeekly: normalizeDeltaWeekly(item.delta_weekly),
          };
        }
        setScenarioItems(itemMap);
        setDraftItems(drafts);
        setDirty(false);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gagal memuat detail skenario';
        addToast(message, 'error');
        setScenarioItems({});
        setDraftItems({});
      }
    },
    [addToast]
  );

  useEffect(() => {
    refreshScenarios();
  }, [refreshScenarios]);

  useEffect(() => {
    refreshBaseline();
  }, [refreshBaseline]);

  useEffect(() => {
    setLockedCategories(new Set());
    if (selectedScenarioId) {
      loadScenarioItems(selectedScenarioId);
    } else {
      setScenarioItems({});
      setDraftItems({});
    }
  }, [selectedScenarioId, loadScenarioItems]);

  const handleCreateScenario = async (name: string) => {
    try {
      setCreating(true);
      const scenario = await createScenario({ name, period_month: periodToMonthStart(period) });
      addToast('Skenario dibuat', 'success');
      setShowScenarioDialog(false);
      await refreshScenarios();
      setSelectedScenarioId(scenario.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal membuat skenario';
      addToast(message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleRenameScenario = async (name: string) => {
    if (!dialogScenario) return;
    try {
      setCreating(true);
      await updateScenario(dialogScenario.id, { name });
      addToast('Nama skenario diperbarui', 'success');
      setShowScenarioDialog(false);
      await refreshScenarios();
      setSelectedScenarioId(dialogScenario.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memperbarui skenario';
      addToast(message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDuplicateScenario = useCallback(
    async (scenarioId: string) => {
      try {
        await duplicateScenario(scenarioId);
        addToast('Skenario disalin', 'success');
        await refreshScenarios();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gagal menduplikasi skenario';
        addToast(message, 'error');
      }
    },
    [addToast, refreshScenarios]
  );

  const handleArchiveScenario = useCallback(
    async (scenarioId: string) => {
      try {
        await archiveScenario(scenarioId);
        addToast('Skenario diarsipkan', 'success');
        await refreshScenarios();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gagal mengarsipkan skenario';
        addToast(message, 'error');
      }
    },
    [addToast, refreshScenarios]
  );

  const handleDeleteScenario = useCallback(
    async (scenarioId: string) => {
      if (!window.confirm('Hapus skenario ini? Tindakan tidak dapat dibatalkan.')) {
        return;
      }
      try {
        await deleteScenario(scenarioId);
        addToast('Skenario dihapus', 'success');
        await refreshScenarios();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gagal menghapus skenario';
        addToast(message, 'error');
      }
    },
    [addToast, refreshScenarios]
  );

  const handleDraftChange = useCallback((categoryId: string, delta: { monthly?: number; weekly?: Record<string, number> }) => {
    setDraftItems((prev) => {
      const current = prev[categoryId] ?? {
        id: scenarioItems[categoryId]?.id,
        categoryId,
        deltaMonthly: 0,
        deltaWeekly: {},
      };
      const nextMonthly = Number.isFinite(delta.monthly ?? current.deltaMonthly)
        ? delta.monthly ?? current.deltaMonthly
        : 0;
      const nextWeekly = delta.weekly ?? current.deltaWeekly;
      const next: DraftItem = {
        ...current,
        deltaMonthly: nextMonthly,
        deltaWeekly: normalizeDeltaWeekly(nextWeekly),
      };
      if (isEmptyDraft(next)) {
        const { [categoryId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [categoryId]: next };
    });
    setDirty(true);
  }, [scenarioItems]);

  const handleToggleLock = useCallback((categoryId: string) => {
    setLockedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setDraftItems({});
    setLockedCategories(new Set());
    setDirty(true);
  }, []);

  const handleSaveDraft = useCallback(async () => {
    if (!selectedScenario) return;
    setSavingDraft(true);
    try {
      const updates: Promise<unknown>[] = [];
      const payloads: Record<string, DraftItem> = draftItems;
      const existingIds = new Set(Object.keys(scenarioItems));

      for (const draft of Object.values(payloads)) {
        if (isEmptyDraft(draft)) continue;
        const input: ScenarioItemInput = {
          scenario_id: selectedScenario.id,
          category_id: draft.categoryId,
          delta_monthly: draft.deltaMonthly,
          delta_weekly: draft.deltaWeekly,
        };
        updates.push(
          upsertScenarioItem(input).then((item) => {
            setScenarioItems((prev) => ({ ...prev, [item.category_id]: item }));
          })
        );
        existingIds.delete(draft.categoryId);
      }

      for (const categoryId of existingIds) {
        const item = scenarioItems[categoryId];
        if (item) {
          updates.push(
            deleteScenarioItem(item.id).then(() => {
              setScenarioItems((prev) => {
                const next = { ...prev };
                delete next[categoryId];
                return next;
              });
            })
          );
        }
      }

      await Promise.all(updates);
      setDirty(false);
      addToast('Skenario disimpan sebagai draft', 'success');
      if (selectedScenario.status === 'applied') {
        await updateScenario(selectedScenario.id, { status: 'draft' });
        await refreshScenarios();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menyimpan draft';
      addToast(message, 'error');
    } finally {
      setSavingDraft(false);
    }
  }, [selectedScenario, draftItems, scenarioItems, addToast, refreshScenarios]);

  const handleApply = useCallback(async () => {
    if (!selectedScenario) return;
    if (!window.confirm('Terapkan perubahan ke anggaran asli?')) {
      return;
    }
    setApplying(true);
    try {
      await handleSaveDraft();
      const result = await applyScenario({ scenarioId: selectedScenario.id, periodMonth: periodToMonthStart(period) });
      addToast(
        `Anggaran diperbarui (${result.updatedMonthly} bulanan, ${result.updatedWeekly} mingguan)`,
        'success'
      );
      await refreshBaseline();
      await refreshScenarios();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menerapkan skenario';
      addToast(message, 'error');
    } finally {
      setApplying(false);
    }
  }, [selectedScenario, handleSaveDraft, addToast, refreshBaseline, refreshScenarios, period]);

  const handleSelectScenario = (scenarioId: string) => {
    setSelectedScenarioId(scenarioId);
  };

  const emptyState = !loadingScenarios && scenarios.length === 0;

  return (
    <Page maxWidthClassName="max-w-[1480px]" paddingClassName="px-3 md:px-6">
      <PageHeader
        title="Simulasi Anggaran"
        description="Eksplorasi skenario anggaran tanpa mengubah data asli."
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-sm font-medium text-muted">
            Bulan
            <input
              type="month"
              className="h-10 rounded-xl border border-border bg-surface px-3 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
              value={period}
              onChange={(event) => {
                setPeriod(event.target.value);
              }}
            />
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted">Proyeksi</span>
            <div className="flex rounded-2xl border border-border/60 bg-surface p-1">
              {PROJECTION_OPTIONS.map((option) => {
                const active = option.value === projectionMode;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setProjectionMode(option.value)}
                    className={`inline-flex items-center rounded-2xl px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] ${
                      active
                        ? 'bg-[color:var(--accent)] text-white shadow'
                        : 'text-muted hover:text-text'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-muted">
            <input
              type="checkbox"
              checked={useWeeklyBudgets}
              onChange={(event) => setUseWeeklyBudgets(event.target.checked)}
              className="h-4 w-4 rounded border-border text-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
            />
            Gunakan alokasi mingguan
          </label>
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[340px,1fr]">
        <aside className="flex flex-col gap-4 rounded-3xl border border-border/60 bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-text">Skenario</h2>
              <p className="text-xs text-muted">Periode {formatPeriodLabel(period)}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDialogMode('create');
                setDialogScenario(null);
                setShowScenarioDialog(true);
              }}
              className="inline-flex h-9 items-center rounded-2xl border border-dashed border-[color:var(--accent)] px-3 text-xs font-semibold text-[color:var(--accent)] transition hover:bg-[color:var(--accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
            >
              Buat Skenario
            </button>
          </div>
          <ScenarioList
            scenarios={scenarios}
            loading={loadingScenarios}
            activeId={selectedScenarioId}
            onSelect={handleSelectScenario}
            onRename={(scenario) => {
              setDialogMode('rename');
              setDialogScenario(scenario);
              setShowScenarioDialog(true);
            }}
            onDuplicate={handleDuplicateScenario}
            onArchive={handleArchiveScenario}
            onDelete={handleDeleteScenario}
          />
        </aside>

        <main className="flex flex-col gap-6">
          {emptyState ? (
            <Section first className="flex flex-1 flex-col items-center justify-center gap-6 rounded-3xl border border-border/60 bg-surface p-10 text-center shadow-sm">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[color:var(--accent)]/10 text-4xl">💡</div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-text">Mulai Simulasi</h2>
                <p className="text-sm text-muted">
                  Buat skenario untuk melihat dampak perubahan anggaran tanpa menyentuh data asli.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDialogMode('create');
                  setDialogScenario(null);
                  setShowScenarioDialog(true);
                }}
                className="inline-flex h-11 items-center rounded-2xl bg-[color:var(--accent)] px-6 text-sm font-semibold text-white shadow transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/60"
              >
                Buat skenario pertama
              </button>
            </Section>
          ) : (
            <>
              <Section first className="rounded-3xl border border-border/60 bg-surface shadow-sm">
                <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                  <div className="flex items-center gap-2">
                    {EDITOR_TABS.map((tab) => {
                      const active = tab.value === editorTab;
                      return (
                        <button
                          key={tab.value}
                          type="button"
                          onClick={() => setEditorTab(tab.value)}
                          className={`inline-flex items-center rounded-2xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] ${
                            active
                              ? 'bg-[color:var(--accent)] text-white shadow'
                              : 'text-muted hover:text-text'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="inline-flex h-10 items-center rounded-2xl border border-border px-4 text-sm font-semibold text-text transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <BudgetSimulationEditor
                  loading={loadingBaseline}
                  baseline={baseline}
                  draftItems={draftItems}
                  lockedCategoryIds={lockedCategories}
                  mode={editorTab}
                  useWeeklyBudgets={useWeeklyBudgets}
                  onChange={handleDraftChange}
                  onToggleLock={handleToggleLock}
                  simulation={simulation}
                />
              </Section>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
                <Section className="rounded-3xl border border-border/60 bg-surface shadow-sm">
                  <SimulationSummary
                    loading={loadingBaseline}
                    scenarioName={selectedScenario?.name ?? ''}
                    summary={simulation?.summary ?? null}
                    useWeeklyBudgets={useWeeklyBudgets}
                  />
                </Section>
                <Section className="rounded-3xl border border-border/60 bg-surface shadow-sm">
                  <RiskList loading={loadingBaseline} risks={simulation?.risks ?? []} />
                </Section>
              </div>

              <Section className="rounded-3xl border border-border/60 bg-surface p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="text-sm text-muted">
                    Simpan sebagai draft untuk menjaga perubahan tetap terpisah dari anggaran asli.
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <CSVExport
                      disabled={!simulation || loadingBaseline}
                      fileName={`simulasi-anggaran-${period}.csv`}
                      simulation={simulation}
                    />
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      disabled={!selectedScenario || savingDraft || !dirty}
                      className="inline-flex h-11 items-center rounded-2xl border border-[color:var(--accent)] px-5 text-sm font-semibold text-[color:var(--accent)] transition hover:bg-[color:var(--accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingDraft ? 'Menyimpan…' : 'Simpan Draft'}
                    </button>
                    <button
                      type="button"
                      onClick={handleApply}
                      disabled={!selectedScenario || applying}
                      className="inline-flex h-11 items-center rounded-2xl bg-[color:var(--accent)] px-6 text-sm font-semibold text-white shadow transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {applying ? 'Menerapkan…' : 'Terapkan ke Anggaran'}
                    </button>
                  </div>
                </div>
              </Section>
            </>
          )}
        </main>
      </div>

      <ScenarioFormDialog
        open={showScenarioDialog}
        loading={creating}
        mode={dialogMode}
        scenario={dialogScenario}
        onClose={() => setShowScenarioDialog(false)}
        onSubmit={(name) => {
          if (dialogMode === 'create') {
            return handleCreateScenario(name);
          }
          return handleRenameScenario(name);
        }}
      />
    </Page>
  );
}

