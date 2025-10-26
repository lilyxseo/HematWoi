import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  Copy,
  Download,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Unlock,
} from 'lucide-react';
import clsx from 'clsx';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar } from 'recharts';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../lib/format';
import ConfirmDialog from '../components/debts/ConfirmDialog';
import {
  applyBudgetSimulation,
  buildDraftFromItems,
  computeBudgetSimulationSnapshot,
  createBudgetSimulationScenario,
  createEmptyDraftItem,
  deleteBudgetSimulationScenario,
  fetchBudgetSimulationBaseline,
  fetchBudgetSimulationScenario,
  listBudgetSimulationScenarios,
  saveBudgetSimulationItems,
  updateBudgetSimulationScenario,
  type ApplySimulationResult,
  type BudgetSimulationBaselineData,
  type BudgetSimulationDraftItem,
  type BudgetSimulationScenarioDetail,
  type BudgetSimulationScenarioSummary,
  type BudgetSimulationSnapshot,
  type BudgetSimulationSnapshotCategory,
  type SimulationProjectionMethod,
  type SimulationWeeklyKey,
} from '../lib/budgetSimulationApi';

const PROJECTION_METHODS: Array<{ value: SimulationProjectionMethod; label: string; description: string }> = [
  { value: 'linear', label: 'Linear harian', description: 'Menggunakan rata-rata harian MTD' },
  { value: 'recent', label: '4 minggu terakhir', description: 'Memperkirakan berdasarkan intensitas 4 minggu terakhir' },
  { value: 'static', label: 'Tetap', description: 'Asumsikan pengeluaran berhenti di titik sekarang' },
];

const WEEKDAY_LABELS: Record<SimulationWeeklyKey, string> = {
  mon: 'Sen',
  tue: 'Sel',
  wed: 'Rab',
  thu: 'Kam',
  fri: 'Jum',
  sat: 'Sab',
  sun: 'Min',
};

const STATUS_BADGE: Record<BudgetSimulationSnapshotCategory['status'], string> = {
  safe: 'bg-brand/10 text-brand border border-brand/30',
  caution: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  warning: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  over: 'bg-rose-500/10 text-rose-400 border border-rose-500/30',
};

