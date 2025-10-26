import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarRange,
  CalendarDays,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import Page from '../../layout/Page';
import PageHeader from '../../layout/PageHeader';
import Section from '../../layout/Section';
import { useToast } from '../../context/ToastContext';
import ScenarioList from './simulation/ScenarioList';
import ScenarioFormDialog from './simulation/ScenarioFormDialog';
import BudgetSimulationEditor from './simulation/BudgetSimulationEditor';
import SimulationSummary from './simulation/SimulationSummary';
import RiskList from './simulation/RiskList';
import CSVExport from './simulation/CSVExport';
import {
  applyScenario,
  archiveScenario,
  computeBaseline,
  createScenario,
  deleteScenario,
  duplicateScenario,
  listScenarioItems,
  listScenarios,
  removeScenarioItem,
  type BaselineData,
  type BudgetSimScenario,
  type BudgetSimScenarioItem,
  type ProjectionMethod,
  type SimulationResult,
  type SimulationTotals,
  type SimulationImpact,
  updateScenario,
  upsertScenarioItem,
} from '../../lib/simScenarioApi';
import { buildSimulation } from '../../lib/simMath';
import type { ScenarioItemDelta } from '../../lib/simMath';

interface AdjustmentValue {
  deltaMonthly: number;
  deltaWeekly: Record<string, number>;
  categoryName?: string;
  categoryType?: 'income' | 'expense' | null;
}

type EditorMode = 'monthly' | 'weekly';

type FormState =
  | { open: false; mode: null; scenario: null }
  | { open: true; mode: 'create'; scenario: null }
  | { open: true; mode: 'rename'; scenario: BudgetSimScenario };

