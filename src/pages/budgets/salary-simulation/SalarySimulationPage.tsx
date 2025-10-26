import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import Page from '../../../layout/Page';
import Section from '../../../layout/Section';
import PageHeader from '../../../layout/PageHeader';
import Card, { CardBody, CardHeader } from '../../../components/Card';
import { useToast } from '../../../context/ToastContext';
import { supabase } from '../../../lib/supabase';
import type { ExpenseCategory } from '../../../lib/budgetApi';
import {
  listExpenseCategories,
  getMonthlyBudgets,
  getSalarySimulations,
  createSalarySimulation,
  updateSalarySimulation,
  deleteSalarySimulation,
  duplicateSalarySimulation,
  applySimulationToBudgets,
  type MonthlyBudgetRow,
  type SalarySimulationWithItems,
  type SalarySimulationPayload,
} from '../../../lib/salarySimulationApi';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  Loader2,
  Lock,
  Unlock,
  Trash2,
  Plus,
  Copy,
  RefreshCcw,
  Save,
} from 'lucide-react';

interface SimulationItemState {
  id?: string;
  category_id: string;
  allocation_amount: number;
  allocation_percent: number;
  amountDisplay: string;
  percentInput: string;
  notes: string;
  lockedPercent: boolean;
}

interface SimulationDraft {
  id?: string;
  title: string;
  salaryAmount: number;
  salaryInput: string;
  periodMonth: string;
  notes: string;
  items: SimulationItemState[];
}

const CURRENT_MONTH_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  month: 'long',
  year: 'numeric',
});

const CURRENCY_COMPACT = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const NUMBER_FORMATTER = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 1,
});

const RAW_NUMBER_FORMATTER = new Intl.NumberFormat('id-ID');

const PIE_COLORS = [
  '#6366F1',
  '#F97316',
  '#22C55E',
  '#EC4899',
  '#0EA5E9',
  '#A855F7',
  '#F59E0B',
  '#EF4444',
  '#14B8A6',
  '#8B5CF6',
];

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return 'Rp 0';
  return CURRENCY_COMPACT.format(Math.round(value));
}

function parseCurrencyInput(value: string): { value: number; display: string } {
  const digits = value.replace(/\D/g, '');
  if (!digits) {
    return { value: 0, display: '' };
  }
  const numeric = Number.parseInt(digits, 10);
  return {
    value: numeric,
    display: RAW_NUMBER_FORMATTER.format(numeric),
  };
}

function formatPercentLabel(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0%';
  return `${NUMBER_FORMATTER.format(value)}%`;
}

function formatPercentInput(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '';
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

function toMonthInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function normalizePeriodInput(value: string): string {
  if (value.length === 7) return value;
  if (value.length >= 10) return value.slice(0, 7);
  return value;
}

function toMonthStart(period: string): string {
  const normalized = normalizePeriodInput(period);
  const [year, month] = normalized.split('-');
  return `${year}-${month}-01`;
}

function monthLabel(period: string): string {
  try {
    const date = new Date(`${toMonthStart(period)}T00:00:00.000Z`);
    return CURRENT_MONTH_FORMATTER.format(date);
  } catch (_error) {
    return period;
  }
}

function buildDefaultTitle(period: string): string {
  return `Simulasi Gajian ${monthLabel(period)}`;
}

function createEmptyForm(periodMonth: string): SimulationDraft {
  return {
    id: undefined,
    title: buildDefaultTitle(periodMonth),
    salaryAmount: 0,
    salaryInput: '',
    periodMonth,
    notes: '',
    items: [],
  };
}

function createItemState(categoryId: string): SimulationItemState {
  return {
    category_id: categoryId,
    allocation_amount: 0,
    allocation_percent: 0,
    amountDisplay: '',
    percentInput: '',
    notes: '',
    lockedPercent: false,
  };
}

function mapSimulationToForm(simulation: SalarySimulationWithItems): SimulationDraft {
  const period = normalizePeriodInput(simulation.period_month);
  const salaryAmount = Number(simulation.salary_amount ?? 0);
  return {
    id: simulation.id,
    title: simulation.title ?? buildDefaultTitle(period),
    salaryAmount,
    salaryInput: salaryAmount > 0 ? RAW_NUMBER_FORMATTER.format(Math.round(salaryAmount)) : '',
    periodMonth: period,
    notes: simulation.notes ?? '',
    items: (simulation.items ?? []).map((item) => {
      const amount = Number(item.allocation_amount ?? 0);
      const percentFromRecord =
        item.allocation_percent === null || item.allocation_percent === undefined
          ? salaryAmount > 0
            ? (amount / salaryAmount) * 100
            : 0
          : Number(item.allocation_percent);
      return {
        id: item.id,
        category_id: item.category_id,
        allocation_amount: roundCurrency(amount),
        allocation_percent: Number.isFinite(percentFromRecord) ? percentFromRecord : 0,
        amountDisplay: amount > 0 ? RAW_NUMBER_FORMATTER.format(roundCurrency(amount)) : '',
        percentInput: formatPercentInput(percentFromRecord),
        notes: item.notes ?? '',
        lockedPercent: false,
      } satisfies SimulationItemState;
    }),
  };
}

function serializeDraft(draft: SimulationDraft) {
  return JSON.stringify({ ...draft, items: draft.items.map((item) => ({ ...item, lockedPercent: Boolean(item.lockedPercent) })) });
}

function deserializeDraft(value: string): SimulationDraft | null {
  try {
    const parsed = JSON.parse(value) as SimulationDraft;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      ...createEmptyForm(parsed.periodMonth ?? toMonthInputValue(new Date())),
      ...parsed,
      items: Array.isArray(parsed.items)
        ? parsed.items.map((item) => ({
            ...createItemState(item.category_id),
            ...item,
            amountDisplay: item.amountDisplay ?? (item.allocation_amount > 0 ? RAW_NUMBER_FORMATTER.format(item.allocation_amount) : ''),
            percentInput: item.percentInput ?? formatPercentInput(item.allocation_percent),
            lockedPercent: Boolean(item.lockedPercent),
          }))
        : [],
    };
  } catch (_error) {
    return null;
  }
}