function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}`;
}

function formatPeriod(period: string): string {
  if (!period) return '—';
  const [yearStr, monthStr] = period.split('-');
  if (!yearStr || !monthStr) return period;
  const formatter = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' });
  return formatter.format(new Date(Number(yearStr), Number(monthStr) - 1, 1));
}

function cloneDraft(item?: BudgetSimulationDraftItem): BudgetSimulationDraftItem {
  if (!item) return createEmptyDraftItem();
  return {
    deltaMonthly: item.deltaMonthly,
    deltaWeekly: { ...item.deltaWeekly },
    locked: item.locked,
  };
}

function draftsEqual(a: Record<string, BudgetSimulationDraftItem>, b: Record<string, BudgetSimulationDraftItem>): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    const itemA = a[key];
    const itemB = b[key];
    if (!itemB) return false;
    if (Math.abs(itemA.deltaMonthly - itemB.deltaMonthly) > 0.0001) return false;
    if (itemA.locked !== itemB.locked) return false;
    const days = Object.keys(itemA.deltaWeekly) as SimulationWeeklyKey[];
    for (const day of days) {
      if (Math.abs(itemA.deltaWeekly[day] - itemB.deltaWeekly[day]) > 0.0001) {
        return false;
      }
    }
  }
  return true;
}

function sanitizeDraft(item: BudgetSimulationDraftItem): BudgetSimulationDraftItem {
  return {
    deltaMonthly: Number.isFinite(item.deltaMonthly) ? item.deltaMonthly : 0,
    deltaWeekly: Object.fromEntries(
      (Object.keys(item.deltaWeekly) as SimulationWeeklyKey[]).map((day) => [day, Number(item.deltaWeekly[day] ?? 0)]),
    ) as BudgetSimulationDraftItem['deltaWeekly'],
    locked: Boolean(item.locked),
  };
}

function buildCsv(snapshot: BudgetSimulationSnapshot): string {
  const header = [
    'Kategori',
    'Planned Baseline',
    'Planned Skenario',
    'Actual MTD',
    'Projected EOM',
    'Sisa/Over',
    'Status',
  ];
  const rows = snapshot.categories.map((category) => {
    const remaining = category.scenarioPlanned - category.actual;
    return [
      category.name,
      category.baselinePlanned.toFixed(2),
      category.scenarioPlanned.toFixed(2),
      category.actual.toFixed(2),
      category.projected.toFixed(2),
      remaining.toFixed(2),
      category.status,
    ];
  });
  const totals = snapshot.totals;
  rows.push([
    'TOTAL',
    totals.plannedBaseline.toFixed(2),
    totals.planned.toFixed(2),
    totals.actual.toFixed(2),
    totals.projected.toFixed(2),
    (totals.planned - totals.actual).toFixed(2),
    '',
  ]);
  return [header, ...rows]
    .map((line) => line.map((value) => `"${value.replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export default function BudgetSimulationPage(): JSX.Element {
  const { addToast } = useToast();
  const [period, setPeriod] = useState<string>(getCurrentPeriod());
  const [includeWeekly, setIncludeWeekly] = useState<boolean>(true);
  const [projectionMethod, setProjectionMethod] = useState<SimulationProjectionMethod>('linear');
  const [includeCarryover, setIncludeCarryover] = useState<boolean>(true);
  const [baseline, setBaseline] = useState<BudgetSimulationBaselineData | null>(null);
  const [scenarios, setScenarios] = useState<BudgetSimulationScenarioSummary[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [draftItems, setDraftItems] = useState<Record<string, BudgetSimulationDraftItem>>({});
  const [originalDraft, setOriginalDraft] = useState<Record<string, BudgetSimulationDraftItem>>({});
  const [originalIncludeWeekly, setOriginalIncludeWeekly] = useState<boolean>(true);
  const [scenarioDetail, setScenarioDetail] = useState<BudgetSimulationScenarioDetail | null>(null);
  const [loadingBaseline, setLoadingBaseline] = useState<boolean>(false);
  const [loadingScenario, setLoadingScenario] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [applyLoading, setApplyLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [comparisonSnapshots, setComparisonSnapshots] = useState<Record<string, BudgetSimulationSnapshot>>({});
  const [deleteTarget, setDeleteTarget] = useState<BudgetSimulationScenarioSummary | null>(null);
  const [applyDialogOpen, setApplyDialogOpen] = useState<boolean>(false);
  const [lastApplyResult, setLastApplyResult] = useState<ApplySimulationResult | null>(null);

  const isDirty = useMemo(() => {
    if (!scenarioDetail) return false;
    if (includeWeekly !== originalIncludeWeekly) return true;
    return !draftsEqual(draftItems, originalDraft);
  }, [draftItems, includeWeekly, originalDraft, originalIncludeWeekly, scenarioDetail]);

  const loadBaseline = useCallback(async () => {
    setLoadingBaseline(true);
    setError(null);
    try {
      const [baselineData, scenarioList] = await Promise.all([
        fetchBudgetSimulationBaseline(period),
        listBudgetSimulationScenarios(period),
      ]);
      setBaseline(baselineData);
      setScenarios(scenarioList);
      setSelectedScenarioId((current) => {
        if (scenarioList.length === 0) {
          return null;
        }
        if (current && scenarioList.some((item) => item.id === current)) {
          return current;
        }
        return scenarioList[0].id;
      });
      if (scenarioList.length === 0) {
        setScenarioDetail(null);
        setDraftItems({});
        setOriginalDraft({});
        setOriginalIncludeWeekly(true);
        setIncludeWeekly(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memuat data simulasi';
      setError(message);
    } finally {
      setLoadingBaseline(false);
    }
  }, [period]);

  useEffect(() => {
    void loadBaseline();
  }, [loadBaseline]);

  useEffect(() => {
    if (!baseline) return;
    let cancelled = false;

    async function run() {
      if (!selectedScenarioId) {
        if (cancelled) return;
        setScenarioDetail(null);
        setDraftItems({});
        setOriginalDraft({});
        setOriginalIncludeWeekly(true);
        setIncludeWeekly(true);
        return;
      }
      setLoadingScenario(true);
      try {
        const detail = await fetchBudgetSimulationScenario(selectedScenarioId);
        if (cancelled) return;
        if (!detail) {
          setScenarioDetail(null);
          setDraftItems({});
          setOriginalDraft({});
          setOriginalIncludeWeekly(true);
          setIncludeWeekly(true);
          return;
        }
        const draft = buildDraftFromItems(detail.items);
        setScenarioDetail(detail);
        setDraftItems(cloneDraftMap(draft));
        setOriginalDraft(cloneDraftMap(draft));
        setIncludeWeekly(detail.includeWeekly);
        setOriginalIncludeWeekly(detail.includeWeekly);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Gagal memuat skenario';
        setError(message);
      } finally {
        if (!cancelled) {
          setLoadingScenario(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [baseline, selectedScenarioId]);

  useEffect(() => {
    setComparisonSnapshots({});
    setCompareA(null);
    setCompareB(null);
  }, [baseline?.period]);

  useEffect(() => {
    if (!compareMode) return;
    if (compareA && baseline) {
      void (async () => {
        const detail = await fetchBudgetSimulationScenario(compareA);
        if (!detail) return;
        const draft = buildDraftFromItems(detail.items);
        setComparisonSnapshots((prev) => ({
          ...prev,
          [compareA]: computeBudgetSimulationSnapshot({
            baseline,
            items: draft,
            includeWeekly: detail.includeWeekly,
            method: projectionMethod,
            includeCarryover,
          }),
        }));
      })();
    }
  }, [compareMode, compareA, baseline, projectionMethod, includeCarryover]);

  useEffect(() => {
    if (!compareMode) return;
    if (compareB && baseline) {
      void (async () => {
        const detail = await fetchBudgetSimulationScenario(compareB);
        if (!detail) return;
        const draft = buildDraftFromItems(detail.items);
        setComparisonSnapshots((prev) => ({
          ...prev,
          [compareB]: computeBudgetSimulationSnapshot({
            baseline,
            items: draft,
            includeWeekly: detail.includeWeekly,
            method: projectionMethod,
            includeCarryover,
          }),
        }));
      })();
    }
  }, [compareMode, compareB, baseline, projectionMethod, includeCarryover]);

  const snapshot = useMemo(() => {
    if (!baseline) return null;
    return computeBudgetSimulationSnapshot({
      baseline,
      items: draftItems,
      includeWeekly,
      method: projectionMethod,
      includeCarryover,
    });
  }, [baseline, draftItems, includeWeekly, projectionMethod, includeCarryover]);

  const riskCategories = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.categories
      .filter((item) => item.ratio >= 0.9)
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 10);
  }, [snapshot]);

  const chartData = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.categories
      .filter((item) => item.scenarioPlanned > 0)
      .sort((a, b) => b.scenarioPlanned - a.scenarioPlanned)
      .slice(0, 10)
      .map((item) => ({
        name: item.name,
        Planned: Number(item.scenarioPlanned.toFixed(2)),
        Projected: Number(item.projected.toFixed(2)),
      }));
  }, [snapshot]);

  const impactDelta = useMemo(() => {
    if (!snapshot) return { label: 'Netral', delta: 0 };
    const delta = snapshot.totals.deltaPlanned;
    if (Math.abs(delta) < 1) return { label: 'Netral', delta: 0 };
    if (delta > 0) return { label: 'Saldo berpotensi turun', delta: delta * -1 };
    return { label: 'Saldo berpotensi naik', delta: Math.abs(delta) };
  }, [snapshot]);

  const handleMonthlyChange = useCallback(
    (categoryId: string, value: number) => {
      setDraftItems((prev) => {
        const base = cloneDraft(prev[categoryId]);
        base.deltaMonthly = Number.isFinite(value) ? value : 0;
        const sanitized = sanitizeDraft(base);
        const isEmpty =
          Math.abs(sanitized.deltaMonthly) < 0.0001 &&
          !sanitized.locked &&
          (Object.keys(sanitized.deltaWeekly) as SimulationWeeklyKey[]).every(
            (day) => Math.abs(sanitized.deltaWeekly[day]) < 0.0001,
          );
        if (isEmpty) {
          const { [categoryId]: _removed, ...rest } = prev;
          return rest;
        }
        return { ...prev, [categoryId]: sanitized };
      });
    },
    [],
  );

  const handleWeeklyChange = useCallback((categoryId: string, day: SimulationWeeklyKey, value: number) => {
    setDraftItems((prev) => {
      const base = cloneDraft(prev[categoryId]);
      base.deltaWeekly[day] = Number.isFinite(value) ? value : 0;
      const sanitized = sanitizeDraft(base);
      const isEmpty =
        Math.abs(sanitized.deltaMonthly) < 0.0001 &&
        !sanitized.locked &&
        (Object.keys(sanitized.deltaWeekly) as SimulationWeeklyKey[]).every(
          (key) => Math.abs(sanitized.deltaWeekly[key]) < 0.0001,
        );
      if (isEmpty) {
        const { [categoryId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [categoryId]: sanitized };
    });
  }, []);

  const handleToggleLock = useCallback((categoryId: string) => {
    setDraftItems((prev) => {
      const base = cloneDraft(prev[categoryId]);
      base.locked = !base.locked;
      const sanitized = sanitizeDraft(base);
      const isEmpty =
        Math.abs(sanitized.deltaMonthly) < 0.0001 &&
        !sanitized.locked &&
        (Object.keys(sanitized.deltaWeekly) as SimulationWeeklyKey[]).every(
          (key) => Math.abs(sanitized.deltaWeekly[key]) < 0.0001,
        );
      if (isEmpty) {
        const { [categoryId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [categoryId]: sanitized };
    });
  }, []);

  const handlePercentChange = useCallback(
    (categoryId: string, baseAmount: number, percent: number) => {
      const nextPlanned = baseAmount * (1 + percent);
      const delta = nextPlanned - baseAmount;
      handleMonthlyChange(categoryId, Math.round(delta * 100) / 100);
    },
    [handleMonthlyChange],
  );

  const handleResetCategory = useCallback(
    (categoryId: string) => {
      setDraftItems((prev) => {
        if (!prev[categoryId]) return prev;
        const { [categoryId]: _removed, ...rest } = prev;
        return rest;
      });
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!selectedScenarioId) return;
    setSaving(true);
    try {
      await saveBudgetSimulationItems(selectedScenarioId, draftItems);
      await updateBudgetSimulationScenario(selectedScenarioId, { includeWeekly });
      setOriginalDraft(cloneDraftMap(draftItems));
      setOriginalIncludeWeekly(includeWeekly);
      setScenarioDetail((current) => (current ? { ...current, includeWeekly } : current));
      addToast({ type: 'success', message: 'Skenario berhasil disimpan' });
      const scenarioList = await listBudgetSimulationScenarios(period);
      setScenarios(scenarioList);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan skenario';
      addToast({ type: 'error', message });
    } finally {
      setSaving(false);
    }
  }, [addToast, draftItems, includeWeekly, period, selectedScenarioId]);

  const handleNewScenario = useCallback(async () => {
    const name = window.prompt('Nama skenario baru', `Skenario ${scenarios.length + 1}`);
    if (!name) return;
    try {
      const detail = await createBudgetSimulationScenario({
        name,
        period,
        includeWeekly: true,
      });
      const scenarioList = await listBudgetSimulationScenarios(period);
      setScenarios(scenarioList);
      setSelectedScenarioId(detail.id);
      addToast({ type: 'success', message: 'Skenario baru dibuat' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal membuat skenario';
      addToast({ type: 'error', message });
    }
  }, [addToast, period, scenarios.length]);

  const handleDuplicateScenario = useCallback(async () => {
    if (!selectedScenarioId || !scenarioDetail) return;
    const name = window.prompt('Nama salinan skenario', `${scenarioDetail.name} (Copy)`);
    if (!name) return;
    try {
      const detail = await createBudgetSimulationScenario({
        name,
        period,
        includeWeekly: scenarioDetail.includeWeekly,
        sourceScenarioId: scenarioDetail.id,
      });
      const scenarioList = await listBudgetSimulationScenarios(period);
      setScenarios(scenarioList);
      setSelectedScenarioId(detail.id);
      addToast({ type: 'success', message: 'Skenario berhasil digandakan' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menggandakan skenario';
      addToast({ type: 'error', message });
    }
  }, [addToast, period, scenarioDetail, selectedScenarioId]);

  const handleRenameScenario = useCallback(async () => {
    if (!selectedScenarioId || !scenarioDetail) return;
    const name = window.prompt('Nama skenario', scenarioDetail.name);
    if (!name || name === scenarioDetail.name) return;
    try {
      await updateBudgetSimulationScenario(selectedScenarioId, { name });
      const scenarioList = await listBudgetSimulationScenarios(period);
      setScenarios(scenarioList);
      setScenarioDetail({ ...scenarioDetail, name });
      addToast({ type: 'success', message: 'Nama skenario diperbarui' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal mengganti nama';
      addToast({ type: 'error', message });
    }
  }, [addToast, period, scenarioDetail, selectedScenarioId]);

  const handleDeleteScenario = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteBudgetSimulationScenario(deleteTarget.id);
      const scenarioList = await listBudgetSimulationScenarios(period);
      setScenarios(scenarioList);
      if (selectedScenarioId === deleteTarget.id) {
        setSelectedScenarioId(scenarioList[0]?.id ?? null);
      }
      addToast({ type: 'success', message: 'Skenario dihapus' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus skenario';
      addToast({ type: 'error', message });
    } finally {
      setDeleteTarget(null);
    }
  }, [addToast, deleteTarget, period, selectedScenarioId]);

  const handleResetScenario = useCallback(() => {
    setDraftItems(cloneDraftMap(originalDraft));
    setIncludeWeekly(originalIncludeWeekly);
  }, [originalDraft, originalIncludeWeekly]);

  const handleExportCsv = useCallback(() => {
    if (!snapshot) return;
    const csv = buildCsv(snapshot);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `simulasi-budget-${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [period, snapshot]);

  const handleApply = useCallback(async () => {
    if (!baseline || !selectedScenarioId) return;
    setApplyLoading(true);
    try {
      const result = await applyBudgetSimulation({
        period,
        baseline,
        items: draftItems,
        includeWeekly,
      });
      setLastApplyResult(result);
      addToast({
        type: 'success',
        message: `Perubahan diterapkan • ${result.monthlyUpdates.length} anggaran bulanan, ${result.weeklyUpdates.length} mingguan`,
      });
      await loadBaseline();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menerapkan skenario';
      addToast({ type: 'error', message });
    } finally {
      setApplyLoading(false);
      setApplyDialogOpen(false);
    }
  }, [addToast, baseline, draftItems, includeWeekly, loadBaseline, period, selectedScenarioId]);

  const comparisonTable = useMemo(() => {
    if (!compareMode || !compareA || !compareB) return null;
    const snapshotA = comparisonSnapshots[compareA];
    const snapshotB = comparisonSnapshots[compareB];
    if (!snapshotA || !snapshotB) return null;
    const mapB = new Map(snapshotB.categories.map((item) => [item.categoryId, item]));
    const rows = snapshotA.categories.map((itemA) => {
      const itemB = mapB.get(itemA.categoryId);
      return {
        categoryId: itemA.categoryId,
        name: itemA.name,
        plannedA: itemA.scenarioPlanned,
        plannedB: itemB?.scenarioPlanned ?? itemA.baselinePlanned,
        projectedA: itemA.projected,
        projectedB: itemB?.projected ?? itemA.projected,
        remainingA: itemA.scenarioPlanned - itemA.actual,
        remainingB: (itemB?.scenarioPlanned ?? itemA.baselinePlanned) - itemA.actual,
      };
    });
    return {
      rows,
      totals: {
        plannedA: snapshotA.totals.planned,
        plannedB: snapshotB.totals.planned,
        projectedA: snapshotA.totals.projected,
        projectedB: snapshotB.totals.projected,
        remainingA: snapshotA.totals.remaining,
        remainingB: snapshotB.totals.remaining,
      },
    };
  }, [compareMode, compareA, compareB, comparisonSnapshots]);

  if (loadingBaseline && !baseline) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-10 w-48 animate-pulse rounded-2xl bg-border/40" />
        <div className="grid gap-6 lg:grid-cols-[420px,1fr]">
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-2xl bg-border/40" />
            ))}
          </div>
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-2xl bg-border/40" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !baseline) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <div>
          <h1 className="text-lg font-semibold text-text">Gagal memuat simulasi</h1>
          <p className="text-sm text-muted">{error}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadBaseline()}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-brand px-5 text-sm font-semibold text-brand-foreground shadow transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
        >
          <RefreshCw className="h-4 w-4" /> Muat ulang
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 pb-10 md:p-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-text">Simulasi Budget</h1>
          <p className="text-sm text-muted">
            Uji berbagai skenario anggaran tanpa menyentuh data asli. Bandingkan perubahan, lihat proyeksi akhir bulan, lalu terapkan saat siap.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="flex h-11 items-center gap-2 rounded-2xl border border-border/60 bg-surface/90 px-4 text-sm font-medium text-text shadow focus-within:border-brand/40 focus-within:bg-brand/5 focus-within:outline-none focus-within:ring-2 focus-within:ring-brand/40">
            <span className="text-muted">Periode</span>
            <input
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              aria-label="Pilih periode bulan"
              className="rounded-xl bg-transparent text-sm font-semibold text-text outline-none"
            />
          </label>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-border bg-surface px-4 text-sm font-semibold text-text transition hover:border-brand/40 hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button
            type="button"
            onClick={handleDuplicateScenario}
            disabled={!scenarioDetail}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-border bg-surface px-4 text-sm font-semibold text-text transition hover:border-brand/40 hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Copy className="h-4 w-4" /> Duplikasi
          </button>
          <button
            type="button"
            onClick={handleNewScenario}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-brand px-5 text-sm font-semibold text-brand-foreground shadow transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
          >
            <Plus className="h-4 w-4" /> Skenario Baru
          </button>
        </div>
      </header>

      {error && baseline ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-500">
          {error} —{' '}
          <button type="button" onClick={() => void loadBaseline()} className="font-semibold underline">
            coba lagi
          </button>
        </div>
      ) : null}

      {!scenarios.length ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border/60 bg-surface/60 p-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand">
            <BarChart3 className="h-8 w-8" />
          </span>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-text">Buat skenario pertama</h2>
            <p className="max-w-md text-sm text-muted">
              Simulasikan perubahan anggaran bulanan dan mingguan, kemudian lihat dampaknya terhadap proyeksi akhir bulan dan risiko over-budget.
            </p>
          </div>
          <button
            type="button"
            onClick={handleNewScenario}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-brand px-5 text-sm font-semibold text-brand-foreground shadow transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
          >
            <Plus className="h-4 w-4" /> Buat Skenario
          </button>
        </div>
      ) : null}

      {baseline && snapshot ? (
        <div className="grid gap-6 lg:grid-cols-[420px,1fr] xl:grid-cols-[450px,1fr]">
          <aside className="space-y-6">
            <section className="space-y-4 rounded-2xl border border-border/80 bg-surface p-5 shadow-sm">
              <header className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-text">Manajemen Skenario</h2>
                  <p className="text-xs text-muted">Kelola skenario simulasi untuk periode {formatPeriod(period)}</p>
                </div>
              </header>
              <div className="space-y-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted">Pilih skenario</span>
                  <select
                    value={selectedScenarioId ?? ''}
                    onChange={(event) => setSelectedScenarioId(event.target.value || null)}
                    className="h-11 rounded-2xl border border-border bg-surface px-3 text-sm font-medium text-text focus:outline-none focus:ring-2 focus:ring-brand/40"
                    aria-label="Pilih skenario"
                  >
                    {scenarios.map((scenario) => (
                      <option key={scenario.id} value={scenario.id}>
                        {scenario.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleRenameScenario}
                    disabled={!scenarioDetail}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-surface px-3 text-xs font-semibold uppercase tracking-wide text-muted transition hover:border-brand/40 hover:bg-brand/5 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(scenarioDetail ?? null)}
                    disabled={!scenarioDetail}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-surface px-3 text-xs font-semibold uppercase tracking-wide text-muted transition hover:border-rose-400 hover:bg-rose-500/10 hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Hapus
                  </button>
                  <button
                    type="button"
                    onClick={handleResetScenario}
                    disabled={!isDirty}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-surface px-3 text-xs font-semibold uppercase tracking-wide text-muted transition hover:border-brand/40 hover:bg-brand/5 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Reset
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-surface/60 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-text">Ikutkan weekly budgets</span>
                  <button
                    type="button"
                    onClick={() => setIncludeWeekly((value) => !value)}
                    className={clsx(
                      'relative h-8 w-14 rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                      includeWeekly ? 'border-brand/40 bg-brand/80' : 'border-border bg-surface',
                    )}
                    aria-pressed={includeWeekly}
                    aria-label="Toggle weekly budgets"
                  >
                    <span
                      className={clsx(
                        'absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-white shadow transition',
                        includeWeekly ? 'left-[calc(100%-1.75rem)]' : 'left-1.5',
                      )}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-text">Sertakan carryover</span>
                  <button
                    type="button"
                    onClick={() => setIncludeCarryover((value) => !value)}
                    className={clsx(
                      'relative h-8 w-14 rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                      includeCarryover ? 'border-brand/40 bg-brand/80' : 'border-border bg-surface',
                    )}
                    aria-pressed={includeCarryover}
                    aria-label="Toggle carryover"
                  >
                    <span
                      className={clsx(
                        'absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-white shadow transition',
                        includeCarryover ? 'left-[calc(100%-1.75rem)]' : 'left-1.5',
                      )}
                    />
                  </button>
                </div>
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted">Metode proyeksi</span>
                  <div className="grid grid-cols-1 gap-2">
                    {PROJECTION_METHODS.map((method) => {
                      const active = projectionMethod === method.value;
                      return (
                        <button
                          key={method.value}
                          type="button"
                          onClick={() => setProjectionMethod(method.value)}
                          className={clsx(
                            'flex h-auto flex-col gap-1 rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                            active ? 'border-brand/50 bg-brand/10 text-brand' : 'border-border bg-surface/60 text-muted hover:border-brand/30 hover:text-text',
                          )}
                        >
                          <span className="text-sm font-semibold">{method.label}</span>
                          <span className="text-xs text-muted">{method.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!isDirty || saving}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-brand px-5 text-sm font-semibold text-brand-foreground shadow transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="h-4 w-4" /> {saving ? 'Menyimpan…' : 'Simpan Draft'}
                </button>
                <button
                  type="button"
                  onClick={() => setApplyDialogOpen(true)}
                  disabled={!scenarioDetail}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-brand/50 bg-brand/10 px-5 text-sm font-semibold text-brand transition hover:border-brand hover:bg-brand/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <BarChart3 className="h-4 w-4" /> Terapkan ke Anggaran
                </button>
              </div>
              {lastApplyResult ? (
                <div className="rounded-2xl border border-brand/40 bg-brand/10 p-4 text-xs text-brand">
                  <p className="font-semibold">Perubahan terbaru</p>
                  <p className="mt-1">{lastApplyResult.monthlyUpdates.length} anggaran bulanan • {lastApplyResult.weeklyUpdates.length} anggaran mingguan</p>
                </div>
              ) : null}
            </section>

            <section className="space-y-4 rounded-2xl border border-border/80 bg-surface p-5 shadow-sm">
              <header className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-text">Bandingkan Skenario</h2>
                  <p className="text-xs text-muted">Bandingkan dua skenario untuk melihat selisih rencana dan proyeksi</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCompareMode((value) => !value)}
                  className={clsx(
                    'inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold uppercase tracking-wide transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                    compareMode
                      ? 'border-brand/50 bg-brand/15 text-brand'
                      : 'border-border bg-surface text-muted hover:border-brand/40 hover:bg-brand/5 hover:text-text',
                  )}
                >
                  <ArrowLeftRight className="h-4 w-4" /> {compareMode ? 'Aktif' : 'Off'}
                </button>
              </header>
              {compareMode ? (
                <div className="space-y-3">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-xs font-medium text-muted">Skenario A</span>
                    <select
                      value={compareA ?? ''}
                      onChange={(event) => setCompareA(event.target.value || null)}
                      className="h-10 rounded-xl border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                    >
                      <option value="">Pilih skenario</option>
                      {scenarios.map((scenario) => (
                        <option key={scenario.id} value={scenario.id}>
                          {scenario.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-xs font-medium text-muted">Skenario B</span>
                    <select
                      value={compareB ?? ''}
                      onChange={(event) => setCompareB(event.target.value || null)}
                      className="h-10 rounded-xl border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                    >
                      <option value="">Pilih skenario</option>
                      {scenarios.map((scenario) => (
                        <option key={scenario.id} value={scenario.id}>
                          {scenario.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {comparisonTable ? (
                    <div className="overflow-hidden rounded-2xl border border-border/70">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface-1/80 text-muted">
                          <tr>
                            <th className="p-3 font-semibold">Kategori</th>
                            <th className="p-3 font-semibold">Planned A</th>
                            <th className="p-3 font-semibold">Planned B</th>
                            <th className="p-3 font-semibold">Projected A</th>
                            <th className="p-3 font-semibold">Projected B</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comparisonTable.rows.slice(0, 15).map((row) => (
                            <tr key={row.categoryId} className="border-t border-border/50">
                              <td className="p-3 text-xs font-medium text-text">{row.name}</td>
                              <td className="p-3 tabular-nums text-xs">{formatCurrency(Math.round(row.plannedA), 'IDR')}</td>
                              <td className="p-3 tabular-nums text-xs">{formatCurrency(Math.round(row.plannedB), 'IDR')}</td>
                              <td className="p-3 tabular-nums text-xs">{formatCurrency(Math.round(row.projectedA), 'IDR')}</td>
                              <td className="p-3 tabular-nums text-xs">{formatCurrency(Math.round(row.projectedB), 'IDR')}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-surface-1/70">
                          <tr>
                            <td className="p-3 text-xs font-semibold uppercase">Total</td>
                            <td className="p-3 tabular-nums text-xs font-semibold">{formatCurrency(Math.round(comparisonTable.totals.plannedA), 'IDR')}</td>
                            <td className="p-3 tabular-nums text-xs font-semibold">{formatCurrency(Math.round(comparisonTable.totals.plannedB), 'IDR')}</td>
                            <td className="p-3 tabular-nums text-xs font-semibold">{formatCurrency(Math.round(comparisonTable.totals.projectedA), 'IDR')}</td>
                            <td className="p-3 tabular-nums text-xs font-semibold">{formatCurrency(Math.round(comparisonTable.totals.projectedB), 'IDR')}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-muted">Pilih dua skenario untuk melihat perbandingan.</p>
                  )}
                </div>
              ) : null}
            </section>
          </aside>

          <main className="space-y-6">
            <section className="grid gap-4 rounded-2xl border border-border/80 bg-surface p-5 shadow-sm lg:grid-cols-4">
              <SummaryCard
                label="Planned total"
                value={formatCurrency(Math.round(snapshot.totals.planned), 'IDR')}
                description={`Baseline ${formatCurrency(Math.round(snapshot.totals.plannedBaseline), 'IDR')}`}
              />
              <SummaryCard
                label="Actual MTD"
                value={formatCurrency(Math.round(snapshot.totals.actual), 'IDR')}
                description={`Sisa ${formatCurrency(Math.round(snapshot.totals.remaining), 'IDR')}`}
              />
              <SummaryCard
                label="Projected EOM"
                value={formatCurrency(Math.round(snapshot.totals.projected), 'IDR')}
                description={
                  snapshot.totals.deltaProjected >= 0
                    ? `+${formatCurrency(Math.round(snapshot.totals.deltaProjected), 'IDR')} vs baseline`
                    : `${formatCurrency(Math.round(snapshot.totals.deltaProjected), 'IDR')} vs baseline`
                }
              />
              <SummaryCard
                label="Impact on Cash"
                value={formatCurrency(Math.round(impactDelta.delta), 'IDR')}
                description={impactDelta.label}
              />
            </section>

            <section className="grid gap-6 rounded-2xl border border-border/80 bg-surface p-5 shadow-sm lg:grid-cols-5">
              <div className="lg:col-span-3">
                <h2 className="text-sm font-semibold text-text">Planned vs Projected</h2>
                <p className="text-xs text-muted">10 kategori dengan alokasi tertinggi</p>
                <div className="mt-4 h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar dataKey="Planned" fill="var(--brand)" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="Projected" fill="rgba(244, 63, 94, 0.7)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="space-y-3 rounded-2xl border border-border/60 bg-surface/70 p-4">
                <h2 className="text-sm font-semibold text-text">Peluang Over-budget</h2>
                <p className="text-xs text-muted">Kategori dengan risiko ≥ 90%</p>
                <div className="space-y-2">
                  {riskCategories.length === 0 ? (
                    <p className="text-xs text-muted">Tidak ada kategori berisiko tinggi.</p>
                  ) : (
                    riskCategories.map((item) => (
                      <div key={item.categoryId} className="flex items-center justify-between rounded-xl border border-border/50 bg-surface-1/80 px-3 py-2">
                        <div>
                          <p className="text-xs font-semibold text-text">{item.name}</p>
                          <p className="text-[0.7rem] text-muted">Projected {Math.round(item.ratio * 100)}%</p>
                        </div>
                        <span className={clsx('rounded-full px-2 py-1 text-[0.6rem] font-semibold uppercase', STATUS_BADGE[item.status])}>
                          {item.status === 'over' ? '>100%' : `${Math.round(item.ratio * 100)}%`}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-border/80 bg-surface p-5 shadow-sm">
              <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-text">Editor Anggaran per Kategori</h2>
                  <p className="text-xs text-muted">Sesuaikan planned bulanan/mingguan, gunakan shortcut persentase, atau kunci kategori dari simulasi.</p>
                </div>
                {loadingScenario ? <span className="text-xs text-muted">Memuat skenario…</span> : null}
              </header>
              <div className="space-y-4">
                {baseline.categories.map((category) => {
                  const draft = draftItems[category.categoryId];
                  const snapshotCategory = snapshot.categories.find((item) => item.categoryId === category.categoryId);
                  if (!snapshotCategory) return null;
                  const baseAmount = includeWeekly
                    ? category.plannedMonthly + category.plannedWeekly
                    : category.plannedMonthly;
                  const deltaWeeklyTotal = draft
                    ? Object.values(draft.deltaWeekly).reduce((acc, value) => acc + value, 0)
                    : 0;
                  const locked = Boolean(draft?.locked);
                  return (
                    <article
                      key={category.categoryId}
                      className="space-y-4 rounded-2xl border border-border/70 bg-surface/70 p-4 shadow-sm transition hover:border-brand/30"
                    >
                      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                          <span className={clsx('inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase shadow-sm', STATUS_BADGE[snapshotCategory.status])}>
                            {snapshotCategory.status === 'safe'
                              ? '≤74%'
                              : snapshotCategory.status === 'caution'
                              ? '75–89%'
                              : snapshotCategory.status === 'warning'
                              ? '90–100%'
                              : '>100%'}
                          </span>
                          <div>
                            <h3 className="text-sm font-semibold text-text">{category.name}</h3>
                            <p className="text-xs text-muted">
                              Planned {formatCurrency(Math.round(snapshotCategory.scenarioPlanned), 'IDR')} · Actual {formatCurrency(Math.round(snapshotCategory.actual), 'IDR')} · Proyeksi {formatCurrency(Math.round(snapshotCategory.projected), 'IDR')}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handlePercentChange(category.categoryId, baseAmount, 0.05)}
                            disabled={locked || loadingScenario}
                            className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-muted transition hover:border-brand/40 hover:bg-brand/5 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            +5%
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePercentChange(category.categoryId, baseAmount, 0.1)}
                            disabled={locked || loadingScenario}
                            className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-muted transition hover:border-brand/40 hover:bg-brand/5 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            +10%
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePercentChange(category.categoryId, baseAmount, -0.1)}
                            disabled={locked || loadingScenario}
                            className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-muted transition hover:border-brand/40 hover:bg-brand/5 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            −10%
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResetCategory(category.categoryId)}
                            disabled={!draft || loadingScenario}
                            className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-muted transition hover:border-brand/40 hover:bg-brand/5 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Reset
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleLock(category.categoryId)}
                            disabled={loadingScenario}
                            className={clsx(
                              'inline-flex h-9 items-center justify-center rounded-xl border px-3 text-xs font-semibold uppercase tracking-wide transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60',
                              locked
                                ? 'border-rose-500/60 bg-rose-500/10 text-rose-400'
                                : 'border-border bg-surface text-muted hover:border-brand/40 hover:bg-brand/5 hover:text-text',
                            )}
                          >
                            {locked ? (
                              <span className="flex items-center gap-1">
                                <Lock className="h-3.5 w-3.5" /> Locked
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Unlock className="h-3.5 w-3.5" /> Lock
                              </span>
                            )}
                          </button>
                        </div>
                      </header>

                      <div className="grid gap-4 lg:grid-cols-3">
                        <div className="space-y-2">
                          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                            Planned Bulanan
                            <input
                              type="number"
                              inputMode="decimal"
                              disabled={locked}
                              value={draft?.deltaMonthly ?? 0}
                              onChange={(event) => handleMonthlyChange(category.categoryId, Number(event.target.value))}
                              disabled={locked || loadingScenario}
                              className="h-11 rounded-2xl border border-border bg-surface px-3 text-sm font-semibold text-text focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60"
                            />
                          </label>
                          <div className="rounded-2xl border border-border/60 bg-surface/70 p-3 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-muted">Baseline</span>
                              <span className="font-semibold text-text">
                                {formatCurrency(Math.round(baseAmount), 'IDR')}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              <span className="text-muted">Skenario</span>
                              <span className="font-semibold text-text">
                                {formatCurrency(Math.round(snapshotCategory.scenarioPlanned), 'IDR')}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="lg:col-span-2">
                          <label className="text-xs font-semibold text-muted">Penyesuaian Weekly (Sen–Min)</label>
                          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                            {(Object.keys(WEEKDAY_LABELS) as SimulationWeeklyKey[]).map((day) => (
                              <label key={day} className="flex flex-col gap-1 text-[0.68rem] font-medium text-muted">
                                {WEEKDAY_LABELS[day]}
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  disabled={locked || loadingScenario}
                                  value={draft?.deltaWeekly?.[day] ?? 0}
                                  onChange={(event) => handleWeeklyChange(category.categoryId, day, Number(event.target.value))}
                                  className="h-10 rounded-xl border border-border bg-surface px-2 text-xs font-semibold text-text focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60"
                                />
                              </label>
                            ))}
                          </div>
                          {includeWeekly ? (
                            <p className="mt-2 text-[0.7rem] text-muted">Total delta weekly: {formatCurrency(Math.round(deltaWeeklyTotal), 'IDR')}</p>
                          ) : (
                            <p className="mt-2 text-[0.7rem] text-muted">Weekly budgets sedang tidak dihitung.</p>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-3 rounded-2xl border border-border/60 bg-surface/60 p-3 text-[0.7rem] text-muted sm:grid-cols-2">
                        <div>
                          <p>
                            Baseline → Skenario:{' '}
                            <span className="font-semibold text-text">
                              {formatCurrency(Math.round(snapshotCategory.baselinePlanned), 'IDR')} →{' '}
                              {formatCurrency(Math.round(snapshotCategory.scenarioPlanned), 'IDR')}
                            </span>
                          </p>
                          <p>
                            Actual vs Proyeksi:{' '}
                            <span className="font-semibold text-text">
                              {formatCurrency(Math.round(snapshotCategory.actual), 'IDR')} → {formatCurrency(Math.round(snapshotCategory.projected), 'IDR')}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-border/80">
                            <div
                              className={clsx(
                                'h-full rounded-full',
                                snapshotCategory.status === 'safe'
                                  ? 'bg-brand'
                                  : snapshotCategory.status === 'caution'
                                  ? 'bg-amber-400'
                                  : snapshotCategory.status === 'warning'
                                  ? 'bg-orange-400'
                                  : 'bg-rose-500',
                              )}
                              style={{ width: `${Math.min(110, Math.max(0, snapshotCategory.ratio * 100))}%` }}
                            />
                          </div>
                          <span className="w-14 text-right font-semibold text-text">{Math.round(snapshotCategory.ratio * 100)}%</span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </main>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus skenario?"
        description={`Skenario “${deleteTarget?.name ?? ''}” akan dihapus permanen.`}
        confirmLabel="Hapus"
        destructive
        onConfirm={() => void handleDeleteScenario()}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={applyDialogOpen}
        title="Terapkan skenario?"
        description="Perubahan akan di-commit ke budgets dan weekly budgets. Pastikan simulasi sudah sesuai."
        confirmLabel={applyLoading ? 'Memproses…' : 'Terapkan'}
        loading={applyLoading}
        onConfirm={() => void handleApply()}
        onCancel={() => setApplyDialogOpen(false)}
      />
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  value: string;
  description: string;
}

function SummaryCard({ label, value, description }: SummaryCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-border/70 bg-surface-1/80 p-4 shadow-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      <span className="mt-2 text-xl font-semibold text-text">{value}</span>
      <span className="text-xs text-muted">{description}</span>
    </div>
  );
}
