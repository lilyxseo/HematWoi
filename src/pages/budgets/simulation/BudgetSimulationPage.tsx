import { Fragment, useEffect, useMemo, useState } from 'react';
import { CalendarRange, FileDown } from 'lucide-react';
import Page from '../../../layout/Page';
import Section from '../../../layout/Section';
import PageHeader from '../../../layout/PageHeader';
import { useToast } from '../../../context/ToastContext';
import {
  applyScenario,
  archiveScenario,
  computeBaseline,
  createScenario,
  deleteScenario,
  duplicateScenario,
  listScenarioItems,
  listScenarios,
  syncScenarioItems,
  updateScenario,
  type BudgetSimulationScenario,
} from '../../../lib/simScenarioApi';
import {
  calculateSimulation,
  sanitizeDraftItem,
  isDraftItemEmpty,
  formatMonthLabel,
  type BaselineDataset,
  type SimulationDraftItem,
  type SimulationResult,
  type ProjectionMode,
} from '../../../lib/simMath';
import ScenarioList from './components/ScenarioList';
import ScenarioFormDialog, { type ScenarioFormValues } from './components/ScenarioFormDialog';
import BudgetSimulationEditor from './components/BudgetSimulationEditor';
import SimulationSummary from './components/SimulationSummary';
import RiskList from './components/RiskList';
import CSVExport from './components/CSVExport';

const VIEW_TABS = [
  { value: 'monthly', label: 'Bulanan' },
  { value: 'weekly', label: 'Mingguan' },
] as const;

type ViewTabValue = (typeof VIEW_TABS)[number]['value'];

type DraftMap = Record<string, SimulationDraftItem>;

function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function toMonthStart(period: string): string {
  if (!period) return period;
  const [year, month] = period.split('-');
  if (!year || !month) return period;
  return `${year}-${month}-01`;
}

function toHumanReadable(period: string): string {
  try {
    return formatMonthLabel(`${period}-01`);
  } catch (error) {
    return period;
  }
}

