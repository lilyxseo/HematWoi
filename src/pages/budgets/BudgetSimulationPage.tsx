import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Page from '../../layout/Page';
import Section from '../../layout/Section';
import PageHeader from '../../layout/PageHeader';
import { useToast } from '../../context/ToastContext';
import ScenarioList from './simulation/ScenarioList';
import ScenarioFormDialog, { type ScenarioFormMode } from './simulation/ScenarioFormDialog';
import BudgetSimulationEditor, { type EditorTab } from './simulation/BudgetSimulationEditor';
import SimulationSummary from './simulation/SimulationSummary';
import {
  applyScenario,
  archiveScenario,
  computeSimulation,
  createScenario,
  deleteScenario,
  duplicateScenario,
  listScenarios,
  updateScenario,
  upsertScenarioItem,
  deleteScenarioItem,
  type BudgetSimScenario,
  type SimulationSnapshot,
} from '../../lib/simScenarioApi';
import type { ProjectionMethod } from '../../lib/simMath';

interface DraftItem {
  deltaMonthly: number;
  deltaWeekly: Record<string, number>;
}

type DraftMap = Record<string, DraftItem>;

const EPSILON = 0.000001;

function getCurrentPeriod(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-01`;
}

function cloneDraftMap(source: DraftMap): DraftMap {
  const result: DraftMap = {};
  for (const [key, value] of Object.entries(source)) {
    result[key] = {
      deltaMonthly: value.deltaMonthly,
      deltaWeekly: { ...value.deltaWeekly },
    };
  }
  return result;
}

function sanitizeDraftItem(item: DraftItem): DraftItem | null {
  const normalizedWeekly: Record<string, number> = {};
  for (const [week, value] of Object.entries(item.deltaWeekly ?? {})) {
    const numeric = Number(value ?? 0);
    if (Math.abs(numeric) > EPSILON) {
      normalizedWeekly[week] = numeric;
    }
  }
  const monthly = Math.abs(item.deltaMonthly ?? 0) > EPSILON ? item.deltaMonthly : 0;
  if (monthly === 0 && Object.keys(normalizedWeekly).length === 0) {
    return null;
  }
  return {
    deltaMonthly: monthly,
    deltaWeekly: normalizedWeekly,
  };
}

function normalizeDraftMap(map: DraftMap): DraftMap {
  const result: DraftMap = {};
  for (const [key, value] of Object.entries(map)) {
    const sanitized = sanitizeDraftItem(value);
    if (sanitized) {
      result[key] = sanitized;
    }
  }
  return result;
}

function mapsEqual(a: DraftMap, b: DraftMap): boolean {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) return false;
  for (let index = 0; index < aKeys.length; index += 1) {
    if (aKeys[index] !== bKeys[index]) return false;
    const key = aKeys[index];
    const itemA = a[key];
    const itemB = b[key];
    if (!itemA || !itemB) return false;
    if (Math.abs(itemA.deltaMonthly - itemB.deltaMonthly) > EPSILON) return false;
    const weeksA = Object.keys(itemA.deltaWeekly).sort();
    const weeksB = Object.keys(itemB.deltaWeekly).sort();
    if (weeksA.length !== weeksB.length) return false;
    for (let i = 0; i < weeksA.length; i += 1) {
      if (weeksA[i] !== weeksB[i]) return false;
      if (Math.abs((itemA.deltaWeekly[weeksA[i]] ?? 0) - (itemB.deltaWeekly[weeksA[i]] ?? 0)) > EPSILON) return false;
    }
  }
  return true;
}

export default function BudgetSimulationPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [period, setPeriod] = useState<string>(getCurrentPeriod());
  const [scenarios, setScenarios] = useState<BudgetSimScenario[]>([]);
  const [scenariosLoading, setScenariosLoading] = useState(false);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SimulationSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [draftMap, setDraftMap] = useState<DraftMap>({});
  const [originalMap, setOriginalMap] = useState<DraftMap>({});
  const [tab, setTab] = useState<EditorTab>('monthly');
  const [projectionMethod, setProjectionMethod] = useState<ProjectionMethod>('linear');
  const [includeWeekly, setIncludeWeekly] = useState(true);
  const [lockedCategories, setLockedCategories] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<ScenarioFormMode>('create');
  const [editingScenario, setEditingScenario] = useState<BudgetSimScenario | null>(null);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(() => !mapsEqual(normalizeDraftMap(originalMap), normalizeDraftMap(draftMap)), [originalMap, draftMap]);

  const workingSnapshot = useMemo<SimulationSnapshot | null>(() => {
    if (!snapshot) return null;
    const normalizedDraft = normalizeDraftMap(draftMap);
    const categories = snapshot.baseline.categories.map((base) => {
      const draft = normalizedDraft[base.id];
      const isLocked = lockedCategories.has(base.id);
      const deltaMonthly = isLocked ? 0 : draft?.deltaMonthly ?? 0;
      const deltaWeekly = isLocked ? {} : { ...(draft?.deltaWeekly ?? {}) };
      const simulatedWeekly: Record<string, number> = { ...base.plannedWeekly };
      for (const [week, value] of Object.entries(deltaWeekly)) {
        simulatedWeekly[week] = (simulatedWeekly[week] ?? 0) + value;
      }
      const simulatedMonthly = base.plannedMonthly + deltaMonthly;
      return {
        ...base,
        deltaMonthly,
        deltaWeekly,
        simulatedMonthly,
        simulatedWeekly,
      };
    });
    return {
      ...snapshot,
      categories,
    };
  }, [snapshot, draftMap, lockedCategories]);

  const loadScenarios = useCallback(() => {
    setScenariosLoading(true);
    setError(null);
    listScenarios({ period_month: period })
      .then((data) => {
        setScenarios(data);
        if (data.length > 0) {
          setSelectedScenarioId((prev) => {
            if (prev && data.some((item) => item.id === prev)) {
              return prev;
            }
            return data[0].id;
          });
        } else {
          setSelectedScenarioId(null);
          setSnapshot(null);
          setDraftMap({});
          setOriginalMap({});
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Gagal memuat skenario';
        setError(message);
        addToast(message, 'error');
      })
      .finally(() => {
        setScenariosLoading(false);
      });
  }, [period, addToast]);

  const loadSnapshot = useCallback(
    (scenarioId: string) => {
      setSnapshotLoading(true);
      setError(null);
      computeSimulation(scenarioId)
        .then((data) => {
          setSnapshot(data);
          const draft: DraftMap = {};
          data.categories.forEach((category) => {
            const sanitized = sanitizeDraftItem({
              deltaMonthly: category.deltaMonthly,
              deltaWeekly: category.deltaWeekly,
            });
            if (sanitized) {
              draft[category.id] = sanitized;
            }
          });
          setDraftMap(draft);
          setOriginalMap(cloneDraftMap(draft));
          setLockedCategories(new Set());
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : 'Gagal memuat skenario';
          setError(message);
          addToast(message, 'error');
        })
        .finally(() => {
          setSnapshotLoading(false);
        });
    },
    [addToast]
  );

  useEffect(() => {
    loadScenarios();
  }, [loadScenarios]);

  useEffect(() => {
    if (selectedScenarioId) {
      loadSnapshot(selectedScenarioId);
    }
  }, [selectedScenarioId, loadSnapshot]);

  const handleScenarioCreated = useCallback(
    (scenario: BudgetSimScenario) => {
      setScenarios((prev) => [...prev, scenario]);
      setSelectedScenarioId(scenario.id);
    },
    []
  );

  function handleDraftMonthlyChange(categoryId: string, value: number) {
    setDraftMap((prev) => {
      const next = { ...prev };
      const current = prev[categoryId] ?? { deltaMonthly: 0, deltaWeekly: {} };
      const updated = sanitizeDraftItem({
        deltaMonthly: value,
        deltaWeekly: current.deltaWeekly,
      });
      if (updated) {
        next[categoryId] = updated;
      } else {
        delete next[categoryId];
      }
      return next;
    });
  }

  function handleDraftWeeklyChange(categoryId: string, week: string, value: number) {
    setDraftMap((prev) => {
      const next = { ...prev };
      const current = prev[categoryId] ?? { deltaMonthly: 0, deltaWeekly: {} };
      const updated = sanitizeDraftItem({
        deltaMonthly: current.deltaMonthly,
        deltaWeekly: { ...current.deltaWeekly, [week]: value },
      });
      if (updated) {
        next[categoryId] = updated;
      } else {
        delete next[categoryId];
      }
      return next;
    });
  }

  function handleResetCategory(categoryId: string) {
    setDraftMap((prev) => {
      if (!prev[categoryId]) return prev;
      const { [categoryId]: _removed, ...rest } = prev;
      return rest;
    });
    setLockedCategories((prev) => {
      if (!prev.has(categoryId)) return prev;
      const next = new Set(prev);
      next.delete(categoryId);
      return next;
    });
  }

  function handleToggleLock(categoryId: string) {
    setLockedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }

  function openCreateForm() {
    setFormMode('create');
    setEditingScenario(null);
    setFormOpen(true);
  }

  function openRenameForm(scenario: BudgetSimScenario) {
    setFormMode('rename');
    setEditingScenario(scenario);
    setFormOpen(true);
  }

  async function handleFormSubmit(payload: { name: string; notes: string }) {
    try {
      if (formMode === 'create') {
        const scenario = await createScenario({ name: payload.name, period_month: period, notes: payload.notes });
        addToast('Skenario berhasil dibuat', 'success');
        handleScenarioCreated(scenario);
        loadScenarios();
      } else if (editingScenario) {
        const updated = await updateScenario(editingScenario.id, { name: payload.name, notes: payload.notes });
        addToast('Nama skenario diperbarui', 'success');
        setScenarios((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        setSelectedScenarioId(updated.id);
        loadScenarios();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menyimpan skenario';
      addToast(message, 'error');
    } finally {
      setFormOpen(false);
    }
  }

  async function handleDuplicate(scenario: BudgetSimScenario) {
    try {
      const newScenario = await duplicateScenario(scenario.id);
      addToast('Skenario diduplikasi', 'success');
      handleScenarioCreated(newScenario);
      loadScenarios();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menduplikasi skenario';
      addToast(message, 'error');
    }
  }

  async function handleArchive(scenario: BudgetSimScenario) {
    if (!window.confirm(`Arsipkan skenario "${scenario.name}"?`)) return;
    try {
      await archiveScenario(scenario.id);
      addToast('Skenario diarsipkan', 'success');
      loadScenarios();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengarsipkan skenario';
      addToast(message, 'error');
    }
  }

  async function handleDelete(scenario: BudgetSimScenario) {
    if (!window.confirm(`Hapus skenario "${scenario.name}"?`)) return;
    try {
      await deleteScenario(scenario.id);
      addToast('Skenario dihapus', 'success');
      loadScenarios();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menghapus skenario';
      addToast(message, 'error');
    }
  }

  async function handleSaveDraft() {
    if (!snapshot) return;
    if (!selectedScenarioId) return;
    setSaving(true);
    try {
      const filteredMap: DraftMap = {};
      for (const [key, value] of Object.entries(draftMap)) {
        if (lockedCategories.has(key)) continue;
        filteredMap[key] = value;
      }
      const normalized = normalizeDraftMap(filteredMap);
      const original = normalizeDraftMap(originalMap);
      const operations: Promise<unknown>[] = [];
      const currentIds = new Set(Object.keys(normalized));
      for (const [categoryId, item] of Object.entries(normalized)) {
        operations.push(
          upsertScenarioItem({
            scenario_id: selectedScenarioId,
            category_id: categoryId,
            delta_monthly: item.deltaMonthly,
            delta_weekly: item.deltaWeekly,
          })
        );
      }
      for (const categoryId of Object.keys(original)) {
        if (!currentIds.has(categoryId)) {
          operations.push(deleteScenarioItem(selectedScenarioId, categoryId));
        }
      }
      await Promise.all(operations);
      setOriginalMap(cloneDraftMap(normalized));
      addToast('Draft skenario disimpan', 'success');
      loadSnapshot(selectedScenarioId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menyimpan draft';
      addToast(message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleApply() {
    if (!snapshot || !selectedScenarioId) return;
    if (dirty) {
      addToast('Simpan draft sebelum menerapkan skenario.', 'warning');
      return;
    }
    if (!window.confirm('Terapkan skenario ini ke anggaran sebenarnya?')) return;
    setApplying(true);
    try {
      const result = await applyScenario(selectedScenarioId);
      addToast(`Skenario diterapkan. ${result.updatedMonthly} anggaran bulanan & ${result.updatedWeekly} mingguan diperbarui.`, 'success');
      loadScenarios();
      loadSnapshot(selectedScenarioId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menerapkan skenario';
      addToast(message, 'error');
    } finally {
      setApplying(false);
    }
  }

  function handleResetAll() {
    setDraftMap({});
    setLockedCategories(new Set());
  }

  const loading = scenariosLoading || snapshotLoading;

  return (
    <Page>
      <PageHeader
        title="Simulasi Anggaran"
        description="Uji skenario penyesuaian anggaran dan lihat dampaknya sebelum diterapkan."
        actions={
          <button className="btn btn-ghost" type="button" onClick={() => navigate('/budgets')}>
            ← Kembali ke Anggaran
          </button>
        }
      />
      <Section>
        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          <div className="min-h-[480px]">
            <ScenarioList
              scenarios={scenarios}
              selectedId={selectedScenarioId}
              onSelect={(scenario) => setSelectedScenarioId(scenario.id)}
              onCreate={openCreateForm}
              onRename={openRenameForm}
              onDuplicate={handleDuplicate}
              onArchive={handleArchive}
              onDelete={handleDelete}
              loading={scenariosLoading}
              periodMonth={period}
              onChangePeriod={(value) => {
                setPeriod(value);
                setSelectedScenarioId(null);
              }}
            />
          </div>
          <div className="flex flex-col gap-6">
            {error ? (
              <div className="rounded-2xl border border-rose-500/50 bg-rose-500/10 p-4 text-sm text-rose-200">
                Terjadi kesalahan: {error}
              </div>
            ) : null}
            {loading && !workingSnapshot ? (
              <div className="rounded-2xl border border-border-subtle bg-surface p-6 text-center text-sm text-text-subtle">
                Memuat...
              </div>
            ) : null}
            {!loading && !workingSnapshot ? (
              <div className="rounded-2xl border border-border-subtle bg-surface p-12 text-center text-sm text-text-subtle">
                Belum ada skenario aktif. Buat skenario terlebih dahulu untuk mulai simulasi.
              </div>
            ) : null}
            {workingSnapshot ? (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr),minmax(0,1fr)]">
                <div className="min-h-[540px] rounded-2xl border border-border-subtle bg-surface p-4 shadow-sm">
                  <BudgetSimulationEditor
                    baseline={workingSnapshot.baseline}
                    categories={workingSnapshot.categories}
                    tab={tab}
                    lockedCategories={lockedCategories}
                    onTabChange={setTab}
                    onChangeMonthly={handleDraftMonthlyChange}
                    onChangeWeekly={handleDraftWeeklyChange}
                    onResetCategory={handleResetCategory}
                    onToggleLock={handleToggleLock}
                  />
                </div>
                <div className="min-h-[540px]">
                  <SimulationSummary
                    snapshot={workingSnapshot}
                    projectionMethod={projectionMethod}
                    onProjectionMethodChange={setProjectionMethod}
                    includeWeekly={includeWeekly}
                    onIncludeWeeklyChange={setIncludeWeekly}
                    onSaveDraft={handleSaveDraft}
                    onApply={handleApply}
                    onReset={handleResetAll}
                    saving={saving}
                    applying={applying}
                    disabled={!workingSnapshot}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </Section>
      <ScenarioFormDialog
        open={formOpen}
        mode={formMode}
        initialName={editingScenario?.name}
        initialNotes={editingScenario?.notes ?? ''}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
      />
    </Page>
  );
}
