import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  Loader2,
  Plus,
  RefreshCw,
  Copy,
  Trash2,
  Lock,
  Unlock,
  Sparkles,
  RotateCcw,
  Save,
  BarChart3,
  PieChart as PieChartIcon,
  AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Label,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Legend,
  CartesianGrid,
} from 'recharts';
import { Link, useNavigate } from 'react-router-dom';
import Page from '../../../../layout/Page';
import PageHeader from '../../../../layout/PageHeader';
import Section from '../../../../layout/Section';
import { useToast } from '../../../../context/ToastContext';
import useSupabaseUser from '../../../../hooks/useSupabaseUser';
import CurrencyInput from '../../../../components/ui/CurrencyInput';
import {
  type ExpenseCategoryRow,
  type MonthlyBudgetRow,
  type SalarySimulationItemRow,
  type SalarySimulationRow,
  createSalarySimulation,
  deleteSalarySimulation,
  duplicateSalarySimulation,
  getMonthlyBudgets,
  getSalarySimulationById,
  getSalarySimulations,
  listExpenseCategories,
  updateSalarySimulation,
} from '../../../../lib/salarySimulationApi';
import { upsertBudget } from '../../../../lib/budgetApi';

interface AllocationItem {
  categoryId: string;
  categoryName: string;
  amount: number;
  percent: number;
  locked: boolean;
  color?: string | null;
  groupName?: string | null;
}

interface DraftPayload {
  salaryAmount: number;
  period: string;
  title: string;
  notes: string;
  items: AllocationItem[];
  activeSimulationId: string | null;
}

const FALLBACK_COLORS = ['#6366F1', '#22C55E', '#F97316', '#F43F5E', '#0EA5E9', '#8B5CF6', '#EC4899', '#10B981', '#FFB020'];
const monthFormatter = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' });
const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
});
const percentFormatter = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value: number) {
  return `${percentFormatter.format(Number.isFinite(value) ? value : 0)}%`;
}

function toMonthLabel(period: string) {
  if (!period) return '';
  try {
    const [year, month] = period.split('-').map((value) => Number.parseInt(value, 10));
    if (!year || !month) return period;
    return monthFormatter.format(new Date(year, month - 1, 1));
  } catch (_error) {
    return period;
  }
}

function getCurrentPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function extractYearMonth(value: string | null | undefined) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  return {
    year: year.toString().padStart(4, '0'),
    month: month.toString().padStart(2, '0'),
  };
}

function normalizePeriod(value: string | null | undefined, fallback?: string) {
  const extracted = extractYearMonth(value);
  if (extracted) {
    return `${extracted.year}-${extracted.month}`;
  }
  if (fallback !== undefined) {
    return fallback && fallback.trim() ? fallback : getCurrentPeriod();
  }
  return getCurrentPeriod();
}

function toMonthStart(period: string) {
  const extracted = extractYearMonth(period);
  if (!extracted) return period;
  return `${extracted.year}-${extracted.month}-01`;
}

function roundPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function computeItemPercent(amount: number, salaryAmount: number) {
  if (!salaryAmount || salaryAmount <= 0) return 0;
  return roundPercent((amount / salaryAmount) * 100);
}

function mapSimulationItems(
  items: SalarySimulationItemRow[] | undefined,
  salaryAmount: number,
  categories: ExpenseCategoryRow[],
): AllocationItem[] {
  const categoryMap = new Map(categories.map((category) => [category.id, category] as const));
  return (items ?? []).map((item) => {
    const category = categoryMap.get(item.category_id);
    return {
      categoryId: item.category_id,
      categoryName: item.category?.name ?? category?.name ?? 'Tanpa kategori',
      amount: Number(item.allocation_amount ?? 0),
      percent: computeItemPercent(Number(item.allocation_amount ?? 0), salaryAmount),
      locked: false,
      color: category?.color ?? null,
      groupName: category?.group_name ?? null,
    } satisfies AllocationItem;
  });
}

function computeSimulationSummary(simulation: SalarySimulationRow) {
  const total = (simulation.items ?? []).reduce((sum, item) => sum + Number(item.allocation_amount ?? 0), 0);
  const remaining = Number(simulation.salary_amount ?? 0) - total;
  const percentage = simulation.salary_amount > 0 ? (total / simulation.salary_amount) * 100 : 0;
  return { total, remaining, percentage: roundPercent(percentage) };
}

function sortItems(items: AllocationItem[]) {
  return [...items].sort((a, b) => {
    const groupCompare = (a.groupName ?? '').localeCompare(b.groupName ?? '', 'id-ID', {
      sensitivity: 'base',
    });
    if (groupCompare !== 0) return groupCompare;
    return a.categoryName.localeCompare(b.categoryName, 'id-ID', { sensitivity: 'base' });
  });
}

