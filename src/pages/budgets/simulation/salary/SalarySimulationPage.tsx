import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Copy,
  History,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Unlock,
  Wand2,
} from 'lucide-react';
import clsx from 'clsx';
import Page from '../../../../layout/Page';
import PageHeader from '../../../../layout/PageHeader';
import Section from '../../../../layout/Section';
import Card, { CardBody, CardHeader } from '../../../../components/Card';
import CurrencyInput from '../../../../components/ui/CurrencyInput.jsx';
import Input from '../../../../components/ui/Input.jsx';
import Textarea from '../../../../components/ui/Textarea.jsx';
import { useToast } from '../../../../context/ToastContext';
import useSupabaseUser from '../../../../hooks/useSupabaseUser';
import { supabase } from '../../../../lib/supabase';
import Modal from '../../../../components/Modal.jsx';
import {
  applySalarySimulationToBudget,
  createSalarySimulation,
  deleteSalarySimulation,
  duplicateSalarySimulation,
  getMonthlyBudgets,
  getSalarySimulation,
  getSalarySimulations,
  listExpenseCategories,
  updateSalarySimulation,
  type ExpenseCategorySummary,
  type MonthlyBudgetSummary,
  type SalarySimulationItemRecord,
  type SalarySimulationListItem,
  type SalarySimulationRecord,
  type SalarySimulationUpsertInput,
} from '../../../../lib/salarySimulationApi';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Label,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';

type AllocationRow = {
  categoryId: string;
  allocationAmount: number;
  allocationPercent: number;
  notes: string;
  locked: boolean;
};

type DraftPayload = {
  selectedId: string | null;
  period: string;
  salaryAmount: number;
  title: string;
  notes: string;
  items: AllocationRow[];
};

const MONTH_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  month: 'long',
  year: 'numeric',
});

const CURRENCY_FORMATTER = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const NUMBER_FORMATTER = new Intl.NumberFormat('id-ID');

const COLOR_PALETTE = ['#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#f97316', '#ef4444', '#a855f7', '#f472b6', '#14b8a6', '#64748b'];

function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function periodToIso(period: string): string {
  const [year, month] = period.split('-');
  if (!year || !month) return `${period}-01`;
  return `${year}-${month.padStart(2, '0')}-01`;
}

function isoToPeriod(periodMonth: string | null | undefined): string {
  if (!periodMonth) return getCurrentPeriod();
  return periodMonth.slice(0, 7);
}

function formatMonthLabel(period: string): string {
  try {
    const [yearStr, monthStr] = period.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return period;
    return MONTH_FORMATTER.format(new Date(year, month - 1, 1));
  } catch (error) {
    return period;
  }
}

function formatCurrency(value: number): string {
  return CURRENCY_FORMATTER.format(Math.round(value ?? 0));
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return NUMBER_FORMATTER.format(Math.round(value));
}

function calculatePercent(amount: number, salary: number): number {
  if (!salary || salary <= 0) return 0;
  const percent = (Number(amount ?? 0) / salary) * 100;
  return Number(percent.toFixed(2));
}

function buildDefaultTitle(period: string): string {
  return `Simulasi Gajian ${formatMonthLabel(period)}`;
}

function mapItemsToRows(items: SalarySimulationItemRecord[], salaryAmount: number): AllocationRow[] {
  return items.map((item) => ({
    categoryId: item.category_id,
    allocationAmount: Number(item.allocation_amount ?? 0),
    allocationPercent:
      item.allocation_percent === null || item.allocation_percent === undefined
        ? calculatePercent(Number(item.allocation_amount ?? 0), salaryAmount)
        : Number(item.allocation_percent ?? 0),
    notes: item.notes ?? '',
    locked: false,
  }));
}

function sanitizeDraft(draft: unknown): DraftPayload | null {
  if (!draft || typeof draft !== 'object') return null;
  const candidate = draft as Record<string, unknown>;
  const items = Array.isArray(candidate.items)
    ? candidate.items
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const record = item as Record<string, unknown>;
          const categoryId = typeof record.categoryId === 'string' ? record.categoryId : null;
          if (!categoryId) return null;
          return {
            categoryId,
            allocationAmount: Number(record.allocationAmount ?? 0),
            allocationPercent: Number(record.allocationPercent ?? 0),
            notes: typeof record.notes === 'string' ? record.notes : '',
            locked: Boolean(record.locked),
          } satisfies AllocationRow;
        })
        .filter(Boolean)
    : [];

  return {
    selectedId: typeof candidate.selectedId === 'string' ? candidate.selectedId : null,
    period: typeof candidate.period === 'string' ? candidate.period : getCurrentPeriod(),
    salaryAmount: Number(candidate.salaryAmount ?? 0),
    title: typeof candidate.title === 'string' ? candidate.title : '',
    notes: typeof candidate.notes === 'string' ? candidate.notes : '',
    items,
  } satisfies DraftPayload;
}

