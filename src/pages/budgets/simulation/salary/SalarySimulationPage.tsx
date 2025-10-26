import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Copy,
  Download,
  Loader2,
  Lock,
  PieChart as PieChartIcon,
  Plus,
  RefreshCw,
  Save,
  Unlock,
  Wand2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import Page from '../../../../layout/Page';
import PageHeader from '../../../../layout/PageHeader';
import Section from '../../../../layout/Section';
import Card, { CardBody, CardFooter, CardHeader } from '../../../../components/Card';
import { useToast } from '../../../../context/ToastContext';
import { formatCurrency } from '../../../../lib/format';
import { supabase } from '../../../../lib/supabase';
import {
  createSalarySimulation,
  deleteSalarySimulation,
  duplicateSalarySimulation,
  getMonthlyBudgets,
  getSalarySimulations,
  listExpenseCategories,
  updateSalarySimulation,
  type BudgetComparisonRow,
  type ExpenseCategoryOption,
  type SalarySimulationRecord,
  type SalarySimulationSummary,
} from '../../../../lib/salarySimulationApi';
import { upsertBudget } from '../../../../lib/budgetApi';

const DRAFT_STORAGE_KEY = 'hw:salary-simulation-draft';

interface AllocationRow {
  id?: string;
  categoryId: string;
  categoryName: string;
  allocationAmount: number;
  allocationPercent: number;
  notes?: string | null;
  lockPercent: boolean;
}

interface DraftState {
  title: string;
  salaryAmount: number;
  month: string;
  notes: string;
  items: AllocationRow[];
}

interface ApplyState {
  enabled: boolean;
  loading: boolean;
}

const PERCENT_FORMATTER = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' });

function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function monthToLabel(month: string): string {
  try {
    const [year, m] = month.split('-').map((value) => Number.parseInt(value, 10));
    if (!year || !m) return month;
    const label = MONTH_LABEL_FORMATTER.format(new Date(year, m - 1, 1));
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch (error) {
    return month;
  }
}

function monthToISO(month: string): string {
  if (!month) return '';
  if (month.length === 7) {
    return `${month}-01`;
  }
  return month;
}

function isoToMonth(iso: string | null | undefined): string {
  if (!iso) return getCurrentMonth();
  return iso.slice(0, 7);
}

function buildDefaultTitle(month: string): string {
  return `Simulasi Gajian ${monthToLabel(month)}`;
}

function parseNumber(value: string): number {
  const cleaned = value.replace(/[^0-9.,-]/g, '').replace(/[.]/g, '').replace(/,/g, '.');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1000) return 1000;
  return value;
}

function withRemainderAdjustment(rows: AllocationRow[], salary: number): AllocationRow[] {
  if (!rows.length) return rows;
  if (salary <= 0) {
    return rows.map((row) => ({ ...row, allocationPercent: 0 }));
  }
  const unlocked = rows.filter((row) => !row.lockPercent);
  if (!unlocked.length) {
    return rows;
  }
  let total = 0;
  const adjusted = rows.map((row, index) => {
    const amount = Math.max(0, Math.round(row.allocationAmount));
    total += amount;
    const percent = clampPercent((amount / salary) * 100);
    return { ...row, allocationAmount: amount, allocationPercent: percent };
  });
  const diff = salary - total;
  if (Math.abs(diff) > unlocked.length) {
    // adjust diff by distributing to first unlocked row
    const [firstUnlocked] = unlocked;
    const idx = adjusted.findIndex((row) => row.categoryId === firstUnlocked.categoryId);
    if (idx >= 0) {
      const amount = Math.max(0, adjusted[idx].allocationAmount + diff);
      adjusted[idx] = {
        ...adjusted[idx],
        allocationAmount: amount,
        allocationPercent: clampPercent((amount / salary) * 100),
      };
    }
  }
  return adjusted;
}

function computeTotals(items: AllocationRow[], salary: number) {
  const allocations = items.reduce((sum, item) => sum + Number(item.allocationAmount ?? 0), 0);
  const remaining = salary - allocations;
  const usage = salary > 0 ? (allocations / salary) * 100 : 0;
  return { allocations, remaining, usage };
}

function resolveHighestAllocation(items: AllocationRow[]): AllocationRow | null {
  if (!items.length) return null;
  return items.reduce<AllocationRow | null>((prev, current) => {
    if (!prev) return current;
    return current.allocationAmount > prev.allocationAmount ? current : prev;
  }, null);
}

function toCurrency(amount: number): string {
  return formatCurrency(Math.round(amount), 'IDR');
}

function toPercentLabel(percent: number): string {
  return `${PERCENT_FORMATTER.format(percent)}%`;
}

function ensureUnique(rows: AllocationRow[]): AllocationRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.categoryId)) return false;
    seen.add(row.categoryId);
    return true;
  });
}