function computeTotal(items: SimulationItemState[]): number {
  return items.reduce((total, item) => total + Number(item.allocation_amount ?? 0), 0);
}

function computeHighest(items: SimulationItemState[]): SimulationItemState | null {
  if (!items.length) return null;
  return [...items].sort((a, b) => b.allocation_amount - a.allocation_amount)[0] ?? null;
}

const REMAINING_BADGE_CLASS = 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold';

export default function SalarySimulationPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [budgets, setBudgets] = useState<MonthlyBudgetRow[]>([]);
  const [budgetsLoading, setBudgetsLoading] = useState(false);
  const [history, setHistory] = useState<SalarySimulationWithItems[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyConfirmed, setApplyConfirmed] = useState(false);
  const defaultPeriod = useMemo(() => toMonthInputValue(new Date()), []);
  const [form, setForm] = useState<SimulationDraft>(() => createEmptyForm(defaultPeriod));
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [categorySelections, setCategorySelections] = useState<string[]>([]);
  const skipNextDraftSave = useRef(false);
  const [salaryError, setSalaryError] = useState<string | null>(null);
  const [allocationError, setAllocationError] = useState<string | null>(null);

  const draftKey = useMemo(() => (session?.user?.id ? `salary-simulation-draft:${session.user.id}` : null), [session?.user?.id]);
  const [draftLoaded, setDraftLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        const nextSession = data.session ?? null;
        setSession(nextSession);
        setAuthChecked(true);
        if (!nextSession) {
          navigate('/auth', { replace: true });
        }
      })
      .catch((error) => {
        if (!active) return;
        console.error('[Simulasi Gajian] session error', error);
        setAuthChecked(true);
        navigate('/auth', { replace: true });
      });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (!nextSession) {
        navigate('/auth', { replace: true });
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    if (!authChecked || !session?.user) return;
    let cancelled = false;
    setCategoriesLoading(true);
    listExpenseCategories(session.user.id)
      .then((rows) => {
        if (cancelled) return;
        setCategories(rows);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('[Simulasi Gajian] load categories', error);
        addToast('Gagal memuat kategori', 'error');
      })
      .finally(() => {
        if (cancelled) return;
        setCategoriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authChecked, session?.user, addToast]);

  const loadBudgets = useCallback(
    (period: string) => {
      if (!session?.user) return;
      setBudgetsLoading(true);
      getMonthlyBudgets(session.user.id, period)
        .then((rows) => {
          setBudgets(rows);
        })
        .catch((error) => {
          console.error('[Simulasi Gajian] load budgets', error);
          addToast('Gagal memuat data anggaran bulan ini', 'error');
        })
        .finally(() => {
          setBudgetsLoading(false);
        });
    },
    [session?.user, addToast]
  );

  const loadHistory = useCallback(() => {
    if (!session?.user) return;
    setHistoryLoading(true);
    getSalarySimulations(session.user.id)
      .then((rows) => {
        setHistory(rows);
      })
      .catch((error) => {
        console.error('[Simulasi Gajian] load history', error);
        addToast('Gagal memuat riwayat simulasi', 'error');
      })
      .finally(() => {
        setHistoryLoading(false);
      });
  }, [session?.user, addToast]);

  useEffect(() => {
    if (!draftLoaded && draftKey) {
      const stored = localStorage.getItem(draftKey);
      if (stored) {
        const parsed = deserializeDraft(stored);
        if (parsed) {
          setForm(parsed);
          loadBudgets(parsed.periodMonth);
        }
      }
      setDraftLoaded(true);
    }
  }, [draftLoaded, draftKey, loadBudgets]);

  useEffect(() => {
    if (!draftKey || !draftLoaded) return;
    if (skipNextDraftSave.current) {
      skipNextDraftSave.current = false;
      return;
    }
    try {
      localStorage.setItem(draftKey, serializeDraft(form));
    } catch (error) {
      console.warn('[Simulasi Gajian] gagal menyimpan draft', error);
    }
  }, [form, draftKey, draftLoaded]);

  useEffect(() => {
    if (!authChecked || !session?.user) return;
    if (!draftLoaded) return;
    loadBudgets(form.periodMonth);
    loadHistory();
  }, [authChecked, session?.user, form.periodMonth, loadBudgets, loadHistory, draftLoaded]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, ExpenseCategory>();
    for (const category of categories) {
      map.set(category.id, category);
    }
    return map;
  }, [categories]);

  const budgetMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of budgets) {
      map.set(row.category_id, Number(row.amount_planned ?? 0));
    }
    return map;
  }, [budgets]);

  const totalAllocation = useMemo(() => computeTotal(form.items), [form.items]);
  const remaining = useMemo(() => form.salaryAmount - totalAllocation, [form.salaryAmount, totalAllocation]);
  const overAllocated = remaining < 0;
  const allocationPercentage = useMemo(() => {
    if (form.salaryAmount <= 0) return 0;
    return (totalAllocation / form.salaryAmount) * 100;
  }, [totalAllocation, form.salaryAmount]);

  const highestAllocation = useMemo(() => computeHighest(form.items), [form.items]);

  const availableCategories = useMemo(() => {
    const selectedIds = new Set(form.items.map((item) => item.category_id));
    return categories.filter((category) => !selectedIds.has(category.id));
  }, [categories, form.items]);

  const pieData = useMemo(
    () =>
      form.items
        .filter((item) => item.allocation_amount > 0)
        .map((item) => ({
          name: categoryMap.get(item.category_id)?.name ?? 'Kategori',
          value: item.allocation_amount,
          percent: form.salaryAmount > 0 ? (item.allocation_amount / form.salaryAmount) * 100 : 0,
        })),
    [form.items, categoryMap, form.salaryAmount]
  );

  const barData = useMemo(
    () =>
      form.items.map((item) => ({
        name: categoryMap.get(item.category_id)?.name ?? 'Kategori',
        Simulasi: item.allocation_amount,
        Budget: budgetMap.get(item.category_id) ?? 0,
      })),
    [form.items, categoryMap, budgetMap]
  );

  const overBudgetCategories = useMemo(
    () =>
      form.items
        .map((item) => {
          const planned = budgetMap.get(item.category_id) ?? 0;
          const delta = item.allocation_amount - planned;
          return { item, planned, delta };
        })
        .filter((entry) => entry.delta > 0 && entry.planned > 0),
    [form.items, budgetMap]
  );

  const insightText = useMemo(() => {
    if (form.salaryAmount <= 0) return 'Masukkan nominal gaji untuk mulai simulasi.';
    const remainingText = `${formatCurrency(Math.max(remaining, 0))} (${formatPercentLabel(
      Math.max((remaining / form.salaryAmount) * 100, 0)
    )})`;
    const base = `Sisa gaji ${remaining >= 0 ? '' : 'negatif '} ${remainingText}.`;
    if (!highestAllocation) return base;
    const categoryName = categoryMap.get(highestAllocation.category_id)?.name ?? 'Kategori';
    return `${base} Alokasi tertinggi pada “${categoryName}” ${formatPercentLabel(highestAllocation.allocation_percent)}.`;
  }, [form.salaryAmount, remaining, highestAllocation, categoryMap]);

  const budgetsSummary = useMemo(() => {
    const total = budgets.reduce((sum, row) => sum + Number(row.amount_planned ?? 0), 0);
    return {
      total,
      hasBudgets: budgets.length > 0,
    };
  }, [budgets]);
  const handleSalaryChange = (input: string) => {
    const parsed = parseCurrencyInput(input);
    setForm((prev) => {
      const nextSalary = parsed.value;
      const nextItems = prev.items.map((item) => {
        if (item.lockedPercent) {
          const newAmount = roundCurrency((item.allocation_percent / 100) * nextSalary);
          return {
            ...item,
            allocation_amount: newAmount,
            amountDisplay: newAmount > 0 ? RAW_NUMBER_FORMATTER.format(newAmount) : '',
          };
        }
        const newPercent = nextSalary > 0 ? (item.allocation_amount / nextSalary) * 100 : 0;
        return {
          ...item,
          allocation_percent: Number.isFinite(newPercent) ? newPercent : 0,
          percentInput: formatPercentInput(newPercent),
        };
      });
      return {
        ...prev,
        salaryAmount: nextSalary,
        salaryInput: parsed.display,
        items: nextItems,
      };
    });
  };

  const handleSalaryBlur = () => {
    setForm((prev) => ({
      ...prev,
      salaryInput: prev.salaryAmount > 0 ? RAW_NUMBER_FORMATTER.format(prev.salaryAmount) : '',
    }));
  };

  const handleTitleChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      title: value,
    }));
  };

  const handleNotesChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      notes: value,
    }));
  };

  const handlePeriodChange = (value: string) => {
    const normalized = normalizePeriodInput(value);
    setForm((prev) => {
      const shouldResetTitle = !prev.title || prev.title === buildDefaultTitle(prev.periodMonth);
      const nextTitle = shouldResetTitle ? buildDefaultTitle(normalized) : prev.title;
      return {
        ...prev,
        periodMonth: normalized,
        title: nextTitle,
      };
    });
    loadBudgets(normalized);
  };

  const handleItemAmountChange = (categoryId: string, input: string) => {
    const parsed = parseCurrencyInput(input);
    setForm((prev) => {
      const salary = prev.salaryAmount;
      const nextItems = prev.items.map((item) => {
        if (item.category_id !== categoryId) return item;
        const amount = parsed.value;
        const percent = salary > 0 ? (amount / salary) * 100 : 0;
        return {
          ...item,
          allocation_amount: amount,
          allocation_percent: Number.isFinite(percent) ? percent : 0,
          percentInput: formatPercentInput(percent),
          amountDisplay: parsed.display,
        };
      });
      return {
        ...prev,
        items: nextItems,
      };
    });
  };

  const handleItemAmountBlur = (categoryId: string) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.category_id === categoryId
          ? {
              ...item,
              amountDisplay: item.allocation_amount > 0 ? RAW_NUMBER_FORMATTER.format(item.allocation_amount) : '',
            }
          : item
      ),
    }));
  };

  const handleItemPercentChange = (categoryId: string, input: string) => {
    setForm((prev) => {
      const salary = prev.salaryAmount;
      const normalizedInput = input.replace(',', '.');
      const numeric = Number.parseFloat(normalizedInput);
      const percent = Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
      const amount = salary > 0 ? roundCurrency((percent / 100) * salary) : 0;
      return {
        ...prev,
        items: prev.items.map((item) =>
          item.category_id === categoryId
            ? {
                ...item,
                allocation_percent: percent,
                percentInput: input,
                allocation_amount: amount,
                amountDisplay: amount > 0 ? RAW_NUMBER_FORMATTER.format(amount) : '',
              }
            : item
        ),
      };
    });
  };

  const handleItemPercentBlur = (categoryId: string) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.category_id === categoryId
          ? {
              ...item,
              percentInput: formatPercentInput(item.allocation_percent),
            }
          : item
      ),
    }));
  };

  const handleItemNotesChange = (categoryId: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.category_id === categoryId
          ? {
              ...item,
              notes: value,
            }
          : item
      ),
    }));
  };

  const toggleLockPercent = (categoryId: string) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.category_id === categoryId
          ? {
              ...item,
              lockedPercent: !item.lockedPercent,
            }
          : item
      ),
    }));
  };

  const removeCategory = (categoryId: string) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.category_id !== categoryId),
    }));
  };

  const handleAddSelectedCategories = () => {
    if (!categorySelections.length) {
      setCategoryPickerOpen(false);
      return;
    }
    setForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        ...categorySelections
          .filter((id) => !prev.items.some((item) => item.category_id === id))
          .map((id) => createItemState(id)),
      ],
    }));
    setCategoryPickerOpen(false);
    setCategorySelections([]);
  };

  const handleAutoDistribute = () => {
    if (form.salaryAmount <= 0) {
      addToast('Masukkan nominal gaji terlebih dahulu', 'warning');
      return;
    }
    const adjustable = form.items.filter((item) => !item.lockedPercent);
    if (!adjustable.length) {
      addToast('Tidak ada kategori yang bisa diatur otomatis', 'info');
      return;
    }
    const lockedTotal = form.items
      .filter((item) => item.lockedPercent)
      .reduce((sum, item) => sum + Number(item.allocation_amount ?? 0), 0);
    const available = Math.max(form.salaryAmount - lockedTotal, 0);
    let distribution: number[] = [];
    let weightsTotal = 0;
    const weights = adjustable.map((item) => {
      const planned = budgetMap.get(item.category_id) ?? 0;
      weightsTotal += planned;
      return planned;
    });
    if (weightsTotal > 0) {
      distribution = adjustable.map((_item, index) => {
        const weight = weights[index] ?? 0;
        return weight > 0 ? (weight / weightsTotal) * available : 0;
      });
    } else {
      const even = adjustable.length > 0 ? available / adjustable.length : 0;
      distribution = adjustable.map(() => even);
    }
    const rounded = distribution.map((value) => roundCurrency(value));
    const diff = available - rounded.reduce((sum, value) => sum + value, 0);
    if (rounded.length && diff !== 0) {
      rounded[rounded.length - 1] = rounded[rounded.length - 1] + diff;
    }
    setForm((prev) => {
      let index = 0;
      return {
        ...prev,
        items: prev.items.map((item) => {
          if (item.lockedPercent) {
            return item;
          }
          const amount = Math.max(rounded[index] ?? 0, 0);
          index += 1;
          const percent = prev.salaryAmount > 0 ? (amount / prev.salaryAmount) * 100 : 0;
          return {
            ...item,
            allocation_amount: amount,
            allocation_percent: Number.isFinite(percent) ? percent : 0,
            amountDisplay: amount > 0 ? RAW_NUMBER_FORMATTER.format(amount) : '',
            percentInput: formatPercentInput(percent),
          };
        }),
      };
    });
  };

  const validateForm = (): boolean => {
    let valid = true;
    if (!form.salaryAmount || form.salaryAmount <= 0) {
      setSalaryError('Nominal gaji wajib diisi');
      valid = false;
    } else {
      setSalaryError(null);
    }
    if (totalAllocation > form.salaryAmount) {
      setAllocationError('Total alokasi melebihi nominal gaji');
      valid = false;
    } else {
      setAllocationError(null);
    }
    if (form.items.length === 0) {
      addToast('Tambahkan minimal satu kategori pengeluaran', 'warning');
      valid = false;
    }
    return valid;
  };

  const buildPayload = (): SalarySimulationPayload => ({
    title: form.title,
    salary_amount: form.salaryAmount,
    period_month: form.periodMonth,
    notes: form.notes,
    items: form.items.map((item) => ({
      category_id: item.category_id,
      allocation_amount: item.allocation_amount,
      allocation_percent: item.allocation_percent,
      notes: item.notes,
    })),
  });

  const handleSave = async () => {
    if (saving) return;
    if (!validateForm()) return;
    if (!session?.user) {
      addToast('Sesi berakhir, silakan login ulang', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      let result: SalarySimulationWithItems;
      if (form.id) {
        result = await updateSalarySimulation(form.id, payload, session.user.id);
        addToast('Simulasi diperbarui', 'success');
      } else {
        result = await createSalarySimulation(payload, session.user.id);
        addToast('Simulasi tersimpan', 'success');
      }
      skipNextDraftSave.current = true;
      const mapped = mapSimulationToForm(result);
      setForm(mapped);
      setApplyConfirmed(false);
      loadHistory();
    } catch (error) {
      console.error('[Simulasi Gajian] save error', error);
      addToast(error instanceof Error ? error.message : 'Gagal menyimpan simulasi', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async () => {
    if (duplicating || !form.id || !session?.user) return;
    setDuplicating(true);
    try {
      const duplicated = await duplicateSalarySimulation(form.id, session.user.id);
      skipNextDraftSave.current = true;
      const mapped = mapSimulationToForm(duplicated);
      setForm(mapped);
      setApplyConfirmed(false);
      loadHistory();
      addToast('Simulasi digandakan', 'success');
    } catch (error) {
      console.error('[Simulasi Gajian] duplicate error', error);
      addToast(error instanceof Error ? error.message : 'Gagal menduplikasi simulasi', 'error');
    } finally {
      setDuplicating(false);
    }
  };

  const handleReset = () => {
    const next = createEmptyForm(form.periodMonth);
    skipNextDraftSave.current = true;
    setForm(next);
    setApplyConfirmed(false);
    setSalaryError(null);
    setAllocationError(null);
    addToast('Form simulasi direset', 'info');
  };

  const handleApplyBudgets = async () => {
    if (!applyConfirmed || applying) return;
    if (!validateForm()) return;
    if (!session?.user) {
      addToast('Sesi berakhir, silakan login ulang', 'error');
      return;
    }
    const confirmed = window.confirm(
      'Menerapkan simulasi akan memperbarui angka planned anggaran bulan ini. Lanjutkan?'
    );
    if (!confirmed) return;
    setApplying(true);
    try {
      const simulation: SalarySimulationWithItems = {
        id: form.id ?? 'local',
        user_id: session.user.id,
        title: form.title,
        salary_amount: form.salaryAmount,
        period_month: toMonthStart(form.periodMonth),
        notes: form.notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        items: form.items.map((item, index) => ({
          id: item.id ?? `temp-${index}`,
          simulation_id: form.id ?? 'local',
          category_id: item.category_id,
          allocation_amount: item.allocation_amount,
          allocation_percent: item.allocation_percent,
          notes: item.notes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })),
      };
      await applySimulationToBudgets(simulation);
      addToast('Anggaran bulan ini diperbarui', 'success');
      loadBudgets(form.periodMonth);
    } catch (error) {
      console.error('[Simulasi Gajian] apply error', error);
      addToast(error instanceof Error ? error.message : 'Gagal menerapkan simulasi ke anggaran', 'error');
    } finally {
      setApplying(false);
    }
  };

  const handleOpenHistory = (simulation: SalarySimulationWithItems) => {
    skipNextDraftSave.current = true;
    const mapped = mapSimulationToForm(simulation);
    setForm(mapped);
    setApplyConfirmed(false);
    addToast('Simulasi dimuat', 'success');
  };

  const handleDuplicateFromHistory = async (simulation: SalarySimulationWithItems) => {
    if (duplicating || !session?.user) return;
    setDuplicating(true);
    try {
      const duplicated = await duplicateSalarySimulation(simulation.id, session.user.id);
      skipNextDraftSave.current = true;
      const mapped = mapSimulationToForm(duplicated);
      setForm(mapped);
      setApplyConfirmed(false);
      loadHistory();
      addToast('Simulasi digandakan', 'success');
    } catch (error) {
      console.error('[Simulasi Gajian] duplicate history error', error);
      addToast(error instanceof Error ? error.message : 'Gagal menduplikasi simulasi', 'error');
    } finally {
      setDuplicating(false);
    }
  };

  const handleDeleteHistory = async (simulation: SalarySimulationWithItems) => {
    if (!session?.user) return;
    const confirmed = window.confirm(`Hapus "${simulation.title ?? 'Simulasi'}"?`);
    if (!confirmed) return;
    try {
      await deleteSalarySimulation(simulation.id, session.user.id);
      if (form.id === simulation.id) {
        handleReset();
      }
      loadHistory();
      addToast('Simulasi dihapus', 'success');
    } catch (error) {
      console.error('[Simulasi Gajian] delete error', error);
      addToast(error instanceof Error ? error.message : 'Gagal menghapus simulasi', 'error');
    }
  };

  if (!authChecked) {
    return (
      <Page>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted" />
        </div>
      </Page>
    );
  }

  return (
    <Page maxWidthClassName="max-w-[1400px]" paddingClassName="px-3 md:px-6">
      <PageHeader
        title="Simulasi Gajian"
        description="Uji alokasi gaji ke kategori tanpa mengubah data asli."
      >
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || categoriesLoading}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-brand px-5 text-sm font-semibold text-brand-foreground shadow transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Simpan Simulasi
        </button>
        <button
          type="button"
          onClick={handleDuplicate}
          disabled={!form.id || duplicating}
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-border bg-surface px-4 text-sm font-semibold text-text transition hover:border-[color:var(--accent,#6366f1)] hover:text-[color:var(--accent,#6366f1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,#6366f1)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {duplicating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
          Duplikasi
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-transparent bg-transparent px-2 text-sm font-semibold text-[color:var(--accent,#6366f1)] transition hover:text-[color:var(--accent-hover,#4338ca)] focus-visible:outline-none"
        >
          <RefreshCcw className="h-4 w-4" />
          Reset
        </button>
      </PageHeader>
      <Section first>
        <Card>
          <CardHeader
            title="Setup Gaji & Periode"
            subtext="Masukkan nominal gaji dan periode sebagai dasar simulasi."
          />
          <CardBody className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="form-label">Nominal Gaji</span>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="input w-full rounded-2xl pl-10 text-right font-semibold"
                    placeholder="0"
                    value={form.salaryInput}
                    onChange={(event) => handleSalaryChange(event.target.value)}
                    onBlur={handleSalaryBlur}
                  />
                </div>
                {salaryError && <span className="form-error">{salaryError}</span>}
              </label>
              <label className="flex flex-col gap-2">
                <span className="form-label">Periode Bulan</span>
                <input
                  type="month"
                  className="input w-full rounded-2xl"
                  value={form.periodMonth}
                  onChange={(event) => handlePeriodChange(event.target.value)}
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="form-label">Judul Simulasi</span>
                <input
                  type="text"
                  className="input w-full rounded-2xl"
                  placeholder={buildDefaultTitle(form.periodMonth)}
                  value={form.title}
                  onChange={(event) => handleTitleChange(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="form-label">Catatan</span>
                <textarea
                  className="input h-24 w-full rounded-2xl"
                  placeholder="Tambahkan catatan opsional"
                  value={form.notes}
                  onChange={(event) => handleNotesChange(event.target.value)}
                />
              </label>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-surface px-4 py-3 text-sm text-muted">
              {budgetsLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memuat informasi anggaran bulan ini…
                </div>
              ) : budgetsSummary.hasBudgets ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span>
                    Total planned bulan ini: <strong>{formatCurrency(budgetsSummary.total)}</strong>
                  </span>
                  <Link
                    to="/budgets"
                    className="inline-flex items-center gap-1 text-[color:var(--accent,#6366f1)] hover:text-[color:var(--accent-hover,#4338ca)]"
                  >
                    Bandingkan dengan budget bulan ini →
                  </Link>
                </div>
              ) : (
                <span>
                  Belum ada anggaran bulan ini. <Link to="/budgets" className="font-semibold text-[color:var(--accent,#6366f1)]">Buat anggaran</Link>
                  {' '}untuk memudahkan auto-distribusi.
                </span>
              )}
            </div>
            {allocationError && (
              <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                {allocationError}
              </div>
            )}
          </CardBody>
        </Card>
      </Section>

      <Section>
        <Card>
          <CardHeader
            title="Alokasi per Kategori"
            subtext="Tentukan alokasi rupiah dan persentase untuk setiap kategori pengeluaran."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!availableCategories.length) {
                      addToast('Semua kategori sudah ditambahkan', 'info');
                      return;
                    }
                    setCategorySelections([]);
                    setCategoryPickerOpen(true);
                  }}
                  disabled={categoriesLoading}
                  className="inline-flex h-10 items-center gap-2 rounded-2xl border border-border bg-surface px-4 text-sm font-semibold text-text transition hover:border-[color:var(--accent,#6366f1)] hover:text-[color:var(--accent,#6366f1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,#6366f1)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" /> Tambah Kategori
                </button>
                <button
                  type="button"
                  onClick={handleAutoDistribute}
                  className="inline-flex h-10 items-center gap-2 rounded-2xl border border-border bg-surface px-4 text-sm font-semibold text-text transition hover:border-[color:var(--accent,#6366f1)] hover:text-[color:var(--accent,#6366f1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,#6366f1)]"
                >
                  Auto-Distribusi
                </button>
              </div>
            }
          />
          <CardBody className="space-y-4">
            {form.items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border-subtle px-4 py-6 text-center text-sm text-muted">
                Belum ada kategori. Tambahkan kategori pengeluaran untuk mulai mengalokasikan gaji.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] table-fixed border-separate border-spacing-y-2 text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted">
                      <th className="px-3 py-2">Kategori</th>
                      <th className="px-3 py-2 text-right">Alokasi (Rp)</th>
                      <th className="px-3 py-2 text-right">Persentase</th>
                      <th className="px-3 py-2 text-center">Lock %</th>
                      <th className="px-3 py-2 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((item) => {
                      const category = categoryMap.get(item.category_id);
                      const planned = budgetMap.get(item.category_id) ?? 0;
                      const exceeded = planned > 0 && item.allocation_amount > planned;
                      return (
                        <tr
                          key={item.category_id}
                          className="rounded-2xl bg-surface shadow-sm transition hover:bg-surface/90"
                        >
                          <td className="align-top px-3 py-3">
                            <div className="font-semibold text-text">{category?.name ?? 'Kategori'}</div>
                            {category?.group_name && (
                              <div className="text-xs text-muted">{category.group_name}</div>
                            )}
                            <textarea
                              className="input mt-3 h-16 w-full rounded-2xl text-xs"
                              placeholder="Catatan (opsional)"
                              value={item.notes}
                              onChange={(event) => handleItemNotesChange(item.category_id, event.target.value)}
                            />
                            {planned > 0 && (
                              <div className="mt-2 text-xs text-muted">
                                Budget bulan ini: {formatCurrency(planned)}
                              </div>
                            )}
                          </td>
                          <td className="align-top px-3 py-3">
                            <input
                              type="text"
                              inputMode="numeric"
                              className={`input w-full rounded-2xl text-right font-semibold ${exceeded ? 'border-amber-300 bg-amber-50 text-amber-700' : ''}`}
                              value={item.amountDisplay}
                              placeholder="0"
                              onChange={(event) => handleItemAmountChange(item.category_id, event.target.value)}
                              onBlur={() => handleItemAmountBlur(item.category_id)}
                            />
                          </td>
                          <td className="align-top px-3 py-3">
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              className="input w-full rounded-2xl text-right"
                              value={item.percentInput}
                              placeholder="0"
                              onChange={(event) => handleItemPercentChange(item.category_id, event.target.value)}
                              onBlur={() => handleItemPercentBlur(item.category_id)}
                            />
                            <div className="mt-1 text-xs text-muted">
                              {formatPercentLabel(form.salaryAmount > 0 ? (item.allocation_amount / form.salaryAmount) * 100 : 0)} dari gaji
                            </div>
                          </td>
                          <td className="align-top px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleLockPercent(item.category_id)}
                              className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${
                                item.lockedPercent
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-600'
                                  : 'border-border bg-surface text-muted hover:border-[color:var(--accent,#6366f1)] hover:text-[color:var(--accent,#6366f1)]'
                              }`}
                              aria-pressed={item.lockedPercent}
                              aria-label={item.lockedPercent ? 'Buka kunci persentase' : 'Kunci persentase'}
                            >
                              {item.lockedPercent ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                            </button>
                          </td>
                          <td className="align-top px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => removeCategory(item.category_id)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted transition hover:border-danger/30 hover:text-danger"
                              aria-label="Hapus kategori"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="px-3 py-2 text-sm font-semibold text-text">Total</td>
                      <td className="px-3 py-2 text-right text-sm font-semibold text-text">{formatCurrency(totalAllocation)}</td>
                      <td className="px-3 py-2 text-right text-sm font-semibold text-text">{formatPercentLabel(allocationPercentage)}</td>
                      <td className="px-3 py-2 text-center text-xs text-muted" colSpan={2}>
                        {overAllocated && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                            <AlertTriangle className="h-4 w-4" /> Alokasi melebihi gaji
                          </span>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </Section>

      <Section>
        <div className="grid gap-6 xl:grid-cols-[1.8fr_2fr]">
          <Card>
            <CardHeader title="Ringkasan" subtext="Tinjau total alokasi dan sisa gaji." />
            <CardBody className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-border-subtle bg-surface px-4 py-3">
                  <div className="text-xs uppercase text-muted">Total Gaji</div>
                  <div className="mt-2 text-xl font-semibold text-text">{formatCurrency(form.salaryAmount)}</div>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-surface px-4 py-3">
                  <div className="text-xs uppercase text-muted">Total Alokasi</div>
                  <div className="mt-2 text-xl font-semibold text-text">{formatCurrency(totalAllocation)}</div>
                  <div className="text-xs text-muted">{formatPercentLabel(allocationPercentage)} dari gaji</div>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-surface px-4 py-3">
                  <div className="text-xs uppercase text-muted">Sisa Gaji</div>
                  <div className={`mt-2 text-xl font-semibold ${remaining < 0 ? 'text-danger' : 'text-text'}`}>
                    {formatCurrency(Math.abs(remaining))}
                  </div>
                  <span
                    className={`${REMAINING_BADGE_CLASS} ${
                      remaining < 0
                        ? 'bg-danger/10 text-danger'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {remaining < 0 ? 'Over-Allocated' : 'Tersisa'}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-border-subtle bg-surface px-4 py-4 text-sm text-text">
                {insightText}
              </div>

              {overBudgetCategories.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  <div className="mb-2 flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4" /> Kategori melebihi budget bulan aktif
                  </div>
                  <ul className="space-y-1">
                    {overBudgetCategories.map(({ item, planned }) => (
                      <li key={item.category_id}>
                        <span className="font-medium">{categoryMap.get(item.category_id)?.name ?? 'Kategori'}</span> • Simulasi {formatCurrency(item.allocation_amount)} vs Budget {formatCurrency(planned)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardBody>
          </Card>

          <div className="grid gap-6">
            <Card>
              <CardHeader title="Komposisi Alokasi" subtext="Distribusi persentase per kategori." />
              <CardBody>
                {pieData.length === 0 ? (
                  <div className="flex h-64 items-center justify-center text-sm text-muted">
                    Masukkan alokasi untuk melihat grafik.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90}>
                        {pieData.map((_entry, index) => (
                          <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number, _name, props) => [formatCurrency(value as number), props?.payload?.name]} />
                      <Legend layout="horizontal" verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Simulasi vs Budget" subtext="Bandingkan hasil simulasi dengan budget bulan aktif." />
              <CardBody>
                {barData.length === 0 ? (
                  <div className="flex h-72 items-center justify-center text-sm text-muted">
                    Tambahkan kategori untuk melihat perbandingan.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" hide={barData.length > 8} angle={-15} textAnchor="end" interval={0} height={barData.length > 8 ? 0 : 60} />
                      <YAxis tickFormatter={(value) => RAW_NUMBER_FORMATTER.format(Number(value))} />
                      <Tooltip formatter={(value: number) => formatCurrency(Number(value))} />
                      <Legend />
                      <Bar dataKey="Simulasi" fill="#6366F1" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="Budget" fill="#E5E7EB" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      </Section>

      <Section>
        <Card>
          <CardHeader
            title="Riwayat Simulasi"
            subtext="Simpan dan kelola draf simulasi Anda."
            actions={
              <button
                type="button"
                onClick={loadHistory}
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-border bg-surface px-4 text-sm font-semibold text-text transition hover:border-[color:var(--accent,#6366f1)] hover:text-[color:var(--accent,#6366f1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,#6366f1)]"
              >
                Segarkan
              </button>
            }
          />
          <CardBody className="space-y-4">
            {historyLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Memuat riwayat…
              </div>
            ) : history.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border-subtle px-4 py-6 text-center text-sm text-muted">
                Belum ada simulasi tersimpan. Simpan simulasi untuk muncul di sini.
              </div>
            ) : (
              <ul className="space-y-3">
                {history.map((simulation) => {
                  const total = (simulation.items ?? []).reduce(
                    (sum, item) => sum + Number(item.allocation_amount ?? 0),
                    0
                  );
                  const remainingHistory = Number(simulation.salary_amount ?? 0) - total;
                  const isActive = form.id === simulation.id;
                  return (
                    <li
                      key={simulation.id}
                      className={`flex flex-col gap-3 rounded-2xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${
                        isActive ? 'border-[color:var(--accent,#6366f1)] bg-[color:var(--accent,#6366f1)]/5' : 'border-border-subtle bg-surface'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-text">{simulation.title ?? 'Simulasi Tanpa Judul'}</div>
                        <div className="text-xs text-muted">
                          {monthLabel(simulation.period_month)} • Total alokasi {formatCurrency(total)} • Sisa {formatCurrency(Math.abs(remainingHistory))}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenHistory(simulation)}
                          className="inline-flex h-9 items-center rounded-2xl border border-border bg-surface px-4 text-xs font-semibold text-text transition hover:border-[color:var(--accent,#6366f1)] hover:text-[color:var(--accent,#6366f1)]"
                        >
                          Buka
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateFromHistory(simulation)}
                          disabled={duplicating}
                          className="inline-flex h-9 items-center rounded-2xl border border-border bg-surface px-4 text-xs font-semibold text-text transition hover:border-[color:var(--accent,#6366f1)] hover:text-[color:var(--accent,#6366f1)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Duplikasi
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteHistory(simulation)}
                          className="inline-flex h-9 items-center rounded-2xl border border-border bg-surface px-4 text-xs font-semibold text-danger transition hover:border-danger/40 hover:bg-danger/5"
                        >
                          Hapus
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </Section>

      <Section>
        <Card>
          <CardHeader title="Tindakan Lanjutan" subtext="Terapkan hasil simulasi ke anggaran nyata bila sudah siap." />
          <CardBody className="space-y-4">
            <label className="flex items-start gap-3 text-sm text-text">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 rounded border-border"
                checked={applyConfirmed}
                onChange={(event) => setApplyConfirmed(event.target.checked)}
              />
              <span>
                Saya paham, tindakan ini akan memperbarui budget bulan <strong>{monthLabel(form.periodMonth)}</strong> sesuai simulasi ini.
              </span>
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleApplyBudgets}
                disabled={!applyConfirmed || applying}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-emerald-500 px-5 text-sm font-semibold text-white shadow transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Terapkan ke Budget
              </button>
              <Link
                to="/budgets"
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-border bg-surface px-4 text-sm font-semibold text-text transition hover:border-[color:var(--accent,#6366f1)] hover:text-[color:var(--accent,#6366f1)]"
              >
                ← Kembali ke Budgets
              </Link>
            </div>
            <p className="text-xs text-muted">
              Simulasi tidak mengubah data sampai Anda menerapkan perubahan. Gunakan fitur ini setelah Anda yakin dengan alokasi.
            </p>
          </CardBody>
        </Card>
      </Section>

      {categoryPickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
          onClick={() => setCategoryPickerOpen(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-3xl border border-border-subtle bg-surface p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-text">Tambah Kategori</h2>
                <p className="text-sm text-muted">Pilih kategori pengeluaran untuk dimasukkan ke simulasi.</p>
              </div>
              <button
                type="button"
                onClick={() => setCategoryPickerOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-muted hover:text-text"
                aria-label="Tutup"
              >
                ×
              </button>
            </div>
            <div className="mt-4 space-y-3 overflow-y-auto pr-2" style={{ maxHeight: '48vh' }}>
              {availableCategories.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border-subtle px-4 py-6 text-center text-sm text-muted">
                  Semua kategori sudah ditambahkan.
                </div>
              ) : (
                availableCategories.map((category) => (
                  <label
                    key={category.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface px-4 py-3 text-sm font-medium text-text"
                  >
                    <div>
                      <div>{category.name}</div>
                      {category.group_name && <div className="text-xs text-muted">{category.group_name}</div>}
                    </div>
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border-border"
                      checked={categorySelections.includes(category.id)}
                      onChange={() => {
                        setCategorySelections((prev) =>
                          prev.includes(category.id)
                            ? prev.filter((id) => id !== category.id)
                            : [...prev, category.id]
                        );
                      }}
                    />
                  </label>
                ))
              )}
            </div>
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setCategoryPickerOpen(false)}
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-border bg-surface px-4 text-sm font-semibold text-text"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAddSelectedCategories}
                disabled={categorySelections.length === 0}
                className="inline-flex h-10 items-center gap-2 rounded-2xl bg-brand px-4 text-sm font-semibold text-brand-foreground shadow transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Tambah {categorySelections.length > 0 ? `(${categorySelections.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}