function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function toMonthLabel(period: string): string {
  const [year, month] = period.split('-').map((value) => Number.parseInt(value, 10));
  if (!year || !month) return period;
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function mapItemsToAdjustments(items: BudgetSimScenarioItem[]): Map<string, AdjustmentValue> {
  const map = new Map<string, AdjustmentValue>();
  for (const item of items) {
    map.set(item.category_id, {
      deltaMonthly: Number(item.delta_monthly ?? 0),
      deltaWeekly: { ...(item.delta_weekly ?? {}) },
      categoryName: item.category?.name,
      categoryType: (item.category?.type as 'income' | 'expense' | null) ?? null,
    });
  }
  return map;
}

export default function BudgetSimulationPage() {
  const { addToast } = useToast();
  const [period, setPeriod] = useState<string>(getCurrentPeriod());
  const periodMonth = `${period}-01`;

  const [mode, setMode] = useState<EditorMode>('monthly');
  const [projectionMethod, setProjectionMethod] = useState<ProjectionMethod>('linear');
  const [includeWeekly, setIncludeWeekly] = useState<boolean>(true);

  const [scenarios, setScenarios] = useState<BudgetSimScenario[]>([]);
  const [scenariosLoading, setScenariosLoading] = useState<boolean>(true);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);

  const [baseline, setBaseline] = useState<BaselineData | null>(null);
  const [baselineLoading, setBaselineLoading] = useState<boolean>(true);

  const [items, setItems] = useState<BudgetSimScenarioItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState<boolean>(false);

  const [adjustments, setAdjustments] = useState<Map<string, AdjustmentValue>>(new Map());
  const [locked, setLocked] = useState<Set<string>>(new Set());

  const [formState, setFormState] = useState<FormState>({ open: false, mode: null, scenario: null });
  const [formPending, setFormPending] = useState(false);

  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [refreshingBaseline, setRefreshingBaseline] = useState(false);

  const categoryCatalog = useMemo(() => {
    const map = new Map<string, { name: string; type: 'income' | 'expense' | null }>();
    if (baseline) {
      for (const category of baseline.categories) {
        map.set(category.categoryId, { name: category.categoryName, type: category.categoryType });
      }
    }
    for (const item of items) {
      if (!map.has(item.category_id)) {
        map.set(item.category_id, {
          name: item.category?.name ?? 'Tanpa kategori',
          type: (item.category?.type as 'income' | 'expense' | null) ?? null,
        });
      }
    }
    for (const [categoryId, value] of adjustments.entries()) {
      if (!map.has(categoryId)) {
        map.set(categoryId, {
          name: value.categoryName ?? 'Tanpa kategori',
          type: value.categoryType ?? null,
        });
      }
    }
    return map;
  }, [baseline, items, adjustments]);

  useEffect(() => {
    setScenariosLoading(true);
    listScenarios({ period_month: periodMonth })
      .then((data) => {
        setScenarios(data);
        if (!selectedScenarioId || !data.some((scenario) => scenario.id === selectedScenarioId)) {
          setSelectedScenarioId(data[0]?.id ?? null);
        }
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Gagal memuat skenario';
        addToast(message, 'error');
        setScenarios([]);
        setSelectedScenarioId(null);
      })
      .finally(() => {
        setScenariosLoading(false);
      });
  }, [periodMonth, selectedScenarioId, addToast]);

  const refreshBaseline = useCallback(() => {
    setBaselineLoading(true);
    setRefreshingBaseline(true);
    return computeBaseline(periodMonth)
      .then((data) => {
        setBaseline(data);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Gagal memuat baseline anggaran';
        addToast(message, 'error');
        setBaseline(null);
      })
      .finally(() => {
        setBaselineLoading(false);
        setRefreshingBaseline(false);
      });
  }, [periodMonth, addToast]);

  useEffect(() => {
    refreshBaseline();
  }, [refreshBaseline]);

  useEffect(() => {
    if (!selectedScenarioId) {
      setItems([]);
      setAdjustments(new Map());
      setLocked(new Set());
      return;
    }
    setItemsLoading(true);
    listScenarioItems(selectedScenarioId)
      .then((data) => {
        setItems(data);
        setAdjustments(mapItemsToAdjustments(data));
        setLocked(new Set());
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Gagal memuat item skenario';
        addToast(message, 'error');
        setItems([]);
        setAdjustments(new Map());
      })
      .finally(() => {
        setItemsLoading(false);
      });
  }, [selectedScenarioId, addToast]);

  const handleAdjustmentChange = useCallback(
    (categoryId: string, payload: { deltaMonthly?: number; deltaWeekly?: Record<string, number> }) => {
      setAdjustments((prev) => {
        const next = new Map(prev);
        const current = next.get(categoryId) ?? {
          deltaMonthly: 0,
          deltaWeekly: {},
          categoryName: categoryCatalog.get(categoryId)?.name ?? 'Tanpa kategori',
          categoryType: categoryCatalog.get(categoryId)?.type ?? null,
        };
        const updated: AdjustmentValue = {
          ...current,
          deltaWeekly: { ...current.deltaWeekly },
        };
        if (payload.deltaMonthly !== undefined) {
          updated.deltaMonthly = payload.deltaMonthly;
        }
        if (payload.deltaWeekly) {
          for (const [week, value] of Object.entries(payload.deltaWeekly)) {
            updated.deltaWeekly[week] = value;
          }
        }
        next.set(categoryId, updated);
        return next;
      });
    },
    [categoryCatalog]
  );

  const handleResetCategory = useCallback(
    (categoryId: string) => {
      setAdjustments((prev) => {
        const next = new Map(prev);
        const current = next.get(categoryId) ?? {
          deltaMonthly: 0,
          deltaWeekly: {},
          categoryName: categoryCatalog.get(categoryId)?.name ?? 'Tanpa kategori',
          categoryType: categoryCatalog.get(categoryId)?.type ?? null,
        };
        next.set(categoryId, {
          ...current,
          deltaMonthly: 0,
          deltaWeekly: {},
        });
        return next;
      });
    },
    [categoryCatalog]
  );

  const handleToggleLock = useCallback((categoryId: string) => {
    setLocked((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  const adjustmentEntries = useMemo<ScenarioItemDelta[]>(() => {
    const entries: ScenarioItemDelta[] = [];
    adjustments.forEach((value, categoryId) => {
      const info = categoryCatalog.get(categoryId);
      const isLocked = locked.has(categoryId);
      const cleanWeekly: Record<string, number> = {};
      for (const [week, amount] of Object.entries(value.deltaWeekly ?? {})) {
        if (!Number.isFinite(amount) || amount === 0) continue;
        cleanWeekly[week] = amount;
      }
      entries.push({
        categoryId,
        deltaMonthly: isLocked ? 0 : value.deltaMonthly ?? 0,
        deltaWeekly: isLocked ? {} : cleanWeekly,
        categoryName: info?.name ?? value.categoryName,
        categoryType: info?.type ?? value.categoryType ?? null,
      });
    });
    return entries;
  }, [adjustments, locked, categoryCatalog]);

  const simulation: SimulationResult | null = useMemo(() => {
    if (!baseline) return null;
    return buildSimulation(baseline, adjustmentEntries, {
      includeWeekly,
      projectionMethod,
    });
  }, [baseline, adjustmentEntries, includeWeekly, projectionMethod]);

  const totals: SimulationTotals | null = simulation?.totals ?? null;
  const impact: SimulationImpact | null = simulation?.impact ?? null;

  const handleCreateScenario = async (values: { name: string; notes: string }) => {
    setFormPending(true);
    try {
      const scenario = await createScenario({ name: values.name, period_month: periodMonth, notes: values.notes });
      addToast('Skenario berhasil dibuat', 'success');
      setFormState({ open: false, mode: null, scenario: null });
      setScenarios((prev) => [...prev, scenario]);
      setSelectedScenarioId(scenario.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal membuat skenario';
      addToast(message, 'error');
    } finally {
      setFormPending(false);
    }
  };

  const handleRenameScenario = async (values: { name: string; notes: string }) => {
    if (formState.open && formState.mode === 'rename' && formState.scenario) {
      setFormPending(true);
      try {
        const updated = await updateScenario(formState.scenario.id, { name: values.name, notes: values.notes });
        addToast('Skenario diperbarui', 'success');
        setFormState({ open: false, mode: null, scenario: null });
        setScenarios((prev) => prev.map((scenario) => (scenario.id === updated.id ? updated : scenario)));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gagal memperbarui skenario';
        addToast(message, 'error');
      } finally {
        setFormPending(false);
      }
    }
  };

  const handleArchiveScenario = async (scenario: BudgetSimScenario) => {
    try {
      const updated = await archiveScenario(scenario.id);
      addToast('Skenario diarsipkan', 'success');
      setScenarios((prev) => prev.filter((item) => item.id !== scenario.id));
      if (selectedScenarioId === scenario.id) {
        setSelectedScenarioId(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengarsipkan skenario';
      addToast(message, 'error');
    }
  };

  const handleDeleteScenario = async (scenario: BudgetSimScenario) => {
    if (!window.confirm(`Hapus skenario "${scenario.name}"?`)) return;
    try {
      await deleteScenario(scenario.id);
      addToast('Skenario dihapus', 'success');
      setScenarios((prev) => prev.filter((item) => item.id !== scenario.id));
      if (selectedScenarioId === scenario.id) {
        setSelectedScenarioId(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menghapus skenario';
      addToast(message, 'error');
    }
  };

  const handleDuplicateScenario = async (scenario: BudgetSimScenario) => {
    try {
      const copy = await duplicateScenario(scenario.id);
      addToast('Skenario disalin', 'success');
      setScenarios((prev) => [...prev, copy]);
      setSelectedScenarioId(copy.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menduplikasi skenario';
      addToast(message, 'error');
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedScenarioId) return;
    setSaving(true);
    try {
      const existingMap = new Map(items.map((item) => [item.category_id, item]));
      const operations: Promise<unknown>[] = [];

      const seen = new Set<string>();
      adjustments.forEach((value, categoryId) => {
        seen.add(categoryId);
        const deltaMonthly = Number(value.deltaMonthly ?? 0);
        const cleanWeeklyEntries = Object.entries(value.deltaWeekly ?? {}).filter(([, amount]) => Number(amount) !== 0);
        const hasWeekly = cleanWeeklyEntries.length > 0;
        const payloadWeekly = Object.fromEntries(cleanWeeklyEntries);
        if (deltaMonthly === 0 && !hasWeekly) {
          if (existingMap.has(categoryId)) {
            operations.push(removeScenarioItem(selectedScenarioId, categoryId));
          }
          return;
        }
        operations.push(
          upsertScenarioItem({
            scenario_id: selectedScenarioId,
            category_id: categoryId,
            delta_monthly: deltaMonthly,
            delta_weekly: payloadWeekly,
          })
        );
      });

      for (const categoryId of existingMap.keys()) {
        if (!seen.has(categoryId)) {
          operations.push(removeScenarioItem(selectedScenarioId, categoryId));
        }
      }

      await Promise.all(operations);
      addToast('Draft simulasi tersimpan', 'success');
      const refreshedItems = await listScenarioItems(selectedScenarioId);
      setItems(refreshedItems);
      setAdjustments(mapItemsToAdjustments(refreshedItems));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menyimpan draft';
      addToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyScenario = async () => {
    if (!selectedScenarioId) return;
    if (!window.confirm('Terapkan perubahan ke anggaran aktual?')) return;
    setApplying(true);
    try {
      const result = await applyScenario(selectedScenarioId, {
        includeWeekly,
        projectionMethod,
      });
      addToast(
        `Skenario diterapkan. ${result.updatedBudgets} anggaran bulanan & ${result.updatedWeeklyBudgets} anggaran mingguan diperbarui`,
        'success'
      );
      await refreshBaseline();
      const refreshedItems = await listScenarioItems(selectedScenarioId);
      setItems(refreshedItems);
      setAdjustments(mapItemsToAdjustments(refreshedItems));
      const updatedScenarios = await listScenarios({ period_month: periodMonth });
      setScenarios(updatedScenarios);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menerapkan skenario';
      addToast(message, 'error');
    } finally {
      setApplying(false);
    }
  };

  const handleResetAll = () => {
    setAdjustments((prev) => {
      const next = new Map<string, AdjustmentValue>();
      prev.forEach((value, categoryId) => {
        next.set(categoryId, {
          ...value,
          deltaMonthly: 0,
          deltaWeekly: {},
        });
      });
      return next;
    });
    setLocked(new Set());
  };

  const scenarioForForm = formState.open && formState.mode === 'rename' ? formState.scenario : null;

  const actionDisabled = !selectedScenarioId || !baseline || itemsLoading || baselineLoading;

  return (
    <Page maxWidthClassName="max-w-[1440px]" paddingClassName="px-3 md:px-6">
      <PageHeader
        title="Simulasi Anggaran"
        description="Uji skenario what-if tanpa mengubah anggaran asli."
      >
        <button
          type="button"
          onClick={refreshBaseline}
          className="hidden h-11 items-center gap-2 rounded-2xl border border-border bg-surface px-4 text-sm font-semibold text-text transition hover:border-brand/40 hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 md:inline-flex"
        >
          {refreshingBaseline ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Segarkan data
        </button>
      </PageHeader>

      <Section first>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 rounded-2xl border border-border/60 bg-surface px-4 py-2 text-sm font-medium text-text shadow-inner focus-within:border-brand/40 focus-within:ring-2 focus-within:ring-brand/40">
              <CalendarRange className="h-4 w-4 text-muted" aria-hidden="true" />
              <input
                type="month"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                className="bg-transparent text-sm font-semibold text-text outline-none"
                aria-label="Pilih periode simulasi"
              />
              <span className="hidden text-xs text-muted md:inline">{toMonthLabel(period)}</span>
            </label>
          </div>
          <div className="inline-flex rounded-2xl border border-border/60 p-1 text-sm font-semibold shadow-inner">
            <button
              type="button"
              onClick={() => setMode('monthly')}
              className={`flex items-center gap-2 rounded-2xl px-3 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
                mode === 'monthly' ? 'bg-brand text-brand-foreground' : 'text-muted hover:text-text'
              }`}
            >
              <CalendarDays className="h-4 w-4" /> Bulanan
            </button>
            <button
              type="button"
              onClick={() => setMode('weekly')}
              className={`flex items-center gap-2 rounded-2xl px-3 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
                mode === 'weekly' ? 'bg-brand text-brand-foreground' : 'text-muted hover:text-text'
              }`}
            >
              <CalendarRange className="h-4 w-4" /> Mingguan
            </button>
          </div>
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="min-h-[420px]">
          <ScenarioList
            scenarios={scenarios}
            loading={scenariosLoading}
            selectedId={selectedScenarioId}
            onSelect={setSelectedScenarioId}
            onCreate={() => setFormState({ open: true, mode: 'create', scenario: null })}
            onRename={(scenario) => setFormState({ open: true, mode: 'rename', scenario })}
            onDuplicate={handleDuplicateScenario}
            onArchive={handleArchiveScenario}
            onDelete={handleDeleteScenario}
          />
        </div>
        <div className="flex flex-col gap-5">
          {baselineLoading || itemsLoading ? (
            <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-border/60 bg-surface/70">
              <div className="flex items-center gap-3 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Memuat data simulasi…
              </div>
            </div>
          ) : !baseline ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border/60 bg-surface/50 text-center text-sm text-muted">
              <Sparkles className="h-8 w-8 text-brand" />
              <p>Belum ada data baseline untuk periode ini.</p>
            </div>
          ) : (
            <BudgetSimulationEditor
              categories={simulation?.categories ?? []}
              weeks={simulation?.weeks ?? baseline.weeks}
              mode={mode}
              locked={locked}
              onChange={handleAdjustmentChange}
              onReset={handleResetCategory}
              onToggleLock={handleToggleLock}
            />
          )}

          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="flex flex-col gap-4">
              <SimulationSummary
                totals={totals ?? { baselinePlanned: 0, simulationPlanned: 0, actualMtd: 0, projectedEom: 0, deltaPlanned: 0 }}
                impact={impact ?? { incomeDelta: 0, expenseDelta: 0, netDelta: 0 }}
                projectionMethod={projectionMethod}
                includeWeekly={includeWeekly}
                onProjectionChange={setProjectionMethod}
                onIncludeWeeklyChange={setIncludeWeekly}
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={actionDisabled || saving}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand px-5 text-sm font-semibold text-brand-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Simpan Draft
                </button>
                <button
                  type="button"
                  onClick={handleApplyScenario}
                  disabled={actionDisabled || applying}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-brand/60 bg-surface px-5 text-sm font-semibold text-brand transition hover:border-brand hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Terapkan ke Anggaran
                </button>
                <CSVExport categories={simulation?.categories ?? []} totals={simulation?.totals ?? {
                  baselinePlanned: 0,
                  simulationPlanned: 0,
                  actualMtd: 0,
                  projectedEom: 0,
                  deltaPlanned: 0,
                }} />
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-border/60 px-4 text-sm font-semibold text-muted transition hover:border-brand/40 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  Reset
                </button>
              </div>
            </div>
            <RiskList risks={simulation?.risks ?? []} />
          </div>
        </div>
      </div>

      {formState.open ? (
        <ScenarioFormDialog
          open={formState.open}
          title={formState.mode === 'create' ? 'Buat skenario baru' : 'Ganti nama skenario'}
          description={
            formState.mode === 'create'
              ? 'Simulasikan penyesuaian anggaran untuk bulan terpilih tanpa mengubah data asli.'
              : undefined
          }
          defaultName={scenarioForForm?.name}
          defaultNotes={scenarioForForm?.notes ?? ''}
          pending={formPending}
          onClose={() => setFormState({ open: false, mode: null, scenario: null })}
          onSubmit={formState.mode === 'create' ? handleCreateScenario : handleRenameScenario}
        />
      ) : null}
    </Page>
  );
}