const FALLBACK_COLORS = ['#16a34a', '#0ea5e9', '#6366f1', '#f97316', '#e11d48', '#0f172a', '#facc15', '#9333ea'];

function resolveColor(index: number): string {
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

export default function SalarySimulationPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [sessionReady, setSessionReady] = useState(false);
  const [activeSimulation, setActiveSimulation] = useState<SalarySimulationRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [history, setHistory] = useState<SalarySimulationSummary[]>([]);
  const [categories, setCategories] = useState<ExpenseCategoryOption[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [budgets, setBudgets] = useState<BudgetComparisonRow[]>([]);
  const [budgetsLoading, setBudgetsLoading] = useState(false);
  const [draft, setDraft] = useState<DraftState>(() => ({
    title: '',
    salaryAmount: 0,
    month: getCurrentMonth(),
    notes: '',
    items: [],
  }));
  const [applyState, setApplyState] = useState<ApplyState>({ enabled: false, loading: false });
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [categorySelection, setCategorySelection] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        if (!data.session) {
          navigate('/auth');
        } else {
          setSessionReady(true);
        }
      })
      .catch(() => {
        if (mounted) navigate('/auth');
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (!session) {
        navigate('/auth');
      } else {
        setSessionReady(true);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    if (!sessionReady) return;
    setCategoriesLoading(true);
    let cancelled = false;
    listExpenseCategories()
      .then((data) => {
        if (!cancelled) setCategories(data);
      })
      .catch((error) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Gagal memuat kategori';
          addToast(message, 'error');
        }
      })
      .finally(() => {
        if (!cancelled) setCategoriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionReady, addToast]);

  const loadHistory = useCallback(() => {
    if (!sessionReady) return;
    setHistoryLoading(true);
    let cancelled = false;
    getSalarySimulations()
      .then((records) => {
        if (!cancelled) setHistory(records);
      })
      .catch((error) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Gagal memuat riwayat simulasi';
          addToast(message, 'error');
        }
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionReady, addToast]);

  useEffect(() => {
    const dispose = loadHistory();
    return () => {
      dispose?.();
    };
  }, [loadHistory]);

  useEffect(() => {
    if (!sessionReady) return;
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DraftState;
        if (parsed && typeof parsed === 'object') {
          setDraft({
            title: parsed.title || '',
            salaryAmount: Number(parsed.salaryAmount ?? 0),
            month: parsed.month || getCurrentMonth(),
            notes: parsed.notes || '',
            items: Array.isArray(parsed.items) ? parsed.items : [],
          });
        }
      }
    } catch (_error) {
      // ignore corrupted draft
    }
  }, [sessionReady]);

  const monthISO = useMemo(() => monthToISO(draft.month), [draft.month]);

  useEffect(() => {
    if (!sessionReady || !monthISO) return;
    setBudgetsLoading(true);
    let cancelled = false;
    getMonthlyBudgets(monthISO)
      .then((rows) => {
        if (!cancelled) setBudgets(rows);
      })
      .catch((error) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Gagal memuat anggaran bulan ini';
          addToast(message, 'error');
        }
      })
      .finally(() => {
        if (!cancelled) setBudgetsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionReady, monthISO, addToast]);

  useEffect(() => {
    if (!sessionReady) return;
    try {
      const data: DraftState = {
        title: draft.title,
        salaryAmount: draft.salaryAmount,
        month: draft.month,
        notes: draft.notes,
        items: draft.items,
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(data));
    } catch (_error) {
      // ignore
    }
  }, [draft, sessionReady]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categories) {
      map.set(category.id, category.name);
    }
    for (const item of draft.items) {
      if (item.categoryId && item.categoryName) {
        map.set(item.categoryId, item.categoryName);
      }
    }
    return map;
  }, [categories, draft.items]);

  const budgetMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of budgets) {
      map.set(row.category_id, Number(row.planned ?? 0));
    }
    return map;
  }, [budgets]);

  const totals = useMemo(() => computeTotals(draft.items, draft.salaryAmount), [draft.items, draft.salaryAmount]);
  const overAllocated = totals.allocations > draft.salaryAmount + 0.01;

  const highestAllocation = useMemo(() => resolveHighestAllocation(draft.items), [draft.items]);

  const overBudgetCategories = useMemo(() => {
    return draft.items
      .map((item) => {
        const budget = budgetMap.get(item.categoryId) ?? 0;
        const delta = item.allocationAmount - budget;
        return { item, budget, delta };
      })
      .filter(({ delta }) => delta > 0.5)
      .sort((a, b) => b.delta - a.delta);
  }, [draft.items, budgetMap]);

  const pieData = useMemo(() => {
    return draft.items
      .filter((item) => item.allocationAmount > 0)
      .map((item, index) => ({
        name: item.categoryName || categoryMap.get(item.categoryId) || 'Tanpa kategori',
        value: Math.round(item.allocationAmount),
        fill: resolveColor(index),
      }));
  }, [draft.items, categoryMap]);

  const barData = useMemo(() => {
    if (!draft.items.length) return [];
    return draft.items.map((item) => {
      const budget = budgetMap.get(item.categoryId) ?? 0;
      return {
        category: item.categoryName || categoryMap.get(item.categoryId) || 'Tanpa kategori',
        alokasi: Math.round(item.allocationAmount),
        anggaran: Math.round(budget),
      };
    });
  }, [draft.items, budgetMap, categoryMap]);

  const budgetSummary = useMemo(() => {
    const planned = budgets.reduce((sum, row) => sum + Number(row.planned ?? 0), 0);
    return { planned };
  }, [budgets]);

  const handleMonthChange = useCallback(
    (nextMonth: string) => {
      setDraft((prev) => ({
        ...prev,
        month: nextMonth,
        title: prev.title ? prev.title : buildDefaultTitle(nextMonth),
      }));
    },
    []
  );

  const handleSalaryChange = useCallback((value: string) => {
    const numeric = value === '' ? 0 : parseNumber(value);
    setDraft((prev) => {
      const nextSalary = Math.max(0, Math.round(numeric));
      const nextItems = prev.items.map((item) => {
        if (item.lockPercent) {
          const amount = Math.round((nextSalary * item.allocationPercent) / 100);
          return { ...item, allocationAmount: amount };
        }
        const percent = nextSalary > 0 ? clampPercent((item.allocationAmount / nextSalary) * 100) : 0;
        return { ...item, allocationPercent: percent };
      });
      return {
        ...prev,
        salaryAmount: nextSalary,
        items: withRemainderAdjustment(nextItems, nextSalary),
      };
    });
  }, []);

  const updateItem = useCallback((categoryId: string, updater: (item: AllocationRow) => AllocationRow) => {
    setDraft((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.categoryId !== categoryId) return item;
        return updater(item);
      }),
    }));
  }, []);

  const handleAmountChange = useCallback(
    (categoryId: string, value: string) => {
      const numeric = value === '' ? 0 : parseNumber(value);
      setDraft((prev) => {
        const nextSalary = prev.salaryAmount || 0;
        const items = prev.items.map((item) => {
          if (item.categoryId !== categoryId) return item;
          const amount = Math.max(0, Math.round(numeric));
          const percent = nextSalary > 0 ? clampPercent((amount / nextSalary) * 100) : 0;
          return { ...item, allocationAmount: amount, allocationPercent: percent };
        });
        return { ...prev, items };
      });
    },
    []
  );

  const handlePercentChange = useCallback((categoryId: string, value: string) => {
    const numeric = value === '' ? 0 : Number.parseFloat(value);
    const percent = clampPercent(Number.isFinite(numeric) ? numeric : 0);
    setDraft((prev) => {
      const salary = prev.salaryAmount || 0;
      const items = prev.items.map((item) => {
        if (item.categoryId !== categoryId) return item;
        const amount = Math.max(0, Math.round((salary * percent) / 100));
        return { ...item, allocationAmount: amount, allocationPercent: percent };
      });
      return { ...prev, items: withRemainderAdjustment(items, salary) };
    });
  }, []);

  const toggleLock = useCallback((categoryId: string) => {
    updateItem(categoryId, (item) => ({ ...item, lockPercent: !item.lockPercent }));
  }, [updateItem]);

  const handleNoteChange = useCallback((categoryId: string, value: string) => {
    updateItem(categoryId, (item) => ({ ...item, notes: value }));
  }, [updateItem]);

  const handleRemoveItem = useCallback((categoryId: string) => {
    setDraft((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.categoryId !== categoryId),
    }));
  }, []);

  const openCategoryPicker = useCallback(() => {
    setCategorySelection([]);
    setCategoryPickerOpen(true);
  }, []);

  const closeCategoryPicker = useCallback(() => {
    setCategoryPickerOpen(false);
    setCategorySelection([]);
  }, []);

  const handleConfirmCategories = useCallback(() => {
    if (!categorySelection.length) {
      closeCategoryPicker();
      return;
    }
    setDraft((prev) => {
      const existing = new Set(prev.items.map((item) => item.categoryId));
      const additions: AllocationRow[] = [];
      for (const id of categorySelection) {
        if (existing.has(id)) continue;
        const name = categoryMap.get(id) ?? categories.find((cat) => cat.id === id)?.name ?? 'Tanpa kategori';
        additions.push({
          categoryId: id,
          categoryName: name,
          allocationAmount: 0,
          allocationPercent: 0,
          notes: null,
          lockPercent: false,
        });
      }
      const nextItems = ensureUnique([...prev.items, ...additions]);
      return { ...prev, items: nextItems };
    });
    closeCategoryPicker();
  }, [categorySelection, categoryMap, categories, closeCategoryPicker]);

  const handleAutoDistribute = useCallback(() => {
    setDraft((prev) => {
      const salary = prev.salaryAmount || 0;
      if (salary <= 0) return prev;
      const lockedTotal = prev.items
        .filter((item) => item.lockPercent)
        .reduce((sum, item) => sum + Number(item.allocationAmount ?? 0), 0);
      const adjustable = prev.items.filter((item) => !item.lockPercent);
      if (!adjustable.length) return prev;
      const remaining = Math.max(0, salary - lockedTotal);
      const nextItems = prev.items.map((item) => {
        if (!item.lockPercent) return item;
        const percent = salary > 0 ? clampPercent((item.allocationAmount / salary) * 100) : 0;
        return { ...item, allocationPercent: percent };
      });

      const budgetWeights = adjustable.map((item) => ({
        id: item.categoryId,
        weight: Math.max(0, budgetMap.get(item.categoryId) ?? 0),
      }));
      const totalWeight = budgetWeights.reduce((sum, row) => sum + row.weight, 0);

      if (totalWeight > 0) {
        let remainingWeight = remaining;
        const distribution = budgetWeights.map((row, index) => {
          if (index === budgetWeights.length - 1) {
            const amount = Math.max(0, remainingWeight);
            remainingWeight = 0;
            return { id: row.id, amount };
          }
          const raw = (remaining * row.weight) / totalWeight;
          const amount = Math.max(0, Math.round(raw));
          remainingWeight -= amount;
          return { id: row.id, amount };
        });
        return {
          ...prev,
          items: nextItems.map((item) => {
            if (item.lockPercent) return item;
            const match = distribution.find((entry) => entry.id === item.categoryId);
            const amount = match ? Math.max(0, match.amount) : 0;
            const percent = salary > 0 ? clampPercent((amount / salary) * 100) : 0;
            return { ...item, allocationAmount: amount, allocationPercent: percent };
          }),
        };
      }

      const adjustableIds = adjustable.map((item) => item.categoryId);
      const base = Math.floor(remaining / adjustableIds.length);
      let remainder = remaining - base * adjustableIds.length;

      return {
        ...prev,
        items: nextItems.map((item) => {
          if (item.lockPercent) return item;
          const index = adjustableIds.indexOf(item.categoryId);
          if (index === -1) return item;
          let amount = base;
          if (index === adjustableIds.length - 1) {
            amount = Math.max(0, remaining - base * (adjustableIds.length - 1));
          } else if (remainder > 0) {
            amount += 1;
            remainder -= 1;
          }
          const percent = salary > 0 ? clampPercent((amount / salary) * 100) : 0;
          return { ...item, allocationAmount: amount, allocationPercent: percent };
        }),
      };
    });
  }, [budgetMap]);

  const resetForm = useCallback(() => {
    setActiveSimulation(null);
    setDraft({
      title: '',
      salaryAmount: 0,
      month: getCurrentMonth(),
      notes: '',
      items: [],
    });
    setApplyState({ enabled: false, loading: false });
  }, []);

  const loadSimulation = useCallback((record: SalarySimulationRecord) => {
    setActiveSimulation(record);
    const month = isoToMonth(record.period_month);
    const mappedItems: AllocationRow[] = (record.items ?? []).map((item) => ({
      id: item.id,
      categoryId: item.category_id,
      categoryName: item.category?.name ?? categoryMap.get(item.category_id) ?? 'Tanpa kategori',
      allocationAmount: Number(item.allocation_amount ?? 0),
      allocationPercent:
        item.allocation_percent == null
          ? record.salary_amount > 0
            ? clampPercent((Number(item.allocation_amount ?? 0) / record.salary_amount) * 100)
            : 0
          : Number(item.allocation_percent ?? 0),
      notes: item.notes ?? null,
      lockPercent: false,
    }));
    setDraft({
      title: record.title ?? buildDefaultTitle(month),
      salaryAmount: Number(record.salary_amount ?? 0),
      month,
      notes: record.notes ?? '',
      items: mappedItems,
    });
    setApplyState({ enabled: false, loading: false });
  }, [categoryMap]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    if (draft.salaryAmount <= 0) {
      addToast('Nominal gaji harus lebih dari 0', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: draft.title?.trim() || null,
        salaryAmount: draft.salaryAmount,
        periodMonth: monthISO,
        notes: draft.notes?.trim() || null,
        items: draft.items.map((item) => ({
          categoryId: item.categoryId,
          allocationAmount: item.allocationAmount,
          allocationPercent: item.allocationPercent,
          notes: item.notes ?? null,
        })),
      };
      let record: SalarySimulationRecord;
      if (activeSimulation) {
        record = await updateSalarySimulation(activeSimulation.id, payload);
        addToast('Simulasi diperbarui', 'success');
      } else {
        record = await createSalarySimulation(payload);
        addToast('Simulasi disimpan', 'success');
      }
      loadSimulation(record);
      loadHistory();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menyimpan simulasi';
      addToast(message, 'error');
    } finally {
      setSaving(false);
    }
  }, [saving, draft, activeSimulation, monthISO, addToast, loadSimulation, loadHistory]);

  const duplicateFromHistory = useCallback(
    async (id: string) => {
      setDuplicating(true);
      try {
        const record = await duplicateSalarySimulation(id);
        addToast('Simulasi diduplikasi', 'success');
        loadHistory();
        loadSimulation(record);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gagal menduplikasi simulasi';
        addToast(message, 'error');
      } finally {
        setDuplicating(false);
      }
    },
    [addToast, loadHistory, loadSimulation]
  );

  const handleDuplicate = useCallback(async () => {
    if (duplicating) return;
    const sourceId = activeSimulation?.id;
    if (!sourceId) {
      addToast('Simpan simulasi terlebih dahulu sebelum duplikasi', 'warning');
      return;
    }
    await duplicateFromHistory(sourceId);
  }, [duplicating, activeSimulation, duplicateFromHistory, addToast]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm('Hapus simulasi ini?')) return;
      try {
        await deleteSalarySimulation(id);
        addToast('Simulasi dihapus', 'success');
        if (activeSimulation?.id === id) {
          resetForm();
        }
        loadHistory();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gagal menghapus simulasi';
        addToast(message, 'error');
      }
    },
    [addToast, activeSimulation, resetForm, loadHistory]
  );

  const handleApplyToBudget = useCallback(async () => {
    if (!applyState.enabled || applyState.loading) return;
    if (!window.confirm('Langkah ini akan menggantikan nominal anggaran bulan ini sesuai simulasi. Lanjutkan?')) {
      return;
    }
    setApplyState((prev) => ({ ...prev, loading: true }));
    try {
      for (const item of draft.items) {
        await upsertBudget({
          category_id: item.categoryId,
          amount_planned: item.allocationAmount,
          carryover_enabled: false,
          notes: item.notes ?? undefined,
          period: draft.month,
        });
      }
      addToast('Anggaran diperbarui dari simulasi', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menerapkan ke anggaran';
      addToast(message, 'error');
    } finally {
      setApplyState({ enabled: false, loading: false });
    }
  }, [applyState, draft.items, draft.month, addToast]);

  const historyEmpty = !history.length && !historyLoading;

  return (
    <Page paddingClassName="px-3 md:px-6" maxWidthClassName="max-w-[1360px]">
      <PageHeader
        title="Simulasi Gajian"
        description="Uji alokasi gaji ke kategori tanpa mengubah data asli."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || draft.salaryAmount <= 0}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-brand px-5 text-sm font-semibold text-brand-foreground shadow transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan Simulasi
            </button>
            <button
              type="button"
              onClick={handleDuplicate}
              disabled={duplicating || !activeSimulation}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-border bg-surface px-4 text-sm font-semibold text-text transition hover:border-brand/40 hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {duplicating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
              Duplikasi
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-transparent bg-transparent px-4 text-sm font-semibold text-muted transition hover:text-text"
            >
              <RefreshCw className="h-4 w-4" />
              Reset
            </button>
          </div>
        }
      />

      <Section first>
        <Card>
          <CardHeader
            title="Setup Gaji & Periode"
            subtext="Tentukan nominal gaji dan periode yang ingin disimulasikan."
          />
          <CardBody className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-text">Nominal Gaji</span>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={draft.salaryAmount}
                  onChange={(event) => handleSalaryChange(event.target.value)}
                  className="h-11 w-full rounded-xl border border-border/70 bg-surface px-3 text-sm font-medium text-text shadow-inner focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/30"
                  placeholder="0"
                />
                <span className="text-xs text-muted">{draft.salaryAmount > 0 ? toCurrency(draft.salaryAmount) : 'Masukkan gaji bersih per bulan'}</span>
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-text">Periode Bulan</span>
                <input
                  type="month"
                  value={draft.month}
                  onChange={(event) => handleMonthChange(event.target.value)}
                  className="h-11 w-full rounded-xl border border-border/70 bg-surface px-3 text-sm font-medium text-text shadow-inner focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
                <span className="text-xs text-muted">Disimpan sebagai {monthISO}</span>
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-text">Judul Simulasi</span>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-border/70 bg-surface px-3 text-sm font-medium text-text shadow-inner focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/30"
                  placeholder={buildDefaultTitle(draft.month)}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-text">Catatan</span>
                <textarea
                  value={draft.notes}
                  onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
                  className="min-h-[44px] rounded-xl border border-border/70 bg-surface px-3 py-2 text-sm font-medium text-text shadow-inner focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/30"
                  placeholder="Opsional"
                />
              </label>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border/70 bg-surface/60 px-4 py-3 text-sm text-muted">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>Anggaran bulan ini: {budgetSummary.planned > 0 ? toCurrency(budgetSummary.planned) : 'Belum ada data'}</span>
                {budgetSummary.planned > 0 ? (
                  <button
                    type="button"
                    onClick={() => navigate('/budgets')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand transition hover:underline"
                  >
                    Bandingkan dengan budget bulan ini
                    <ArrowRight className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
              <span className="text-xs text-muted">Data ini hanya referensi, simulasi tidak akan mengubah anggaran sampai Anda menerapkan.</span>
            </div>
          </CardBody>
        </Card>
      </Section>

      <Section>
        <Card>
          <CardHeader
            title="Alokasi per Kategori"
            subtext="Distribusikan gaji ke setiap kategori pengeluaran."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={openCategoryPicker}
                  disabled={categoriesLoading}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-xs font-semibold text-text transition hover:border-brand/40 hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  <Plus className="h-4 w-4" />
                  Tambah Kategori
                </button>
                <button
                  type="button"
                  onClick={handleAutoDistribute}
                  disabled={!draft.items.length}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-xs font-semibold text-text transition hover:border-brand/40 hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Wand2 className="h-4 w-4" />
                  Auto-Distribusi
                </button>
              </div>
            }
          />
          <CardBody className="space-y-4">
            {overAllocated ? (
              <div className="flex items-start gap-3 rounded-xl border border-danger/40 bg-danger/5 p-3 text-sm text-danger">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <div>
                  Total alokasi melebihi nominal gaji. Sesuaikan nilai agar tidak minus.
                </div>
              </div>
            ) : null}
            <div className="overflow-hidden rounded-xl border border-border/60">
              <div className="hidden min-w-[720px] grid-cols-[1.5fr,1fr,1fr,0.6fr,0.6fr] gap-4 border-b border-border/60 bg-surface-2 px-4 py-3 text-xs font-semibold text-muted md:grid">
                <span>Kategori</span>
                <span>Alokasi (Rp)</span>
                <span>Persentase</span>
                <span>Kunci %</span>
                <span>Aksi</span>
              </div>
              <div className="divide-y divide-border/60">
                {draft.items.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted">
                    Pilih kategori pengeluaran untuk mulai mengalokasikan gaji.
                  </div>
                ) : (
                  draft.items.map((item, index) => {
                    const budget = budgetMap.get(item.categoryId) ?? 0;
                    const delta = item.allocationAmount - budget;
                    const over = delta > 0.5;
                    return (
                      <div
                        key={item.categoryId}
                        className="grid min-w-[720px] grid-cols-1 gap-3 px-4 py-4 text-sm text-text md:grid-cols-[1.5fr,1fr,1fr,0.6fr,0.6fr] md:items-center"
                      >
                        <div className="flex flex-col gap-2">
                          <div className="font-semibold text-text">{item.categoryName || categoryMap.get(item.categoryId) || 'Tanpa kategori'}</div>
                          {over ? (
                            <div className="flex items-center gap-2 text-xs text-danger">
                              <AlertTriangle className="h-3 w-3" />
                              Melebihi budget {toCurrency(Math.abs(delta))}
                            </div>
                          ) : budget > 0 ? (
                            <div className="text-xs text-muted">Budget bulan ini {toCurrency(budget)}</div>
                          ) : null}
                          <textarea
                            value={item.notes ?? ''}
                            onChange={(event) => handleNoteChange(item.categoryId, event.target.value)}
                            placeholder="Catatan kategori (opsional)"
                            className="min-h-[48px] rounded-xl border border-border/60 bg-surface px-3 py-2 text-xs text-text shadow-inner focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/30"
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <input
                            type="number"
                            min={0}
                            step={1000}
                            value={item.allocationAmount}
                            onChange={(event) => handleAmountChange(item.categoryId, event.target.value)}
                            className="h-11 w-full rounded-xl border border-border/60 bg-surface px-3 text-sm font-medium text-text shadow-inner focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/30"
                          />
                          <span className="text-xs text-muted">{toCurrency(item.allocationAmount)}</span>
                        </div>
                        <div className="flex flex-col gap-2">
                          <input
                            type="number"
                            min={0}
                            max={1000}
                            step={0.1}
                            value={item.allocationPercent}
                            onChange={(event) => handlePercentChange(item.categoryId, event.target.value)}
                            className="h-11 w-full rounded-xl border border-border/60 bg-surface px-3 text-sm font-medium text-text shadow-inner focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/30"
                          />
                          <span className="text-xs text-muted">{toPercentLabel(item.allocationPercent)}</span>
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => toggleLock(item.categoryId)}
                            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border/60 bg-surface px-3 text-xs font-semibold text-text transition hover:border-brand/40 hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                          >
                            {item.lockPercent ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                            {item.lockPercent ? 'Terkunci' : 'Kunci'}
                          </button>
                        </div>
                        <div className="flex items-center md:justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.categoryId)}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border/60 bg-surface px-3 text-xs font-semibold text-danger transition hover:border-danger/40 hover:bg-danger/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      </Section>

      <Section>
        <div className="grid gap-4 xl:grid-cols-[2fr,3fr]">
          <Card>
            <CardHeader title="Ringkasan" subtext="Lihat total alokasi dan sisa gaji." />
            <CardBody className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-border/60 bg-surface px-4 py-3">
                  <div className="text-xs text-muted">TOTAL GAJI</div>
                  <div className="mt-1 text-lg font-semibold text-text">{toCurrency(draft.salaryAmount)}</div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-surface px-4 py-3">
                  <div className="text-xs text-muted">TOTAL ALOKASI</div>
                  <div className="mt-1 text-lg font-semibold text-text">{toCurrency(totals.allocations)}</div>
                  <div className="text-xs text-muted">{toPercentLabel(totals.usage)}</div>
                </div>
                <div className={`rounded-2xl border px-4 py-3 ${totals.remaining < 0 ? 'border-danger/60 bg-danger/10 text-danger' : 'border-border/60 bg-surface text-text'}`}>
                  <div className="text-xs text-muted">SISA GAJI</div>
                  <div className="mt-1 text-lg font-semibold">{toCurrency(totals.remaining)}</div>
                  {totals.remaining < 0 ? (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-danger/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-danger">
                      Over-Allocated
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-surface px-4 py-3 text-sm text-text">
                {totals.remaining >= 0 ? (
                  <p>
                    Sisa gaji {toCurrency(totals.remaining)} ({toPercentLabel(100 - totals.usage)}).{' '}
                    {highestAllocation ? `Alokasi tertinggi pada "${highestAllocation.categoryName}" ${toPercentLabel(highestAllocation.allocationPercent)}.` : 'Belum ada alokasi.'}
                  </p>
                ) : (
                  <p>
                    Alokasi melebihi gaji sebesar {toCurrency(Math.abs(totals.remaining))}. Kurangi nilai kategori agar tidak defisit.
                  </p>
                )}
                {overBudgetCategories.length ? (
                  <ul className="mt-3 space-y-1 text-xs text-danger">
                    {overBudgetCategories.slice(0, 3).map(({ item, delta }) => (
                      <li key={item.categoryId}>
                        {item.categoryName}: +{toCurrency(delta)} dibanding budget.
                      </li>
                    ))}
                    {overBudgetCategories.length > 3 ? (
                      <li>Dan {overBudgetCategories.length - 3} kategori lainnya.</li>
                    ) : null}
                  </ul>
                ) : null}
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Grafik" subtext="Visualisasi alokasi dan perbandingan anggaran." />
            <CardBody className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="flex h-64 flex-col rounded-2xl border border-border/60 bg-surface px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-text">
                    <PieChartIcon className="h-4 w-4" /> Komposisi Alokasi
                  </div>
                  <div className="mt-2 flex-1">
                    {pieData.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={80} paddingAngle={2}>
                            {pieData.map((entry, index) => (
                              <Cell key={`${entry.name}-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number, _name, payload) => [toCurrency(value), payload?.name]} />
                          <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted">Belum ada data alokasi.</div>
                    )}
                  </div>
                </div>
                <div className="flex h-64 flex-col rounded-2xl border border-border/60 bg-surface px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-text">
                    <PieChartIcon className="h-4 w-4" /> Alokasi vs Budget
                  </div>
                  <div className="mt-2 flex-1">
                    {barData.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--color-border) / 0.3)" />
                          <XAxis dataKey="category" tick={{ fontSize: 11 }} interval={0} height={60} angle={-15} textAnchor="end" />
                          <YAxis tickFormatter={(value) => `${Math.round(value / 1000)}K`} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(value: number) => toCurrency(value)} />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                          <Bar dataKey="alokasi" fill="#6366f1" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="anggaran" fill="#22c55e" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted">Belum ada data untuk dibandingkan.</div>
                    )}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </Section>

      <Section>
        <Card>
          <CardHeader
            title="Tindakan Lanjutan"
            subtext="Terapkan simulasi ke anggaran setelah Anda yakin."
          />
          <CardBody className="space-y-4">
            <label className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-surface px-4 py-3 text-sm">
              <div className="flex flex-col">
                <span className="font-semibold text-text">Saya paham, ini akan memodifikasi budget bulan ini</span>
                <span className="text-xs text-muted">Aksi ini akan mengganti nominal planned di halaman anggaran.</span>
              </div>
              <button
                type="button"
                onClick={() => setApplyState((prev) => ({ enabled: !prev.enabled, loading: false }))}
                className={`relative inline-flex h-6 w-12 items-center rounded-full transition ${applyState.enabled ? 'bg-brand' : 'bg-border/70'}`}
                aria-pressed={applyState.enabled}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${applyState.enabled ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </label>
            <button
              type="button"
              onClick={handleApplyToBudget}
              disabled={!applyState.enabled || applyState.loading || !draft.items.length}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-danger/40 bg-danger/10 px-4 text-sm font-semibold text-danger transition hover:border-danger/60 hover:bg-danger/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {applyState.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Terapkan ke Budget
            </button>
            <div className="rounded-2xl border border-border/60 bg-surface px-4 py-3 text-xs text-muted">
              Simulasi tidak mengubah data sampai Anda menerapkan.
              <button
                type="button"
                onClick={() => navigate('/budgets')}
                className="ml-2 inline-flex items-center gap-1 font-semibold text-brand hover:underline"
              >
                Kembali ke Budgets
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </CardBody>
        </Card>
      </Section>

      <Section>
        <Card>
          <CardHeader title="Riwayat Simulasi" subtext="Kelola simulasi yang pernah disimpan." />
          <CardBody>
            {historyLoading ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : historyEmpty ? (
              <div className="rounded-2xl border border-border/60 bg-surface px-4 py-6 text-center text-sm text-muted">
                Belum ada simulasi tersimpan.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border/60">
                <table className="min-w-full divide-y divide-border/60 text-sm">
                  <thead className="bg-surface-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-3 text-left">Judul</th>
                      <th className="px-4 py-3 text-left">Bulan</th>
                      <th className="px-4 py-3 text-right">Gaji</th>
                      <th className="px-4 py-3 text-right">Teralokasi</th>
                      <th className="px-4 py-3 text-right">Sisa</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {history.map((item) => (
                      <tr key={item.id} className="hover:bg-surface/70">
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-semibold text-text">{item.title || buildDefaultTitle(isoToMonth(item.period_month))}</span>
                            <span className="text-xs text-muted">Diperbarui {new Date(item.updated_at).toLocaleString('id-ID')}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-text">{monthToLabel(isoToMonth(item.period_month))}</td>
                        <td className="px-4 py-3 text-right text-text">{toCurrency(item.salary_amount)}</td>
                        <td className="px-4 py-3 text-right text-text">{toCurrency(item.totals.allocations)}</td>
                        <td className={`px-4 py-3 text-right ${item.totals.remaining < 0 ? 'text-danger' : 'text-text'}`}>
                          {toCurrency(item.totals.remaining)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => loadSimulation(item)}
                              className="inline-flex items-center rounded-xl border border-border/60 px-3 py-1 text-xs font-semibold text-text transition hover:border-brand/40 hover:bg-brand/5"
                            >
                              Buka
                            </button>
                            <button
                              type="button"
                              onClick={() => duplicateFromHistory(item.id)}
                              className="inline-flex items-center rounded-xl border border-border/60 px-3 py-1 text-xs font-semibold text-text transition hover:border-brand/40 hover:bg-brand/5"
                            >
                              Copy
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              className="inline-flex items-center rounded-xl border border-danger/50 px-3 py-1 text-xs font-semibold text-danger transition hover:border-danger/60 hover:bg-danger/10"
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </Section>

      {categoryPickerOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 px-4 py-6 backdrop-blur">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-text">Pilih Kategori</h3>
                <p className="text-sm text-muted">Kategori yang sudah dipilih tidak akan ditampilkan.</p>
              </div>
              <button
                type="button"
                onClick={closeCategoryPicker}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-muted hover:text-text"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 max-h-[320px] overflow-y-auto rounded-xl border border-border/60">
              <ul className="divide-y divide-border/60">
                {categories
                  .filter((category) => !draft.items.some((item) => item.categoryId === category.id))
                  .map((category) => (
                    <li key={category.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                      <input
                        type="checkbox"
                        checked={categorySelection.includes(category.id)}
                        onChange={(event) => {
                          setCategorySelection((prev) => {
                            const next = new Set(prev);
                            if (event.target.checked) {
                              next.add(category.id);
                            } else {
                              next.delete(category.id);
                            }
                            return Array.from(next);
                          });
                        }}
                        className="h-4 w-4 rounded border-border/60"
                      />
                      <div className="flex flex-col">
                        <span className="font-semibold text-text">{category.name}</span>
                        {category.group_name ? <span className="text-xs text-muted">{category.group_name}</span> : null}
                      </div>
                    </li>
                  ))}
                {!categoriesLoading &&
                categories.filter((category) => !draft.items.some((item) => item.categoryId === category.id)).length === 0 ? (
                  <li className="px-4 py-6 text-center text-sm text-muted">Semua kategori sudah digunakan.</li>
                ) : null}
              </ul>
            </div>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeCategoryPicker}
                className="inline-flex h-10 items-center rounded-xl border border-border/60 px-4 text-sm font-semibold text-text"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmCategories}
                className="inline-flex h-10 items-center rounded-xl bg-brand px-5 text-sm font-semibold text-brand-foreground"
              >
                Tambahkan
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Page>
  );
}