export default function SalarySimulationPage() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const { user, loading: userLoading } = useSupabaseUser();

  const [salaryAmount, setSalaryAmount] = useState<number>(0);
  const [period, setPeriod] = useState<string>(getCurrentPeriod());
  const [title, setTitle] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [items, setItems] = useState<AllocationItem[]>([]);

  const [categories, setCategories] = useState<ExpenseCategoryRow[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState<boolean>(true);

  const [budgets, setBudgets] = useState<MonthlyBudgetRow[]>([]);
  const [budgetsLoading, setBudgetsLoading] = useState<boolean>(true);

  const [history, setHistory] = useState<SalarySimulationRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(true);

  const [activeSimulationId, setActiveSimulationId] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [duplicating, setDuplicating] = useState<boolean>(false);
  const [applying, setApplying] = useState<boolean>(false);

  const [showAddCategories, setShowAddCategories] = useState<boolean>(false);
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);
  const [confirmApply, setConfirmApply] = useState<boolean>(false);

  const [draftLoaded, setDraftLoaded] = useState<boolean>(false);

  const periodMonth = useMemo(() => toMonthStart(period), [period]);

  const budgetMap = useMemo(() => {
    const map = new Map<string, MonthlyBudgetRow>();
    for (const budget of budgets) {
      map.set(budget.category_id, budget);
    }
    return map;
  }, [budgets]);

  const totalAllocation = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0),
    [items],
  );

  const allocationPercent = useMemo(
    () => (salaryAmount > 0 ? roundPercent((totalAllocation / salaryAmount) * 100) : 0),
    [salaryAmount, totalAllocation],
  );

  const remainingSalary = salaryAmount - totalAllocation;
  const overAllocated = remainingSalary < 0;

  const highestAllocation = useMemo(() => {
    if (!items.length) return null;
    const sorted = [...items].sort((a, b) => b.amount - a.amount);
    return sorted[0] ?? null;
  }, [items]);

  const monthlyBudgetTotal = useMemo(
    () => budgets.reduce((sum, budget) => sum + Number(budget.amount_planned ?? 0), 0),
    [budgets],
  );

  const hasBudgetComparison = useMemo(
    () => budgets.some((budget) => Number(budget.amount_planned ?? 0) > 0),
    [budgets],
  );

  const chartData = useMemo(
    () =>
      items
        .filter((item) => item.amount > 0)
        .map((item, index) => ({
          name: item.categoryName,
          value: item.amount,
          color: item.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
        })),
    [items],
  );

  const comparisonData = useMemo(
    () =>
      items.map((item, index) => ({
        name: item.categoryName,
        allocation: item.amount,
        budget: budgetMap.get(item.categoryId)?.amount_planned ?? 0,
        color: item.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
      })),
    [items, budgetMap],
  );

  const draftKey = useMemo(() => (user ? `salary-simulation-draft:${user.id}` : 'salary-simulation-draft'), [user]);

  useEffect(() => {
    if (!userLoading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [userLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    setCategoriesLoading(true);
    listExpenseCategories(user.id)
      .then((data) => {
        setCategories(data);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Gagal memuat kategori';
        addToast(message, 'error');
        setCategories([]);
      })
      .finally(() => {
        setCategoriesLoading(false);
      });
  }, [user, addToast]);

  const loadBudgets = useCallback(
    (targetPeriodMonth?: string) => {
      if (!user) return Promise.resolve();
      const periodToLoad = targetPeriodMonth ?? periodMonth;
      setBudgetsLoading(true);
      return getMonthlyBudgets(periodToLoad, user.id)
        .then((data) => {
          setBudgets(data);
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : 'Gagal memuat budget bulan ini';
          addToast(message, 'error');
          setBudgets([]);
        })
        .finally(() => {
          setBudgetsLoading(false);
        });
    },
    [user, periodMonth, addToast],
  );

  useEffect(() => {
    loadBudgets();
  }, [loadBudgets]);

  const loadHistory = useCallback(() => {
    if (!user) return Promise.resolve();
    setHistoryLoading(true);
    return getSalarySimulations(user.id)
      .then((data) => {
        setHistory(data);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Gagal memuat riwayat simulasi';
        addToast(message, 'error');
        setHistory([]);
      })
      .finally(() => {
        setHistoryLoading(false);
      });
  }, [user, addToast]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!user || draftLoaded) return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) {
        setDraftLoaded(true);
        return;
      }
      const payload = JSON.parse(raw) as DraftPayload;
      if (payload) {
        setSalaryAmount(payload.salaryAmount ?? 0);
        setPeriod(normalizePeriod(payload.period));
        setTitle(payload.title ?? '');
        setNotes(payload.notes ?? '');
        setItems(sortItems(payload.items ?? []));
        setActiveSimulationId(payload.activeSimulationId ?? null);
      }
    } catch (_error) {
      // ignore malformed drafts
    } finally {
      setDraftLoaded(true);
    }
  }, [user, draftLoaded, draftKey]);

  useEffect(() => {
    if (!user || !draftLoaded) return;
    const payload: DraftPayload = {
      salaryAmount,
      period,
      title,
      notes,
      items,
      activeSimulationId,
    };
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(payload));
    } catch (_error) {
      // ignore persistence errors
    }
  }, [user, draftLoaded, draftKey, salaryAmount, period, title, notes, items, activeSimulationId]);

  useEffect(() => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        percent: computeItemPercent(item.amount, salaryAmount),
      })),
    );
  }, [salaryAmount]);

  const availableCategories = useMemo(() => {
    const selected = new Set(items.map((item) => item.categoryId));
    return categories.filter((category) => !selected.has(category.id));
  }, [items, categories]);

  const handleAddSelectedCategories = useCallback(() => {
    if (!selectedToAdd.length) {
      setShowAddCategories(false);
      return;
    }
    const newItems = selectedToAdd
      .map((categoryId) => {
        const category = categories.find((item) => item.id === categoryId);
        if (!category) return null;
        return {
          categoryId: category.id,
          categoryName: category.name,
          amount: 0,
          percent: 0,
          locked: false,
          color: category.color ?? null,
          groupName: category.group_name ?? null,
        } as AllocationItem;
      })
      .filter(Boolean) as AllocationItem[];
    setItems((prev) => sortItems([...prev, ...newItems]));
    setSelectedToAdd([]);
    setShowAddCategories(false);
  }, [selectedToAdd, categories]);

  const handleRemoveItem = useCallback((categoryId: string) => {
    setItems((prev) => prev.filter((item) => item.categoryId !== categoryId));
  }, []);

  const handleToggleLock = useCallback((categoryId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.categoryId === categoryId
          ? {
              ...item,
              locked: !item.locked,
            }
          : item,
      ),
    );
  }, []);

  const handleAmountChange = useCallback(
    (categoryId: string, nextAmount: number) => {
      const sanitized = Math.max(0, Math.floor(Number(nextAmount ?? 0)));
      setItems((prev) =>
        prev.map((item) =>
          item.categoryId === categoryId
            ? {
                ...item,
                amount: sanitized,
                percent: computeItemPercent(sanitized, salaryAmount),
              }
            : item,
        ),
      );
    },
    [salaryAmount],
  );

  const handlePercentChange = useCallback(
    (categoryId: string, nextPercent: number) => {
      const sanitized = Math.max(0, Number(nextPercent ?? 0));
      setItems((prev) =>
        prev.map((item) => {
          if (item.categoryId !== categoryId) return item;
          const percent = roundPercent(sanitized);
          const amount = Math.round((salaryAmount * percent) / 100);
          return {
            ...item,
            amount,
            percent,
          };
        }),
      );
    },
    [salaryAmount],
  );

  const handleAutoDistribute = useCallback(() => {
    if (!items.length) {
      addToast('Tambahkan kategori terlebih dahulu.', 'info');
      return;
    }
    if (!salaryAmount || salaryAmount <= 0) {
      addToast('Masukkan nominal gaji terlebih dahulu.', 'error');
      return;
    }
    const adjustable = items.filter((item) => !item.locked);
    if (!adjustable.length) {
      addToast('Tidak ada kategori yang bisa diatur (semua terkunci).', 'info');
      return;
    }
    const lockedTotal = items
      .filter((item) => item.locked)
      .reduce((sum, item) => sum + item.amount, 0);
    const available = Math.max(salaryAmount - lockedTotal, 0);

    let weights = adjustable.map((item) => budgetMap.get(item.categoryId)?.amount_planned ?? 0);
    const totalBudget = weights.reduce((sum, weight) => sum + weight, 0);
    if (totalBudget === 0) {
      weights = adjustable.map(() => 1);
    }
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    setItems((prev) => {
      let remainder = available;
      let weightIndex = 0;
      return prev.map((item) => {
        if (item.locked) {
          return {
            ...item,
            percent: computeItemPercent(item.amount, salaryAmount),
          };
        }
        const weight = totalWeight > 0 ? weights[weightIndex] ?? 0 : 0;
        const share =
          weightIndex === adjustable.length - 1 || totalWeight === 0
            ? remainder
            : Math.round((available * weight) / totalWeight);
        remainder = Math.max(0, remainder - share);
        weightIndex += 1;
        const percent = computeItemPercent(share, salaryAmount);
        return {
          ...item,
          amount: share,
          percent,
        };
      });
    });
  }, [items, salaryAmount, budgetMap, addToast]);

  const applySimulation = useCallback(async () => {
    if (!items.length) {
      addToast('Tidak ada alokasi untuk diterapkan.', 'info');
      return;
    }
    const normalizedPeriod = normalizePeriod(period);
    const targetPeriodMonth = toMonthStart(normalizedPeriod);
    if (normalizedPeriod !== period) {
      setPeriod(normalizedPeriod);
    }
    setApplying(true);
    try {
      let existingBudgetMap: Map<string, MonthlyBudgetRow> = budgetMap;
      if (targetPeriodMonth !== periodMonth) {
        try {
          const freshBudgets = await getMonthlyBudgets(targetPeriodMonth, user?.id);
          existingBudgetMap = new Map(
            freshBudgets.map((budget) => [budget.category_id, budget] as const),
          );
        } catch (_error) {
          existingBudgetMap = new Map<string, MonthlyBudgetRow>();
        }
      }

      for (const item of items) {
        const existing = existingBudgetMap.get(item.categoryId);
        await upsertBudget({
          category_id: item.categoryId,
          period: normalizedPeriod,
          amount_planned: item.amount,
          carryover_enabled: existing?.carryover_enabled ?? false,
          notes: existing?.notes ?? undefined,
        });
      }
      addToast('Alokasi simulasi diterapkan ke budget bulan ini.', 'success');
      await loadBudgets(targetPeriodMonth);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menerapkan simulasi ke budget';
      addToast(message, 'error');
    } finally {
      setApplying(false);
    }
  }, [
    items,
    addToast,
    budgetMap,
    period,
    periodMonth,
    loadBudgets,
    setPeriod,
    user?.id,
  ]);

  const buildPayload = useCallback(
    () => ({
      title,
      salaryAmount,
      periodMonth,
      notes,
      items: items.map((item) => ({
        categoryId: item.categoryId,
        allocationAmount: item.amount,
        allocationPercent: item.percent,
      })),
    }),
    [title, salaryAmount, periodMonth, notes, items],
  );

  const handleSave = useCallback(async () => {
    if (!salaryAmount || salaryAmount <= 0) {
      addToast('Nominal gaji wajib diisi.', 'error');
      return;
    }
    if (!items.length) {
      addToast('Tambahkan minimal satu kategori untuk disimpan.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      let result: SalarySimulationRow;
      if (activeSimulationId) {
        result = await updateSalarySimulation(activeSimulationId, payload);
        addToast('Simulasi diperbarui.', 'success');
      } else {
        result = await createSalarySimulation(payload);
        addToast('Simulasi disimpan.', 'success');
      }
      setActiveSimulationId(result.id);
      loadHistory();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menyimpan simulasi';
      addToast(message, 'error');
    } finally {
      setSaving(false);
    }
  }, [salaryAmount, items, activeSimulationId, buildPayload, addToast, loadHistory]);

  const handleDuplicate = useCallback(async () => {
    if (!activeSimulationId) {
      addToast('Simpan simulasi terlebih dahulu sebelum menduplikasi.', 'info');
      return;
    }
    setDuplicating(true);
    try {
      const clone = await duplicateSalarySimulation(activeSimulationId);
      addToast('Simulasi berhasil diduplikasi.', 'success');
      setActiveSimulationId(clone.id);
      setSalaryAmount(clone.salary_amount);
      setPeriod(normalizePeriod(clone.period_month));
      setTitle(clone.title ?? '');
      setNotes(clone.notes ?? '');
      setItems(sortItems(mapSimulationItems(clone.items, clone.salary_amount, categories)));
      setConfirmApply(false);
      loadHistory();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menduplikasi simulasi';
      addToast(message, 'error');
    } finally {
      setDuplicating(false);
    }
  }, [activeSimulationId, categories, addToast, loadHistory]);

  const handleReset = useCallback(() => {
    setSalaryAmount(0);
    setPeriod(getCurrentPeriod());
    setTitle('');
    setNotes('');
    setItems([]);
    setActiveSimulationId(null);
    setConfirmApply(false);
    try {
      window.localStorage.removeItem(draftKey);
    } catch (_error) {
      // ignore
    }
  }, [draftKey]);

  const handleLoadSimulation = useCallback(
    async (simulationId: string) => {
      try {
        const simulation = await getSalarySimulationById(simulationId, user?.id);
        if (!simulation) {
          addToast('Simulasi tidak ditemukan.', 'error');
          return;
        }
        setActiveSimulationId(simulation.id);
        setSalaryAmount(simulation.salary_amount);
        setPeriod(normalizePeriod(simulation.period_month));
        setTitle(simulation.title ?? '');
        setNotes(simulation.notes ?? '');
        setItems(sortItems(mapSimulationItems(simulation.items, simulation.salary_amount, categories)));
        setConfirmApply(false);
        addToast('Simulasi dimuat.', 'success');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gagal membuka simulasi';
        addToast(message, 'error');
      }
    },
    [user?.id, addToast, categories],
  );

  const handleDeleteSimulation = useCallback(
    async (simulationId: string) => {
      const confirmed = window.confirm('Hapus simulasi ini? Tindakan ini tidak dapat dibatalkan.');
      if (!confirmed) return;
      try {
        await deleteSalarySimulation(simulationId, user?.id ?? undefined);
        addToast('Simulasi dihapus.', 'success');
        if (activeSimulationId === simulationId) {
          handleReset();
        }
        loadHistory();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gagal menghapus simulasi';
        addToast(message, 'error');
      }
    },
    [user?.id, activeSimulationId, addToast, handleReset, loadHistory],
  );

  const renderInsight = () => {
    if (!salaryAmount || salaryAmount <= 0) return 'Masukkan nominal gaji untuk melihat ringkasan.';
    const remainingPercent = salaryAmount > 0 ? roundPercent((remainingSalary / salaryAmount) * 100) : 0;
    const highest = highestAllocation?.categoryName;
    const highestPercent = highestAllocation ? formatPercent(highestAllocation.percent) : null;
    const highestText = highest && highestPercent ? ` Alokasi tertinggi pada “${highest}” ${highestPercent}.` : '';
    const status = remainingSalary >= 0 ? '' : ' - over allocated';
    return `Sisa gaji ${formatCurrency(Math.abs(remainingSalary))} (${formatPercent(Math.abs(remainingPercent))})${status}.${highestText}`;
  };

  return (
    <Page maxWidthClassName="max-w-[1400px]" paddingClassName="px-3 md:px-6">
      <PageHeader title="Simulasi Gajian" description="Uji alokasi gaji ke kategori tanpa mengubah data asli.">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-brand px-5 text-sm font-semibold text-brand-foreground shadow transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Simpan Simulasi
        </button>
        <button
          type="button"
          onClick={handleDuplicate}
          disabled={duplicating || !activeSimulationId}
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-border bg-surface px-4 text-sm font-semibold text-text transition hover:border-[color:var(--accent,#6366f1)] hover:text-[color:var(--accent,#6366f1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,#6366f1)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {duplicating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
          Duplikasi
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-transparent bg-transparent px-3 text-sm font-semibold text-muted underline-offset-4 transition hover:text-text hover:underline focus-visible:outline-none"
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </button>
      </PageHeader>

      <Section first>
        <div className="card space-y-4">
          <header className="flex flex-col gap-2 border-b border-border/60 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-text">Setup Gaji &amp; Periode</h2>
              <p className="text-sm text-muted">Masukkan nominal gaji dan periode simulasi.</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted">
              <Sparkles className="h-4 w-4 text-brand" />
              Simpan untuk membuat riwayat dan bandingkan kapan pun.
            </div>
          </header>
          <div className="grid gap-4 md:grid-cols-2">
            <CurrencyInput
              label="Nominal Gaji"
              value={salaryAmount}
              onChangeNumber={setSalaryAmount}
              placeholder="Masukkan nominal"
            />
            <div className="space-y-1.5">
              <label htmlFor="period" className="text-xs font-medium text-muted">
                Periode Bulan
              </label>
              <input
                id="period"
                type="month"
                value={period}
                onChange={(event) =>
                  setPeriod((prev) => normalizePeriod(event.target.value, prev ?? getCurrentPeriod()))
                }
                className="h-11 w-full rounded-2xl border border-border-subtle bg-surface-alt px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="title" className="text-xs font-medium text-muted">
                Judul Simulasi
              </label>
              <input
                id="title"
                type="text"
                placeholder={`Simulasi Gajian ${toMonthLabel(period)}`}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="h-11 w-full rounded-2xl border border-border-subtle bg-surface-alt px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label htmlFor="notes" className="text-xs font-medium text-muted">
                Catatan (opsional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                className="w-full rounded-2xl border border-border-subtle bg-surface-alt px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                placeholder="Catatan tambahan untuk simulasi ini"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 rounded-2xl bg-surface-alt/70 p-3 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
            <div>
              {budgetsLoading ? (
                <span className="inline-flex items-center gap-2 text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" /> Memuat data budget bulan aktif...
                </span>
              ) : monthlyBudgetTotal > 0 ? (
                <>
                  Total budget bulan ini: <span className="font-semibold text-text">{formatCurrency(monthlyBudgetTotal)}</span>
                </>
              ) : (
                'Belum ada budget bulan ini.'
              )}
            </div>
            <Link
              to="/budgets"
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand transition hover:underline"
            >
              Bandingkan dengan budget bulan ini
              <RefreshCw className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </Section>

      <Section>
        <div className="card space-y-4">
          <header className="flex flex-col gap-2 border-b border-border/60 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-text">Alokasi per Kategori</h2>
              <p className="text-sm text-muted">Atur nominal atau persentase alokasi per kategori pengeluaran.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddCategories(true);
                }}
                disabled={!availableCategories.length || categoriesLoading}
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-border px-4 text-sm font-semibold text-text transition hover:border-brand/50 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" /> Tambah Kategori
              </button>
              <button
                type="button"
                onClick={handleAutoDistribute}
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-border px-4 text-sm font-semibold text-text transition hover:border-brand/50 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              >
                <Sparkles className="h-4 w-4" /> Auto-Distribusi
              </button>
            </div>
          </header>

          {showAddCategories ? (
            <div className="rounded-2xl border border-dashed border-brand/40 bg-brand/5 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-text">Pilih kategori untuk ditambahkan</h3>
                  <p className="text-xs text-muted">Kategori yang sudah dipakai tidak akan muncul di daftar.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedToAdd([]);
                      setShowAddCategories(false);
                    }}
                    className="inline-flex h-9 items-center gap-2 rounded-2xl border border-border px-3 text-xs font-semibold text-muted transition hover:text-text"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleAddSelectedCategories}
                    className="inline-flex h-9 items-center gap-2 rounded-2xl bg-brand px-4 text-xs font-semibold text-brand-foreground transition hover:brightness-105"
                  >
                    Tambahkan
                  </button>
                </div>
              </div>
              <div className="mt-3 grid max-h-64 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                {availableCategories.length ? (
                  availableCategories.map((category) => (
                    <label
                      key={category.id}
                      className="flex items-center gap-2 rounded-2xl border border-border/60 bg-surface-alt px-3 py-2 text-sm text-text hover:border-brand/40"
                    >
                      <input
                        type="checkbox"
                        checked={selectedToAdd.includes(category.id)}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setSelectedToAdd((prev) => {
                            if (checked) {
                              return [...prev, category.id];
                            }
                            return prev.filter((value) => value !== category.id);
                          });
                        }}
                        className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
                      />
                      <span className="flex-1">
                        <span className="font-medium">{category.name}</span>
                        {category.group_name ? (
                          <span className="block text-xs text-muted">{category.group_name}</span>
                        ) : null}
                      </span>
                    </label>
                  ))
                ) : (
                  <div className="rounded-2xl border border-border px-3 py-2 text-sm text-muted">
                    Semua kategori sudah dipakai.
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {items.length ? (
            <div className="space-y-3">
              <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-surface-alt px-4 py-3 text-xs font-semibold text-muted md:grid">
                <div>Kategori</div>
                <div>Nominal (Rp)</div>
                <div>Persentase (%)</div>
                <div className="text-right">Aksi</div>
              </div>
              {items.map((item) => {
                const budget = budgetMap.get(item.categoryId);
                const plannedBudget = Number(budget?.amount_planned ?? 0);
                const difference = item.amount - plannedBudget;
                const differenceClass = clsx(
                  difference === 0 && 'text-muted',
                  difference > 0 && 'text-amber-600 dark:text-amber-300',
                  difference < 0 && 'text-emerald-600 dark:text-emerald-300',
                );
                return (
                  <div
                    key={item.categoryId}
                    className="grid gap-3 rounded-2xl border border-border/70 bg-surface-alt/80 p-4 text-sm text-text transition md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
                  >
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold">{item.categoryName}</div>
                          {item.groupName ? <div className="text-xs text-muted">{item.groupName}</div> : null}
                        </div>
                        {item.color ? (
                          <span
                            className="mt-1 inline-block h-3 w-3 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        <span>Budget: {formatCurrency(plannedBudget)}</span>
                        <span>
                          Selisih:{' '}
                          <span className={differenceClass}>
                            {formatCurrency(difference)}
                          </span>
                        </span>
                      </div>
                    </div>
                    <div>
                      <CurrencyInput
                        label="Nominal"
                        value={item.amount}
                        onChangeNumber={(value) => handleAmountChange(item.categoryId, value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted">Persentase</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={item.percent}
                          onChange={(event) => handlePercentChange(item.categoryId, Number(event.target.value))}
                          className="h-11 w-full rounded-2xl border border-border-subtle bg-surface-alt px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                          min={0}
                          step={0.5}
                        />
                        <button
                          type="button"
                          onClick={() => handleToggleLock(item.categoryId)}
                          className={clsx(
                            'inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                            item.locked
                              ? 'border-brand bg-brand/10 text-brand'
                              : 'border-border bg-surface-alt text-muted hover:text-text',
                          )}
                          title={item.locked ? 'Buka kunci persentase' : 'Kunci persentase'}
                        >
                          {item.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-start justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.categoryId)}
                        className="inline-flex h-10 items-center gap-2 rounded-2xl border border-border px-4 text-xs font-semibold text-muted transition hover:border-rose-400 hover:text-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40"
                      >
                        <Trash2 className="h-4 w-4" /> Hapus
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
              Belum ada kategori yang ditambahkan. Gunakan tombol “Tambah Kategori” untuk memulai.
            </div>
          )}

          {overAllocated ? (
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Total alokasi melebihi nominal gaji. Kurangi beberapa kategori.
              </div>
            </div>
          ) : null}
        </div>
      </Section>

      <Section>
        <div className="card space-y-4">
          <header className="flex flex-col gap-2 border-b border-border/60 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-text">Ringkasan &amp; Grafik</h2>
              <p className="text-sm text-muted">Pantau distribusi gaji dan bandingkan dengan budget aktif.</p>
            </div>
          </header>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-surface-alt/80 p-4">
              <div className="text-xs font-medium text-muted">TOTAL GAJI</div>
              <div className="mt-2 text-xl font-semibold text-text">{formatCurrency(salaryAmount)}</div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-surface-alt/80 p-4">
              <div className="text-xs font-medium text-muted">TOTAL ALOKASI</div>
              <div className="mt-2 text-xl font-semibold text-text">{formatCurrency(totalAllocation)}</div>
              <div className="text-xs text-muted">{formatPercent(allocationPercent)} dari gaji</div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-surface-alt/80 p-4">
              <div className="flex items-center justify-between text-xs font-medium text-muted">
                <span>SISA GAJI</span>
                {overAllocated ? (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-600 dark:bg-rose-500/20 dark:text-rose-200">
                    Over-Allocated
                  </span>
                ) : null}
              </div>
              <div className="mt-2 text-xl font-semibold text-text">{formatCurrency(remainingSalary)}</div>
              <div className="text-xs text-muted">{formatPercent(remainingSalary && salaryAmount ? (remainingSalary / salaryAmount) * 100 : 0)}</div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-surface-alt/80 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-text">
                <PieChartIcon className="h-4 w-4 text-brand" /> Komposisi Alokasi
              </div>
              {chartData.length ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartData} dataKey="value" nameKey="name" innerRadius="60%" outerRadius="80%" paddingAngle={1.5} stroke="none">
                        {chartData.map((entry, index) => (
                          <Cell key={entry.name} fill={entry.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]} />
                        ))}
                        <Label
                          content={({ viewBox }) => {
                            if (!viewBox || !('cx' in viewBox) || !('cy' in viewBox)) return null;
                            const cx = (viewBox as { cx: number }).cx;
                            const cy = (viewBox as { cy: number }).cy;
                            return (
                              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                                <tspan x={cx} y={cy - 6} className="fill-slate-900 text-lg font-semibold dark:fill-slate-100">
                                  {formatPercent(allocationPercent)}
                                </tspan>
                                <tspan x={cx} y={cy + 12} className="fill-slate-500 text-xs font-medium dark:fill-slate-400">
                                  teralokasi
                                </tspan>
                              </text>
                            );
                          }}
                        />
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        labelClassName="text-sm font-semibold"
                        contentStyle={{
                          borderRadius: '12px',
                          border: '1px solid rgba(148,163,184,0.25)',
                          background: 'rgba(255,255,255,0.95)',
                          fontSize: '12px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 rounded-2xl border border-dashed border-border/70 text-sm text-muted">
                  <div className="flex h-full items-center justify-center text-center">
                    Isi alokasi untuk melihat grafik.
                  </div>
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-border/60 bg-surface-alt/80 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-text">
                <BarChart3 className="h-4 w-4 text-brand" /> Alokasi vs Budget Bulan Ini
              </div>
              {hasBudgetComparison && comparisonData.length ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.3)" />
                      <XAxis dataKey="name" hide />
                      <YAxis tickFormatter={(value) => currencyFormatter.format(value).replace('Rp', 'Rp ')} width={90} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar dataKey="allocation" name="Alokasi" radius={[6, 6, 0, 0]} fill="#6366F1" />
                      <Bar dataKey="budget" name="Budget" radius={[6, 6, 0, 0]} fill="#E11D48" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 rounded-2xl border border-dashed border-border/70 text-sm text-muted">
                  <div className="flex h-full items-center justify-center text-center">
                    Belum ada budget bulan ini untuk dibandingkan.
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-surface-alt/80 p-4 text-sm text-muted">
            {renderInsight()}
          </div>

        </div>
      </Section>

      <Section>
        <div className="card space-y-4">
          <header className="flex flex-col gap-2 border-b border-border/60 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-text">Tindakan Lanjutan</h2>
              <p className="text-sm text-muted">Terapkan simulasi ini ke budget bulan aktif jika sudah yakin.</p>
            </div>
          </header>
          <div className="space-y-3">
            <label className="flex items-start gap-3 rounded-2xl border border-border/60 bg-surface-alt/80 p-4 text-sm text-text">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border text-brand focus:ring-brand"
                checked={confirmApply}
                onChange={(event) => setConfirmApply(event.target.checked)}
              />
              <span>
                <span className="font-semibold text-text">Saya paham, ini akan memodifikasi budget bulan ini.</span>
                <span className="block text-xs text-muted">
                  Sistem akan menyalin nilai alokasi ke budget kategori yang sama pada bulan {toMonthLabel(period)}.
                </span>
              </span>
            </label>
            <button
              type="button"
              onClick={applySimulation}
              disabled={!confirmApply || !items.length || applying}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-brand bg-brand/10 px-5 text-sm font-semibold text-brand transition hover:bg-brand/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Terapkan ke Budget
            </button>
            <p className="text-xs text-muted">
              Simulasi tidak mengubah data sampai Anda menerapkan. Anda tetap bisa kembali dan menyesuaikan sebelum menyimpan.
            </p>
            <Link
              to="/budgets"
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand transition hover:underline"
            >
              Kembali ke Budgets
            </Link>
          </div>
        </div>
      </Section>

      <Section>
        <div className="card space-y-4">
          <header className="flex flex-col gap-2 border-b border-border/60 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-text">Riwayat Simulasi</h2>
              <p className="text-sm text-muted">Simpan beberapa skenario dan buka kembali kapan saja.</p>
            </div>
            <button
              type="button"
              onClick={() => loadHistory()}
              className="inline-flex h-10 items-center gap-2 rounded-2xl border border-border px-4 text-sm font-semibold text-text transition hover:border-brand/40 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              <RefreshCw className="h-4 w-4" /> Muat Ulang
            </button>
          </header>

          {historyLoading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memuat riwayat simulasi...
            </div>
          ) : history.length ? (
            <div className="space-y-3">
              {history.map((simulation) => {
                const summary = computeSimulationSummary(simulation);
                const isActive = simulation.id === activeSimulationId;
                return (
                  <div
                    key={simulation.id}
                    className={clsx(
                      'flex flex-col gap-3 rounded-2xl border border-border/60 bg-surface-alt/80 p-4 text-sm text-text md:flex-row md:items-center md:justify-between',
                      isActive && 'border-brand/70 bg-brand/5',
                    )}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-semibold text-text">
                        {simulation.title ?? `Simulasi ${toMonthLabel(simulation.period_month.slice(0, 7))}`}
                        {isActive ? (
                          <span className="rounded-full bg-brand/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
                            Aktif
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted">
                        {toMonthLabel(simulation.period_month.slice(0, 7))} · Total alokasi {formatCurrency(summary.total)} · Sisa{' '}
                        {formatCurrency(summary.remaining)}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleLoadSimulation(simulation.id)}
                        className="inline-flex h-9 items-center gap-2 rounded-2xl border border-border px-3 text-xs font-semibold text-text transition hover:border-brand/40 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                      >
                        Buka
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSimulation(simulation.id)}
                        className="inline-flex h-9 items-center gap-2 rounded-2xl border border-border px-3 text-xs font-semibold text-muted transition hover:border-rose-400 hover:text-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
              Belum ada simulasi tersimpan. Isi form di atas dan tekan “Simpan Simulasi”.
            </div>
          )}
        </div>
      </Section>
    </Page>
  );
}