export default function BudgetSimulationPage() {
  const { addToast } = useToast();
  const [period, setPeriod] = useState<string>(getCurrentPeriod());
  const [view, setView] = useState<ViewTabValue>('monthly');
  const [projectionMode, setProjectionMode] = useState<ProjectionMode>('linear-mtd');
  const [includeWeekly, setIncludeWeekly] = useState<boolean>(true);
  const [scenarios, setScenarios] = useState<BudgetSimulationScenario[]>([]);
  const [loadingScenarios, setLoadingScenarios] = useState<boolean>(true);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<BaselineDataset | null>(null);
  const [baselineLoading, setBaselineLoading] = useState<boolean>(true);
  const [baselineError, setBaselineError] = useState<string | null>(null);
  const [draftItems, setDraftItems] = useState<DraftMap>({});
  const [lockedCategoryIds, setLockedCategoryIds] = useState<Set<string>>(new Set());
  const [scenarioModalOpen, setScenarioModalOpen] = useState<boolean>(false);
  const [scenarioEditing, setScenarioEditing] = useState<BudgetSimulationScenario | null>(null);
  const [savingDraft, setSavingDraft] = useState<boolean>(false);
  const [applying, setApplying] = useState<boolean>(false);
  const [showProjectionHelp, setShowProjectionHelp] = useState<boolean>(false);

  useEffect(() => {
    setBaselineLoading(true);
    setBaselineError(null);
    computeBaseline(period)
      .then((data) => setBaseline(data))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Gagal memuat baseline anggaran.';
        setBaselineError(message);
      })
      .finally(() => setBaselineLoading(false));
  }, [period]);

  useEffect(() => {
    setLoadingScenarios(true);
    listScenarios({ period_month: toMonthStart(period) })
      .then((data) => {
        setScenarios(data);
        if (!selectedScenarioId && data.length > 0) {
          setSelectedScenarioId(data[0].id);
        }
        if (selectedScenarioId && !data.find((scenario) => scenario.id === selectedScenarioId)) {
          setSelectedScenarioId(data[0]?.id ?? null);
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Gagal memuat skenario.';
        addToast(message, 'error');
        setScenarios([]);
      })
      .finally(() => setLoadingScenarios(false));
  }, [period, selectedScenarioId, addToast]);

  useEffect(() => {
    if (!selectedScenarioId) {
      setDraftItems({});
      return;
    }
    listScenarioItems(selectedScenarioId)
      .then((items) => {
        const map: DraftMap = {};
        for (const item of items) {
          map[item.category_id] = sanitizeDraftItem({
            deltaMonthly: Number(item.delta_monthly ?? 0),
            deltaWeekly: item.delta_weekly ?? {},
          });
        }
        setDraftItems(map);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Gagal memuat detail skenario.';
        addToast(message, 'error');
        setDraftItems({});
      });
  }, [selectedScenarioId, addToast]);

  useEffect(() => {
    setLockedCategoryIds(new Set());
  }, [selectedScenarioId]);

  const simulationResult: SimulationResult | null = useMemo(() => {
    if (!baseline) return null;
    return calculateSimulation({
      baseline,
      items: draftItems,
      includeWeekly,
      lockedCategoryIds,
      projectionMode,
    });
  }, [baseline, draftItems, includeWeekly, lockedCategoryIds, projectionMode]);

  const handleSelectScenario = (scenario: BudgetSimulationScenario | null) => {
    setSelectedScenarioId(scenario?.id ?? null);
    setLockedCategoryIds(new Set());
  };

  const handleCreateScenario = () => {
    setScenarioEditing(null);
    setScenarioModalOpen(true);
  };

  const handleEditScenario = (scenario: BudgetSimulationScenario) => {
    setScenarioEditing(scenario);
    setScenarioModalOpen(true);
  };

  const handleScenarioSubmit = async (values: ScenarioFormValues) => {
    if (scenarioEditing) {
      try {
        const updated = await updateScenario(scenarioEditing.id, {
          name: values.name,
          notes: values.notes,
        });
        setScenarios((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        addToast('Nama skenario diperbarui.', 'success');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gagal memperbarui skenario.';
        addToast(message, 'error');
      } finally {
        setScenarioModalOpen(false);
        setScenarioEditing(null);
      }
      return;
    }
    try {
      const scenario = await createScenario({
        name: values.name,
        period_month: toMonthStart(period),
        notes: values.notes,
      });
      setScenarios((prev) => [...prev, scenario]);
      setSelectedScenarioId(scenario.id);
      addToast('Skenario baru dibuat.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal membuat skenario.';
      addToast(message, 'error');
    } finally {
      setScenarioModalOpen(false);
      setScenarioEditing(null);
    }
  };

  const handleDuplicate = async (scenario: BudgetSimulationScenario) => {
    try {
      const cloned = await duplicateScenario(scenario.id);
      setScenarios((prev) => [...prev, cloned]);
      setSelectedScenarioId(cloned.id);
      addToast('Skenario berhasil disalin.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menyalin skenario.';
      addToast(message, 'error');
    }
  };

  const handleArchive = async (scenario: BudgetSimulationScenario) => {
    if (!window.confirm(`Arsipkan skenario "${scenario.name}"?`)) return;
    try {
      const archived = await archiveScenario(scenario.id);
      setScenarios((prev) => prev.filter((item) => item.id !== archived.id));
      if (selectedScenarioId === archived.id) {
        setSelectedScenarioId(null);
      }
      addToast('Skenario diarsipkan.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengarsipkan skenario.';
      addToast(message, 'error');
    }
  };

  const handleDelete = async (scenario: BudgetSimulationScenario) => {
    if (!window.confirm(`Hapus skenario "${scenario.name}"?`)) return;
    try {
      await deleteScenario(scenario.id);
      setScenarios((prev) => prev.filter((item) => item.id !== scenario.id));
      if (selectedScenarioId === scenario.id) {
        setSelectedScenarioId(null);
      }
      addToast('Skenario dihapus.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menghapus skenario.';
      addToast(message, 'error');
    }
  };

  const handleMonthlyChange = (categoryId: string, value: number) => {
    setDraftItems((prev) => {
      const next = { ...prev };
      const current = sanitizeDraftItem(prev[categoryId]);
      current.deltaMonthly = value;
      if (isDraftItemEmpty(current)) {
        delete next[categoryId];
      } else {
        next[categoryId] = current;
      }
      return next;
    });
  };

  const handleWeeklyChange = (categoryId: string, weekStart: string, value: number) => {
    setDraftItems((prev) => {
      const next = { ...prev };
      const current = sanitizeDraftItem(prev[categoryId]);
      current.deltaWeekly[weekStart] = value;
      if (isDraftItemEmpty(current)) {
        delete next[categoryId];
      } else {
        next[categoryId] = current;
      }
      return next;
    });
  };

  const handleResetCategory = (categoryId: string) => {
    setDraftItems((prev) => {
      const next = { ...prev };
      delete next[categoryId];
      return next;
    });
    setLockedCategoryIds((prev) => {
      const next = new Set(prev);
      next.delete(categoryId);
      return next;
    });
  };

  const handleToggleLock = (categoryId: string) => {
    setLockedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleQuickAdjust = (categoryId: string, percent: number, baselineValue: number) => {
    const adjustment = Math.round(baselineValue * percent * 100) / 100;
    const current = draftItems[categoryId]?.deltaMonthly ?? 0;
    handleMonthlyChange(categoryId, Math.round((current + adjustment) * 100) / 100);
  };

  const handleResetAll = () => {
    if (!window.confirm('Reset semua penyesuaian ke baseline?')) return;
    setDraftItems({});
    setLockedCategoryIds(new Set());
  };

  const handleSaveDraft = async () => {
    if (!selectedScenarioId) {
      addToast('Pilih skenario terlebih dahulu.', 'warning');
      return;
    }
    setSavingDraft(true);
    try {
      const result = await syncScenarioItems(selectedScenarioId, draftItems);
      addToast(`Draft tersimpan (${result.upserted} kategori diperbarui).`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menyimpan skenario.';
      addToast(message, 'error');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleApply = async () => {
    if (!selectedScenarioId) {
      addToast('Pilih skenario yang ingin diterapkan.', 'warning');
      return;
    }
    if (!window.confirm('Terapkan skenario ini ke anggaran sebenarnya?')) return;
    setApplying(true);
    try {
      await syncScenarioItems(selectedScenarioId, draftItems);
      const result = await applyScenario(selectedScenarioId, {
        includeWeekly,
        projectionMode,
        lockedCategoryIds,
      });
      setScenarios((prev) =>
        prev.map((item) =>
          item.id === selectedScenarioId ? { ...item, status: 'applied', updated_at: new Date().toISOString() } : item
        )
      );
      addToast(
        `Perubahan diterapkan. ${result.updatedMonthly} anggaran bulanan & ${result.updatedWeekly} mingguan diperbarui.`,
        'success'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menerapkan skenario.';
      addToast(message, 'error');
    } finally {
      setApplying(false);
    }
  };

  const scenarioSelected = scenarios.find((item) => item.id === selectedScenarioId) ?? null;
  const emptyState = !loadingScenarios && scenarios.length === 0;

  return (
    <Page>
      <PageHeader
        title="Simulasi Anggaran"
        description="Buat skenario what-if untuk mengevaluasi dampak perubahan anggaran tanpa mengubah data asli."
      >
        <button
          type="button"
          onClick={handleCreateScenario}
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-border bg-surface px-5 text-sm font-semibold text-text shadow transition hover:border-accent/60 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          Buat Skenario
        </button>
      </PageHeader>

      <Section first>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex w-full items-center gap-2 rounded-xl border border-border/60 bg-surface/80 px-3 py-2 text-sm text-text shadow-inner focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/40 md:w-auto">
            <CalendarRange className="h-4 w-4 text-muted" aria-hidden="true" />
            <input
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="w-full appearance-none bg-transparent text-sm font-medium text-text outline-none"
              aria-label="Pilih bulan simulasi"
            />
            <span className="hidden text-xs text-muted md:inline">{toHumanReadable(period)}</span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="grid h-10 grid-cols-2 overflow-hidden rounded-xl border border-border/70 bg-surface/90 shadow-inner">
              {VIEW_TABS.map(({ value, label }) => {
                const active = view === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setView(value)}
                    className={`font-semibold transition ${
                      active
                        ? 'bg-accent text-accent-foreground shadow'
                        : 'text-muted hover:text-text'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-border/60 bg-surface/90 px-3 text-sm text-text shadow-inner">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border-subtle text-accent focus:ring-accent"
                checked={includeWeekly}
                onChange={(event) => setIncludeWeekly(event.target.checked)}
              />
              Gunakan anggaran mingguan
            </label>
          </div>
        </div>
      </Section>

      <Section>
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-4">
            <ScenarioList
              scenarios={scenarios}
              loading={loadingScenarios}
              selectedScenarioId={selectedScenarioId}
              onSelect={handleSelectScenario}
              onCreate={handleCreateScenario}
              onEdit={handleEditScenario}
              onDuplicate={handleDuplicate}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
            <div className="rounded-2xl border border-border-subtle bg-surface-alt/70 p-4 text-sm text-muted">
              Simpan draft untuk menjaga skenario, atau terapkan setelah yakin. Semua perubahan hanya mempengaruhi anggaran asli saat Anda menekan "Terapkan".
            </div>
          </aside>

          <main className="flex flex-col gap-6">
            {baselineLoading ? (
              <div className="rounded-2xl border border-border-subtle bg-surface-alt/60 p-6">
                <div className="h-6 w-32 animate-pulse rounded bg-border" />
                <div className="mt-4 space-y-2">
                  <div className="h-4 w-full animate-pulse rounded bg-border" />
                  <div className="h-4 w-11/12 animate-pulse rounded bg-border" />
                  <div className="h-4 w-8/12 animate-pulse rounded bg-border" />
                </div>
              </div>
            ) : baselineError ? (
              <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
                {baselineError}
              </div>
            ) : emptyState ? (
              <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/60 bg-surface-alt/60 p-10 text-center">
                <p className="text-base font-semibold text-text">Belum ada skenario simulasi</p>
                <p className="max-w-md text-sm text-muted">
                  Buat skenario pertama untuk mulai bermain dengan penyesuaian anggaran tanpa mengubah data asli.
                </p>
                <button
                  type="button"
                  onClick={handleCreateScenario}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-accent px-5 text-sm font-semibold text-accent-foreground shadow hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  Buat skenario pertama
                </button>
              </div>
            ) : !scenarioSelected ? (
              <div className="rounded-2xl border border-border-subtle bg-surface-alt/70 p-8 text-center text-sm text-muted">
                Pilih atau buat skenario untuk mulai mengedit simulasi.
              </div>
            ) : (
              <Fragment>
                <SimulationSummary
                  scenario={scenarioSelected}
                  simulation={simulationResult}
                  includeWeekly={includeWeekly}
                  projectionMode={projectionMode}
                  showProjectionHelp={showProjectionHelp}
                  onProjectionChange={setProjectionMode}
                  onToggleProjectionHelp={() => setShowProjectionHelp((prev) => !prev)}
                />

                <BudgetSimulationEditor
                  mode={view}
                  baseline={baseline}
                  simulation={simulationResult}
                  includeWeekly={includeWeekly}
                  draftItems={draftItems}
                  lockedCategoryIds={lockedCategoryIds}
                  onMonthlyChange={handleMonthlyChange}
                  onWeeklyChange={handleWeeklyChange}
                  onResetCategory={handleResetCategory}
                  onToggleLock={handleToggleLock}
                  onQuickAdjust={handleQuickAdjust}
                />

                <RiskList risks={simulationResult?.risks ?? []} />

                <div className="grid gap-3 rounded-2xl border border-border-subtle bg-surface-alt/70 p-5 text-sm text-text sm:grid-cols-2 lg:grid-cols-4">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={savingDraft}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-accent px-4 text-sm font-semibold text-accent-foreground shadow transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingDraft ? 'Menyimpan...' : 'Simpan Draft'}
                  </button>
                  <button
                    type="button"
                    onClick={handleApply}
                    disabled={applying}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-accent/40 bg-surface px-4 text-sm font-semibold text-text shadow transition hover:border-accent/70 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {applying ? 'Menerapkan...' : 'Terapkan ke Anggaran'}
                  </button>
                  <CSVExport
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border/70 bg-surface px-4 text-sm font-semibold text-text shadow transition hover:border-accent/60 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                    filename={`simulasi-anggaran-${period}.csv`}
                    simulation={simulationResult}
                  >
                    <FileDown className="h-4 w-4" aria-hidden="true" />
                    Export CSV
                  </CSVExport>
                  <button
                    type="button"
                    onClick={handleResetAll}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border/70 bg-surface px-4 text-sm font-semibold text-text shadow transition hover:border-rose-400/80 hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70"
                  >
                    Reset semua
                  </button>
                </div>
              </Fragment>
            )}
          </main>
        </div>
      </Section>

      <ScenarioFormDialog
        open={scenarioModalOpen}
        mode={scenarioEditing ? 'edit' : 'create'}
        defaultValues={{
          name: scenarioEditing?.name ?? '',
          notes: scenarioEditing?.notes ?? '',
        }}
        onClose={() => {
          setScenarioModalOpen(false);
          setScenarioEditing(null);
        }}
        onSubmit={handleScenarioSubmit}
      />
    </Page>
  );
}