function useDraftStorage(userId: string | null, payload: DraftPayload) {
  const [draft, setDraft] = useState<DraftPayload | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!userId) {
      setDraft(null);
      setReady(true);
      return;
    }
    setReady(false);
    const key = `hw:salary-sim:${userId}`;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        setDraft(null);
      } else {
        const parsed = JSON.parse(raw);
        const sanitized = sanitizeDraft(parsed);
        setDraft(sanitized);
      }
    } catch (error) {
      console.warn('Gagal memuat draft simulasi gajian', error);
      setDraft(null);
    } finally {
      setReady(true);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId || !ready) return;
    const key = `hw:salary-sim:${userId}`;
    try {
      const serializable: DraftPayload = {
        selectedId: payload.selectedId,
        period: payload.period,
        salaryAmount: payload.salaryAmount,
        title: payload.title,
        notes: payload.notes,
        items: payload.items,
      };
      window.localStorage.setItem(key, JSON.stringify(serializable));
    } catch (error) {
      console.warn('Gagal menyimpan draft simulasi gajian', error);
    }
  }, [userId, ready, payload]);

  return { draft, ready } as const;
}

function CurrencyCell({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  const [display, setDisplay] = useState(() => (value ? formatNumber(value) : ''));

  useEffect(() => {
    setDisplay(value ? formatNumber(value) : '');
  }, [value]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value.replace(/[^0-9]/g, '');
    const nextValue = raw ? Number(raw) : 0;
    setDisplay(raw ? formatNumber(nextValue) : '');
    onChange(nextValue);
  };

  const handleBlur = () => {
    setDisplay(value ? formatNumber(value) : '');
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
      className="w-full rounded-xl border border-border-subtle bg-surface px-3 py-2 text-right text-sm font-medium text-text focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary/45"
      placeholder="0"
    />
  );
}

export default function SalarySimulationPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user, loading: userLoading } = useSupabaseUser();
  const [authChecked, setAuthChecked] = useState(false);

  const [period, setPeriod] = useState<string>(getCurrentPeriod());
  const [salaryAmount, setSalaryAmount] = useState<number>(0);
  const [title, setTitle] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [items, setItems] = useState<AllocationRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [applyConfirmation, setApplyConfirmation] = useState(false);

  const [categories, setCategories] = useState<ExpenseCategorySummary[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [budgets, setBudgets] = useState<MonthlyBudgetSummary[]>([]);
  const [budgetsLoading, setBudgetsLoading] = useState(false);
  const [history, setHistory] = useState<SalarySimulationListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [selectedAddCategories, setSelectedAddCategories] = useState<Set<string>>(new Set());

  const periodIso = useMemo(() => periodToIso(period), [period]);
  const defaultTitle = useMemo(() => buildDefaultTitle(period), [period]);
  const lastAppliedDefault = useRef<string | null>(null);

  const draftPayloadRef = useRef<DraftPayload>({
    selectedId,
    period,
    salaryAmount,
    title,
    notes,
    items,
  });

  draftPayloadRef.current = {
    selectedId,
    period,
    salaryAmount,
    title,
    notes,
    items,
  };

  const { draft: storedDraft, ready: draftReady } = useDraftStorage(user?.id ?? null, draftPayloadRef.current);
  const draftAppliedRef = useRef(false);

  useEffect(() => {
    if (!draftReady || draftAppliedRef.current) return;
    draftAppliedRef.current = true;
    if (!storedDraft) return;
    setSelectedId(storedDraft.selectedId);
    setPeriod(storedDraft.period);
    setSalaryAmount(storedDraft.salaryAmount);
    setTitle(storedDraft.title);
    setNotes(storedDraft.notes);
    setItems(storedDraft.items);
  }, [draftReady, storedDraft]);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) {
        navigate('/auth', { replace: true });
      }
      setAuthChecked(true);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate('/auth', { replace: true });
      }
    });
    return () => {
      active = false;
      subscription.subscription?.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    if (selectedId) {
      lastAppliedDefault.current = defaultTitle;
      return;
    }
    setTitle((prev) => {
      if (!prev || prev === lastAppliedDefault.current) {
        lastAppliedDefault.current = defaultTitle;
        return defaultTitle;
      }
      return prev;
    });
  }, [defaultTitle, selectedId]);

  useEffect(() => {
    if (!user?.id || !draftReady) return;
    let cancelled = false;
    setCategoriesLoading(true);
    listExpenseCategories(user.id)
      .then((data) => {
        if (cancelled) return;
        setCategories(data);
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Gagal memuat kategori';
        addToast(message, 'error');
      })
      .finally(() => {
        if (cancelled) return;
        setCategoriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, draftReady, addToast]);

  const loadBudgets = useCallback(() => {
    if (!user?.id) return;
    setBudgetsLoading(true);
    getMonthlyBudgets(user.id, periodIso)
      .then((data) => {
        setBudgets(data);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Gagal memuat data anggaran';
        addToast(message, 'error');
        setBudgets([]);
      })
      .finally(() => {
        setBudgetsLoading(false);
      });
  }, [user?.id, periodIso, addToast]);

  useEffect(() => {
    if (!user?.id || !draftReady) return;
    loadBudgets();
  }, [user?.id, loadBudgets, draftReady]);

  const loadHistory = useCallback(() => {
    if (!user?.id) return;
    setHistoryLoading(true);
    getSalarySimulations(user.id)
      .then((rows) => {
        setHistory(rows);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Gagal memuat riwayat simulasi';
        addToast(message, 'error');
        setHistory([]);
      })
      .finally(() => {
        setHistoryLoading(false);
      });
  }, [user?.id, addToast]);

  useEffect(() => {
    if (!user?.id || !draftReady) return;
    loadHistory();
  }, [user?.id, loadHistory, draftReady]);

  useEffect(() => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        allocationPercent: calculatePercent(item.allocationAmount, salaryAmount),
      }))
    );
  }, [salaryAmount]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, ExpenseCategorySummary>();
    categories.forEach((category) => {
      map.set(category.id, category);
    });
    return map;
  }, [categories]);

  const budgetsMap = useMemo(() => {
    const map = new Map<string, number>();
    budgets.forEach((budget) => {
      map.set(budget.category_id, Number(budget.amount_planned ?? 0));
    });
    return map;
  }, [budgets]);

  const budgetsPlannedTotal = useMemo(() => {
    return budgets.reduce((total, budget) => total + Number(budget.amount_planned ?? 0), 0);
  }, [budgets]);

  const totalAllocation = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.allocationAmount ?? 0), 0),
    [items]
  );
  const remainingSalary = useMemo(() => salaryAmount - totalAllocation, [salaryAmount, totalAllocation]);
  const allocationRatio = useMemo(
    () => (salaryAmount > 0 ? totalAllocation / salaryAmount : 0),
    [totalAllocation, salaryAmount]
  );

  const highestAllocation = useMemo(() => {
    if (!items.length) return null;
    const sorted = [...items].sort((a, b) => b.allocationAmount - a.allocationAmount);
    return sorted[0];
  }, [items]);

  const overBudgetCategories = useMemo(() => {
    return items
      .map((item) => {
        const planned = budgetsMap.get(item.categoryId) ?? 0;
        const delta = item.allocationAmount - planned;
        return {
          item,
          planned,
          delta,
        };
      })
      .filter((entry) => entry.delta > 0);
  }, [items, budgetsMap]);

  const pieData = useMemo(() => {
    if (!salaryAmount || salaryAmount <= 0) {
      return items.map((item) => ({
        name: categoryMap.get(item.categoryId)?.name ?? 'Tanpa kategori',
        value: item.allocationAmount,
        percent: 0,
        categoryId: item.categoryId,
      }));
    }
    return items.map((item) => ({
      name: categoryMap.get(item.categoryId)?.name ?? 'Tanpa kategori',
      value: item.allocationAmount,
      percent: (item.allocationAmount / salaryAmount) * 100,
      categoryId: item.categoryId,
    }));
  }, [items, categoryMap, salaryAmount]);

  const comparisonData = useMemo(() => {
    return items.map((item) => ({
      name: categoryMap.get(item.categoryId)?.name ?? 'Tanpa kategori',
      allocated: item.allocationAmount,
      budget: budgetsMap.get(item.categoryId) ?? 0,
    }));
  }, [items, categoryMap, budgetsMap]);

  const insightText = useMemo(() => {
    if (salaryAmount <= 0) {
      return 'Isi nominal gaji untuk mulai simulasi alokasi.';
    }
    const remainingAbs = Math.abs(remainingSalary);
    const remainingPercent = salaryAmount > 0 ? Math.round((remainingAbs / salaryAmount) * 100) : 0;
    const base =
      remainingSalary >= 0
        ? `Sisa gaji ${formatCurrency(remainingSalary)} (${remainingPercent}%).`
        : `Defisit gaji ${formatCurrency(remainingAbs)} (${remainingPercent}%).`;
    if (!highestAllocation) return base;
    const categoryName = categoryMap.get(highestAllocation.categoryId)?.name ?? 'Tanpa kategori';
    const highestPercent = Math.round(
      highestAllocation.allocationPercent ??
        calculatePercent(highestAllocation.allocationAmount, salaryAmount)
    );
    return `${base} Alokasi tertinggi pada '${categoryName}' ${highestPercent}%.`;
  }, [salaryAmount, remainingSalary, highestAllocation, categoryMap]);

  const availableCategories = useMemo(() => {
    const used = new Set(items.map((item) => item.categoryId));
    return categories.filter((category) => !used.has(category.id));
  }, [items, categories]);

  const handleAddCategories = useCallback(
    (categoryIds: string[]) => {
      if (!categoryIds.length) return;
      setItems((prev) => {
        const existing = new Set(prev.map((item) => item.categoryId));
        const next = [...prev];
        categoryIds.forEach((categoryId) => {
          if (existing.has(categoryId)) return;
          next.push({
            categoryId,
            allocationAmount: 0,
            allocationPercent: 0,
            notes: '',
            locked: false,
          });
        });
        return next;
      });
    },
    []
  );

  const handleAmountChange = useCallback(
    (categoryId: string, amount: number) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.categoryId !== categoryId) return item;
          const safeAmount = Math.max(0, amount || 0);
          return {
            ...item,
            allocationAmount: safeAmount,
            allocationPercent: calculatePercent(safeAmount, salaryAmount),
          };
        })
      );
    },
    [salaryAmount]
  );

  const handlePercentChange = useCallback(
    (categoryId: string, percent: number) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.categoryId !== categoryId) return item;
          const safePercent = Math.min(100, Math.max(0, percent || 0));
          const amount = salaryAmount > 0 ? Math.round((salaryAmount * safePercent) / 100) : 0;
          return {
            ...item,
            allocationPercent: Number(safePercent.toFixed(2)),
            allocationAmount: amount,
          };
        })
      );
    },
    [salaryAmount]
  );

  const handleToggleLock = useCallback((categoryId: string, locked: boolean) => {
    setItems((prev) =>
      prev.map((item) => (item.categoryId === categoryId ? { ...item, locked } : item))
    );
  }, []);

  const handleRemoveItem = useCallback((categoryId: string) => {
    setItems((prev) => prev.filter((item) => item.categoryId !== categoryId));
  }, []);

  const handleAutoDistribute = useCallback(() => {
    if (salaryAmount <= 0) {
      addToast('Isi nominal gaji terlebih dahulu', 'warning');
      return;
    }
    const unlocked = items.filter((item) => !item.locked);
    if (unlocked.length === 0) {
      addToast('Semua kategori terkunci. Buka kunci untuk mendistribusikan ulang.', 'info');
      return;
    }
    const lockedTotal = items
      .filter((item) => item.locked)
      .reduce((sum, item) => sum + Number(item.allocationAmount ?? 0), 0);
    const remaining = salaryAmount - lockedTotal;
    const unlockedIds = unlocked.map((item) => item.categoryId);
    const totalBudgetWeight = unlockedIds.reduce((sum, id) => sum + (budgetsMap.get(id) ?? 0), 0);

    const newAmounts = new Map<string, number>();
    if (remaining <= 0) {
      unlockedIds.forEach((id) => newAmounts.set(id, 0));
    } else if (totalBudgetWeight > 0) {
      let runningTotal = 0;
      unlockedIds.forEach((categoryId, index) => {
        const weight = budgetsMap.get(categoryId) ?? 0;
        let amount: number;
        if (index === unlockedIds.length - 1) {
          amount = Math.max(0, remaining - runningTotal);
        } else {
          amount = Math.max(0, Math.round((remaining * weight) / totalBudgetWeight));
          runningTotal += amount;
        }
        newAmounts.set(categoryId, amount);
      });
      const allocated = Array.from(newAmounts.values()).reduce((sum, value) => sum + value, 0);
      if (allocated !== remaining && unlockedIds.length > 0) {
        const lastId = unlockedIds[unlockedIds.length - 1];
        newAmounts.set(lastId, Math.max(0, (newAmounts.get(lastId) ?? 0) + (remaining - allocated)));
      }
    } else {
      const evenShare = remaining / unlockedIds.length;
      let runningTotal = 0;
      unlockedIds.forEach((categoryId, index) => {
        let amount: number;
        if (index === unlockedIds.length - 1) {
          amount = Math.max(0, remaining - runningTotal);
        } else {
          amount = Math.max(0, Math.round(evenShare));
          runningTotal += amount;
        }
        newAmounts.set(categoryId, amount);
      });
      const allocated = Array.from(newAmounts.values()).reduce((sum, value) => sum + value, 0);
      if (allocated !== remaining && unlockedIds.length > 0) {
        const lastId = unlockedIds[unlockedIds.length - 1];
        newAmounts.set(lastId, Math.max(0, (newAmounts.get(lastId) ?? 0) + (remaining - allocated)));
      }
    }

    setItems((prev) =>
      prev.map((item) => {
        if (!newAmounts.has(item.categoryId)) {
          return {
            ...item,
            allocationPercent: calculatePercent(item.allocationAmount, salaryAmount),
          };
        }
        const amount = newAmounts.get(item.categoryId) ?? 0;
        return {
          ...item,
          allocationAmount: amount,
          allocationPercent: calculatePercent(amount, salaryAmount),
        };
      })
    );
  }, [items, budgetsMap, salaryAmount, addToast]);

  const setFromSimulation = useCallback((simulation: SalarySimulationRecord) => {
    setSelectedId(simulation.id);
    setApplyConfirmation(false);
    setSalaryAmount(Number(simulation.salary_amount ?? 0));
    const periodValue = isoToPeriod(simulation.period_month);
    setPeriod(periodValue);
    setTitle(simulation.title ?? '');
    setNotes(simulation.notes ?? '');
    setItems(mapItemsToRows(simulation.items ?? [], Number(simulation.salary_amount ?? 0)));
  }, []);

  const handleSave = useCallback(async () => {
    if (salaryAmount <= 0) {
      addToast('Nominal gaji harus lebih dari 0', 'error');
      return;
    }
    const payload: SalarySimulationUpsertInput = {
      title: title || null,
      salary_amount: Number(salaryAmount ?? 0),
      period_month: periodIso,
      notes: notes || null,
      items: items.map((item) => ({
        category_id: item.categoryId,
        allocation_amount: Number(item.allocationAmount ?? 0),
        allocation_percent: item.allocationPercent,
        notes: item.notes || null,
      })),
    };
    setSaving(true);
    try {
      const simulation = selectedId
        ? await updateSalarySimulation(selectedId, payload)
        : await createSalarySimulation(payload);
      setFromSimulation(simulation);
      loadHistory();
      addToast('Simulasi berhasil disimpan', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menyimpan simulasi';
      addToast(message, 'error');
    } finally {
      setSaving(false);
    }
  }, [salaryAmount, title, notes, items, selectedId, periodIso, addToast, loadHistory, setFromSimulation]);

  const handleDuplicate = useCallback(
    async (sourceId?: string) => {
      setSaving(true);
      try {
        if (sourceId) {
          const duplicated = await duplicateSalarySimulation(sourceId);
          setFromSimulation(duplicated);
        } else if (selectedId) {
          const duplicated = await duplicateSalarySimulation(selectedId);
          setFromSimulation(duplicated);
        } else {
          const duplicated = await createSalarySimulation({
            title: `${title || defaultTitle} (Salinan)`,
            salary_amount: salaryAmount,
            period_month: periodIso,
            notes,
            items: items.map((item) => ({
              category_id: item.categoryId,
              allocation_amount: item.allocationAmount,
              allocation_percent: item.allocationPercent,
              notes: item.notes || null,
            })),
          });
          setFromSimulation(duplicated);
        }
        loadHistory();
        addToast('Simulasi berhasil diduplikasi', 'success');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gagal menduplikasi simulasi';
        addToast(message, 'error');
      } finally {
        setSaving(false);
      }
    },
    [selectedId, title, defaultTitle, salaryAmount, periodIso, notes, items, setFromSimulation, loadHistory, addToast]
  );

  const handleReset = useCallback(() => {
    setSelectedId(null);
    setApplyConfirmation(false);
    setSalaryAmount(0);
    setTitle('');
    setNotes('');
    setItems([]);
  }, []);

  const handleOpenSimulation = useCallback(
    async (id: string) => {
      setWorking(true);
      try {
        const simulation = await getSalarySimulation(id);
        if (!simulation) {
          addToast('Simulasi tidak ditemukan', 'error');
          return;
        }
        setFromSimulation(simulation);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gagal membuka simulasi';
        addToast(message, 'error');
      } finally {
        setWorking(false);
      }
    },
    [addToast, setFromSimulation]
  );

  const handleDeleteSimulation = useCallback(
    async (id: string) => {
      const confirmed = window.confirm('Hapus simulasi ini? Tindakan tidak dapat dibatalkan.');
      if (!confirmed) return;
      setWorking(true);
      try {
        await deleteSalarySimulation(id);
        if (selectedId === id) {
          handleReset();
        }
        loadHistory();
        addToast('Simulasi dihapus', 'success');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gagal menghapus simulasi';
        addToast(message, 'error');
      } finally {
        setWorking(false);
      }
    },
    [selectedId, handleReset, loadHistory, addToast]
  );

  const handleApplyToBudget = useCallback(async () => {
    if (!selectedId) {
      addToast('Simpan simulasi terlebih dahulu sebelum menerapkan.', 'warning');
      return;
    }
    const confirmed = window.confirm(
      'Terapkan hasil simulasi ke anggaran bulan ini? Ini akan memperbarui nilai budget.'
    );
    if (!confirmed) return;
    setWorking(true);
    try {
      await applySalarySimulationToBudget(selectedId);
      addToast('Anggaran berhasil diperbarui dari simulasi', 'success');
      loadBudgets();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menerapkan ke anggaran';
      addToast(message, 'error');
    } finally {
      setWorking(false);
    }
  }, [selectedId, addToast, loadBudgets]);

  const renderActions = (
    <>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={handleReset}
        disabled={saving || working}
      >
        <RotateCcw className="mr-2 h-4 w-4" /> Reset
      </button>
      <button
        type="button"
        className="btn btn-outline"
        onClick={handleDuplicate}
        disabled={saving || working}
      >
        <Copy className="mr-2 h-4 w-4" /> Duplikasi
      </button>
      <button
        type="button"
        className="btn btn-primary"
        onClick={handleSave}
        disabled={saving || working}
      >
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Simpan Simulasi
      </button>
    </>
  );

  const renderWarning = remainingSalary < 0;

  const availableColors = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((category, index) => {
      const color = category.color ?? COLOR_PALETTE[index % COLOR_PALETTE.length];
      map.set(category.id, color);
    });
    return map;
  }, [categories]);

  const pieChart = (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={pieData}
          dataKey="value"
          nameKey="name"
          innerRadius={70}
          outerRadius={110}
          paddingAngle={2}
        >
          {pieData.map((entry, index) => (
            <Cell
              key={entry.categoryId ?? index}
              fill={availableColors.get(entry.categoryId) ?? COLOR_PALETTE[index % COLOR_PALETTE.length]}
            />
          ))}
          <Label
            value={`${Math.round(allocationRatio * 100)}%`}
            position="center"
            className="text-lg font-semibold text-text"
          />
        </Pie>
        <Tooltip formatter={(value: number) => formatCurrency(value)} labelFormatter={(label) => label} />
      </PieChart>
    </ResponsiveContainer>
  );

  const barChart = (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={comparisonData} margin={{ left: 0, right: 0, bottom: 0, top: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 12 }}
          interval={0}
          angle={-15}
          textAnchor="end"
          height={70}
        />
        <YAxis tickFormatter={(value) => `Rp${NUMBER_FORMATTER.format(Number(value ?? 0) / 1000)}k`} width={70} />
        <Legend />
        <Tooltip formatter={(value: number) => formatCurrency(value)} />
        <Bar dataKey="budget" name="Budget" fill="#94a3b8" radius={[4, 4, 0, 0]} />
        <Bar dataKey="allocated" name="Simulasi" fill="#2563eb" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );

  const handleModalConfirm = () => {
    handleAddCategories(Array.from(selectedAddCategories));
    setSelectedAddCategories(new Set());
    setAddCategoryOpen(false);
  };

  const handleModalClose = () => {
    setSelectedAddCategories(new Set());
    setAddCategoryOpen(false);
  };

  if (!authChecked || userLoading) {
    return (
      <Page>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted" />
        </div>
      </Page>
    );
  }

  return (
    <Page className="pb-24">
      <PageHeader
        title="Simulasi Gajian"
        description="Uji alokasi gaji ke kategori tanpa mengubah data asli."
      >
        {renderActions}
      </PageHeader>

      <Section first>
        <Card>
          <CardHeader
            title="Setup Gaji & Periode"
            subtext="Tentukan nominal gaji dan konteks periode sebelum mulai alokasi."
          />
          <CardBody className="grid gap-4 lg:grid-cols-2">
            <CurrencyInput
              label="Nominal Gaji"
              value={salaryAmount}
              onChangeNumber={(value: number) => setSalaryAmount(value)}
              helper="Masukkan nominal gaji bersih yang akan dialokasikan."
              error={salaryAmount <= 0 ? 'Nominal wajib lebih dari 0' : undefined}
            />
            <Input
              label="Periode Bulan"
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              helper="Disimpan sebagai tanggal awal bulan (YYYY-MM-01)."
            />
            <Input
              label="Judul Simulasi"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              helper="Opsional, kosongkan untuk default."
            />
            <Textarea
              label="Catatan"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Catatan tambahan untuk simulasi ini"
            />
            <div className="lg:col-span-2 rounded-xl border border-border-subtle bg-surface-alt p-4 text-sm text-muted">
              {budgetsLoading ? (
                <div className="flex items-center gap-2 text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" /> Memuat ringkasan anggaran bulan ini...
                </div>
              ) : budgetsPlannedTotal > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Total budget terencana bulan ini: <span className="font-semibold text-text">{formatCurrency(budgetsPlannedTotal)}</span>
                  </span>
                  <Link to="/budgets" className="text-sm font-medium text-primary underline">
                    Bandingkan dengan budget bulan ini
                  </Link>
                </div>
              ) : (
                <span>Belum ada budget bulan ini. Tambahkan di halaman Budgets untuk perbandingan proporsional.</span>
              )}
            </div>
          </CardBody>
        </Card>
      </Section>

      <Section>
        <Card>
          <CardHeader
            title="Alokasi per Kategori"
            subtext="Tetapkan nominal dan persentase per kategori pengeluaran."
            actions={
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setSelectedAddCategories(new Set());
                    setAddCategoryOpen(true);
                  }}
                  disabled={categoriesLoading || availableCategories.length === 0}
                >
                  <Plus className="mr-2 h-4 w-4" /> Tambah Kategori
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleAutoDistribute}
                  disabled={items.length === 0}
                >
                  <Wand2 className="mr-2 h-4 w-4" /> Auto-Distribusi
                </button>
              </div>
            }
          />
          <CardBody>
            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border-subtle p-6 text-center text-sm text-muted">
                Pilih kategori pengeluaran untuk mulai mengalokasikan gaji.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="hidden overflow-hidden rounded-xl border border-border-subtle md:block">
                  <table className="min-w-full divide-y divide-border-subtle">
                    <thead className="bg-surface-alt">
                      <tr className="text-left text-xs uppercase tracking-wide text-muted">
                        <th className="px-4 py-3">Kategori</th>
                        <th className="px-4 py-3 text-right">Nominal (Rp)</th>
                        <th className="px-4 py-3 text-right">Persentase</th>
                        <th className="px-4 py-3 text-center">Lock %</th>
                        <th className="px-4 py-3">Catatan</th>
                        <th className="px-4 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle text-sm">
                      {items.map((item) => {
                        const category = categoryMap.get(item.categoryId);
                        return (
                          <tr
                            key={item.categoryId}
                            className={clsx('align-top', item.locked && 'bg-surface-alt/70')}
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium text-text">
                                {category?.name ?? 'Tanpa kategori'}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <CurrencyCell
                                value={item.allocationAmount}
                                onChange={(value) => handleAmountChange(item.categoryId, value)}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.01}
                                value={item.allocationPercent}
                                onChange={(event) =>
                                  handlePercentChange(item.categoryId, Number(event.target.value))
                                }
                                className="w-full rounded-xl border border-border-subtle bg-surface px-3 py-2 text-right text-sm font-medium text-text focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary/45"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleToggleLock(item.categoryId, !item.locked)}
                              >
                                {item.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <textarea
                                value={item.notes}
                                onChange={(event) =>
                                  setItems((prev) =>
                                    prev.map((row) =>
                                      row.categoryId === item.categoryId
                                        ? { ...row, notes: event.target.value }
                                        : row
                                    )
                                  )
                                }
                                className="w-full rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm text-text focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary/45"
                                placeholder="Catatan opsional"
                                rows={2}
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm text-danger"
                                onClick={() => handleRemoveItem(item.categoryId)}
                              >
                                Hapus
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-4 md:hidden">
                  {items.map((item) => {
                    const category = categoryMap.get(item.categoryId);
                    return (
                      <div
                        key={item.categoryId}
                        className="space-y-3 rounded-2xl border border-border-subtle p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="text-base font-semibold text-text">
                              {category?.name ?? 'Tanpa kategori'}
                            </h4>
                            {item.notes ? (
                              <p className="text-xs text-muted">{item.notes}</p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm text-danger"
                            onClick={() => handleRemoveItem(item.categoryId)}
                          >
                            Hapus
                          </button>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-medium text-muted">Nominal (Rp)</label>
                            <CurrencyCell
                              value={item.allocationAmount}
                              onChange={(value) => handleAmountChange(item.categoryId, value)}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted">Persentase</label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.01}
                              value={item.allocationPercent}
                              onChange={(event) =>
                                handlePercentChange(item.categoryId, Number(event.target.value))
                              }
                              className="w-full rounded-xl border border-border-subtle bg-surface px-3 py-2 text-right text-sm font-medium text-text focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary/45"
                            />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-medium text-muted">Lock %</span>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleToggleLock(item.categoryId, !item.locked)}
                            >
                              {item.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                            </button>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted">Catatan</label>
                            <textarea
                              value={item.notes}
                              onChange={(event) =>
                                setItems((prev) =>
                                  prev.map((row) =>
                                    row.categoryId === item.categoryId
                                      ? { ...row, notes: event.target.value }
                                      : row
                                  )
                                )
                              }
                              className="w-full rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm text-text focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary/45"
                              placeholder="Catatan opsional"
                              rows={2}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {renderWarning ? (
                  <div className="flex items-center gap-3 rounded-xl border border-amber-400 bg-amber-50/60 px-4 py-3 text-sm text-amber-700">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" /> Total alokasi melebihi gaji. Sesuaikan nilai agar tidak defisit.
                  </div>
                ) : null}
              </div>
            )}
          </CardBody>
        </Card>
      </Section>

      <Section>
        <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
          <Card>
            <CardHeader title="Ringkasan" subtext="Tinjauan cepat hasil simulasi" />
            <CardBody>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-border-subtle p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Total Gaji
                  </h4>
                  <p className="mt-2 text-lg font-semibold text-text">
                    {formatCurrency(salaryAmount)}
                  </p>
                </div>
                <div className="rounded-2xl border border-border-subtle p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Total Alokasi
                  </h4>
                  <p className="mt-2 text-lg font-semibold text-text">
                    {formatCurrency(totalAllocation)}
                  </p>
                  <p className="text-xs text-muted">{Math.round(allocationRatio * 100)}% dari gaji</p>
                </div>
                <div
                  className={clsx(
                    'rounded-2xl border p-4',
                    remainingSalary < 0 ? 'border-rose-200 bg-rose-50/70' : 'border-border-subtle'
                  )}
                >
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Sisa Gaji
                  </h4>
                  <p className="mt-2 text-lg font-semibold text-text">
                    {formatCurrency(remainingSalary)}
                  </p>
                  {remainingSalary < 0 ? (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                      Over-Allocated
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="mt-4 text-sm text-muted">{insightText}</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Komposisi Alokasi" subtext="Persentase per kategori" />
            <CardBody>
              {items.length > 0 ? (
                pieChart
              ) : (
                <div className="flex h-[280px] items-center justify-center text-sm text-muted">
                  Belum ada data untuk ditampilkan.
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </Section>

      <Section>
        <Card>
          <CardHeader
            title="Perbandingan Budget Aktif"
            subtext="Bandingkan hasil simulasi dengan budget bulan berjalan"
          />
          <CardBody>
            {comparisonData.length > 0 ? (
              barChart
            ) : (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted">
                Belum ada data untuk ditampilkan.
              </div>
            )}
            {overBudgetCategories.length > 0 ? (
              <div className="mt-4 space-y-2 rounded-xl border border-amber-400 bg-amber-50/60 px-4 py-3 text-sm text-amber-700">
                <div className="font-semibold">Kategori melewati budget bulan aktif:</div>
                <ul className="list-disc pl-5">
                  {overBudgetCategories.map((entry) => (
                    <li key={entry.item.categoryId}>
                      <span className="font-medium text-text">
                        {categoryMap.get(entry.item.categoryId)?.name ?? 'Tanpa kategori'}
                      </span>
                      {': '}selisih {formatCurrency(entry.delta)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardBody>
        </Card>
      </Section>

      <Section>
        <Card>
          <CardHeader
            title="Tindakan Lanjutan"
            subtext="Terapkan hasil simulasi ke anggaran bila sudah siap"
          />
          <CardBody className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-border-subtle p-4">
              <input
                id="confirm-apply"
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border-subtle text-primary focus:ring-primary"
                checked={applyConfirmation}
                onChange={(event) => setApplyConfirmation(event.target.checked)}
              />
              <label htmlFor="confirm-apply" className="text-sm text-text">
                Saya paham, tindakan ini akan memodifikasi budget bulan {formatMonthLabel(period)}.
              </label>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!applyConfirmation || working || !selectedId}
              onClick={handleApplyToBudget}
            >
              {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Terapkan ke Budget
            </button>
            <p className="text-sm text-muted">
              Simulasi tidak mengubah data sampai Anda menerapkan.
            </p>
            <Link to="/budgets" className="text-sm font-medium text-primary underline">
              Kembali ke Budgets
            </Link>
          </CardBody>
        </Card>
      </Section>

      <Section>
        <Card>
          <CardHeader
            title="Riwayat Simulasi"
            subtext="Daftar simulasi tersimpan untuk dibuka kembali"
            actions={
              <div className="flex items-center gap-2 text-sm text-muted">
                <History className="h-4 w-4" />
                {historyLoading ? 'Memuat...' : `${history.length} entri`}
              </div>
            }
          />
          <CardBody>
            {historyLoading ? (
              <div className="flex items-center gap-2 text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Memuat riwayat simulasi...
              </div>
            ) : history.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border-subtle p-6 text-center text-sm text-muted">
                Belum ada simulasi tersimpan. Simpan simulasi untuk melihat riwayat di sini.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border-subtle">
                <table className="min-w-full divide-y divide-border-subtle text-sm">
                  <thead className="bg-surface-alt text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-3 text-left">Judul</th>
                      <th className="px-4 py-3 text-left">Periode</th>
                      <th className="px-4 py-3 text-right">Total Alokasi</th>
                      <th className="px-4 py-3 text-right">Sisa</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {history.map((entry) => (
                      <tr key={entry.id} className="text-sm">
                        <td className="px-4 py-3">
                          <div className="font-medium text-text">
                            {entry.title ?? buildDefaultTitle(isoToPeriod(entry.period_month))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-text">
                          {formatMonthLabel(isoToPeriod(entry.period_month))}
                        </td>
                        <td className="px-4 py-3 text-right text-text">
                          {formatCurrency(entry.total_allocations)}
                        </td>
                        <td
                          className={clsx(
                            'px-4 py-3 text-right',
                            entry.remaining < 0 ? 'text-rose-600' : 'text-text'
                          )}
                        >
                          {formatCurrency(entry.remaining)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleOpenSimulation(entry.id)}
                              disabled={working}
                            >
                              Buka
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleDuplicate(entry.id)}
                              disabled={saving || working}
                            >
                              Salin
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm text-danger"
                              onClick={() => handleDeleteSimulation(entry.id)}
                              disabled={working}
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

      <Modal
        open={addCategoryOpen}
        title="Pilih Kategori Pengeluaran"
        onClose={handleModalClose}
      >
        <div className="space-y-4">
          {availableCategories.length === 0 ? (
            <p className="text-sm text-muted">
              Semua kategori pengeluaran sudah ditambahkan.
            </p>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                handleModalConfirm();
              }}
            >
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {availableCategories.map((category) => {
                  const checked = selectedAddCategories.has(category.id);
                  return (
                    <label
                      key={category.id}
                      className="flex items-center gap-3 rounded-xl border border-border-subtle px-3 py-2"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          setSelectedAddCategories((prev) => {
                            const next = new Set(prev);
                            if (event.target.checked) {
                              next.add(category.id);
                            } else {
                              next.delete(category.id);
                            }
                            return next;
                          });
                        }}
                        className="h-4 w-4 rounded border-border-subtle text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-text">{category.name}</span>
                    </label>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-ghost" onClick={handleModalClose}>
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={selectedAddCategories.size === 0}
                >
                  Tambahkan
                </button>
              </div>
            </form>
          )}
        </div>
      </Modal>
    </Page>
  );
}
