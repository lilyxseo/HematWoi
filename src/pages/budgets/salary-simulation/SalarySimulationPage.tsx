import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Copy,
  Lock,
  Plus,
  RefreshCcw,
  RotateCcw,
  Save,
  Sparkles,
  Unlock,
} from 'lucide-react';
import clsx from 'clsx';
import Page from '../../../layout/Page';
import PageHeader from '../../../layout/PageHeader';
import Card, { CardBody, CardFooter, CardHeader } from '../../../components/Card.jsx';
import CurrencyInput from '../../../components/ui/CurrencyInput.jsx';
import Input from '../../../components/ui/Input.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Modal from '../../../components/Modal.jsx';
import { useToast } from '../../../context/ToastContext';
import { formatCurrency } from '../../../lib/format.js';
import { supabase } from '../../../lib/supabase.js';
import {
  applySalarySimulationToBudgets,
  createSalarySimulation,
  deleteSalarySimulation,
  duplicateSalarySimulation,
  getMonthlyBudgets,
  getSalarySimulationById,
  getSalarySimulations,
  listExpenseCategories,
  updateSalarySimulation,
  type ExpenseCategoryRecord,
  type MonthlyBudgetRecord,
  type SalarySimulationRecord,
} from '../../../lib/salarySimulationApi';
import {
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Label,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';

interface SimulationFormItem {
  id?: string;
  categoryId: string;
  categoryName: string;
  allocationAmount: number;
  allocationPercent: number;
  notes?: string | null;
  lockedPercent?: boolean;
}

interface SimulationFormState {
  id: string | null;
  title: string;
  salaryAmount: number;
  periodMonth: string;
  notes: string;
  items: SimulationFormItem[];
}

const DRAFT_STORAGE_KEY = 'hw:salary-sim-draft';

const FALLBACK_COLORS = [
  '#4338ca',
  '#f97316',
  '#0ea5e9',
  '#22c55e',
  '#ec4899',
  '#14b8a6',
  '#f59e0b',
  '#6366f1',
];

function getCurrentPeriod(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-01`;
}

function toMonthLabel(periodMonth: string): string {
  const normalized = periodMonth.slice(0, 7);
  const [year, month] = normalized.split('-').map((part) => Number.parseInt(part, 10));
  if (!year || Number.isNaN(year) || !month || Number.isNaN(month)) {
    return normalized;
  }
  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));
}

function buildDefaultTitle(periodMonth: string): string {
  return `Simulasi Gajian ${toMonthLabel(periodMonth)}`;
}

function sanitizeNumber(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round((value + Number.EPSILON) * 100) / 100);
}

function loadDraft(): SimulationFormState | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      id: parsed.id ?? null,
      title: parsed.title ?? buildDefaultTitle(getCurrentPeriod()),
      salaryAmount: Number(parsed.salaryAmount ?? 0),
      periodMonth: parsed.periodMonth ?? getCurrentPeriod(),
      notes: parsed.notes ?? '',
      items: Array.isArray(parsed.items)
        ? parsed.items.map((item: any) => ({
            id: item.id ?? undefined,
            categoryId: String(item.categoryId ?? item.category_id ?? ''),
            categoryName: item.categoryName ?? 'Tanpa kategori',
            allocationAmount: Number(item.allocationAmount ?? item.allocation_amount ?? 0),
            allocationPercent: Number(item.allocationPercent ?? item.allocation_percent ?? 0),
            notes: item.notes ?? null,
            lockedPercent: Boolean(item.lockedPercent ?? item.locked_percent ?? false),
          }))
        : [],
    } satisfies SimulationFormState;
  } catch (error) {
    console.warn('[salary-sim] gagal memuat draft', error);
    return null;
  }
}

function persistDraft(state: SimulationFormState) {
  try {
    localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        ...state,
        items: state.items.map((item) => ({
          ...item,
        })),
      }),
    );
  } catch (error) {
    console.warn('[salary-sim] gagal menyimpan draft', error);
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (error) {
    console.warn('[salary-sim] gagal menghapus draft', error);
  }
}

function resolveColor(index: number, category?: ExpenseCategoryRecord | null): string {
  if (category?.color) return category.color;
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function sumItems(items: SimulationFormItem[]): number {
  return items.reduce((total, item) => total + Number(item.allocationAmount ?? 0), 0);
}

function percentOf(amount: number, base: number): number {
  if (!base) return 0;
  return (amount / base) * 100;
}

interface AddCategoryModalProps {
  open: boolean;
  onClose: () => void;
  categories: ExpenseCategoryRecord[];
  selected: Set<string>;
  onSubmit: (ids: string[]) => void;
}

function AddCategoryModal({ open, onClose, categories, selected, onSubmit }: AddCategoryModalProps) {
  const [pending, setPending] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setPending([]);
  }, [open]);

  if (!open) return null;

  const available = categories.filter((category) => !selected.has(category.id));

  return (
    <Modal open={open} title="Tambah Kategori" onClose={onClose}>
      <div className="space-y-4">
        {available.length === 0 ? (
          <p className="text-sm text-muted">
            Semua kategori pengeluaran sudah ditambahkan ke simulasi ini.
          </p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit(pending);
              onClose();
            }}
          >
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted">
                Pilih kategori
              </legend>
              <div className="space-y-2">
                {available.map((category) => {
                  const checked = pending.includes(category.id);
                  return (
                    <label
                      key={category.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-alt px-3 py-2 text-sm shadow-sm"
                    >
                      <span className="font-medium text-text">{category.name}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          setPending((prev) => {
                            if (event.target.checked) {
                              return [...prev, category.id];
                            }
                            return prev.filter((id) => id !== category.id);
                          });
                        }}
                        className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
                      />
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={onClose} className="btn btn-ghost">
                Batal
              </button>
              <button type="submit" disabled={pending.length === 0} className="btn btn-primary">
                Tambah {pending.length ? `(${pending.length})` : ''}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}

function AllocationTable({
  items,
  salaryAmount,
  budgets,
  onAmountChange,
  onPercentChange,
  onRemove,
  onToggleLock,
}: {
  items: SimulationFormItem[];
  salaryAmount: number;
  budgets: Map<string, MonthlyBudgetRecord>;
  onAmountChange: (categoryId: string, amount: number) => void;
  onPercentChange: (categoryId: string, percent: number) => void;
  onRemove: (categoryId: string) => void;
  onToggleLock: (categoryId: string) => void;
}) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border-subtle bg-surface-alt/70 p-6 text-center text-sm text-muted">
        Belum ada kategori. Klik “Tambah Kategori” untuk memulai alokasi gaji.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border-subtle">
      <table className="min-w-full divide-y divide-border-subtle text-sm">
        <thead className="bg-surface-alt/80 text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3 text-left">Kategori</th>
            <th className="px-4 py-3 text-right">Alokasi (Rp)</th>
            <th className="px-4 py-3 text-right">Alokasi (%)</th>
            <th className="px-4 py-3 text-right">Budget Bulan Ini</th>
            <th className="px-4 py-3 text-right">Selisih</th>
            <th className="px-4 py-3 text-right">Terkunci</th>
            <th className="px-4 py-3 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle bg-surface">
          {items.map((item) => {
            const planned = budgets.get(item.categoryId)?.planned ?? 0;
            const diff = item.allocationAmount - planned;
            const over = diff > 0 && planned > 0;
            return (
              <tr key={item.categoryId} className="align-top">
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-medium text-text">{item.categoryName}</span>
                    {item.notes ? <span className="text-xs text-muted">{item.notes}</span> : null}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={0}
                    value={Number.isFinite(item.allocationAmount) ? item.allocationAmount : 0}
                    onChange={(event) => onAmountChange(item.categoryId, Number(event.target.value ?? 0))}
                    className="w-full rounded-xl border border-border-subtle bg-surface-alt px-3 py-2 text-right text-sm font-medium text-text focus-visible:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={0}
                    max={200}
                    step={0.1}
                    value={Number.isFinite(item.allocationPercent) ? item.allocationPercent : 0}
                    onChange={(event) => onPercentChange(item.categoryId, Number(event.target.value ?? 0))}
                    className="w-full rounded-xl border border-border-subtle bg-surface-alt px-3 py-2 text-right text-sm font-medium text-text focus-visible:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                  />
                </td>
                <td className="px-4 py-3 text-right text-sm text-muted">
                  {planned > 0 ? formatCurrency(planned) : '—'}
                </td>
                <td
                  className={clsx(
                    'px-4 py-3 text-right text-sm font-medium',
                    over ? 'text-red-500' : diff < 0 ? 'text-emerald-500' : 'text-muted',
                  )}
                >
                  {planned > 0 ? formatCurrency(diff) : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onToggleLock(item.categoryId)}
                    className={clsx(
                      'inline-flex items-center gap-1 rounded-xl border px-3 py-1 text-xs font-semibold transition',
                      item.lockedPercent
                        ? 'border-amber-500/70 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'
                        : 'border-border-subtle bg-surface-alt text-muted hover:bg-brand/10 hover:text-brand',
                    )}
                  >
                    {item.lockedPercent ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                    <span>{item.lockedPercent ? 'Terkunci' : 'Bebas'}</span>
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onRemove(item.categoryId)}
                    className="text-xs font-semibold text-red-500 transition hover:text-red-400"
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-surface-alt/80 text-sm font-semibold text-text">
          <tr>
            <td className="px-4 py-3 text-right" colSpan={1}>
              Total
            </td>
            <td className="px-4 py-3 text-right">{formatCurrency(sumItems(items))}</td>
            <td className="px-4 py-3 text-right">
              {salaryAmount > 0 ? `${percentOf(sumItems(items), salaryAmount).toFixed(1)}%` : '0%'}
            </td>
            <td colSpan={3} />
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function DonutChart({
  items,
  salaryAmount,
  categories,
}: {
  items: SimulationFormItem[];
  salaryAmount: number;
  categories: Map<string, ExpenseCategoryRecord>;
}) {
  const data = items
    .filter((item) => item.allocationAmount > 0)
    .map((item, index) => ({
      name: item.categoryName,
      value: item.allocationAmount,
      color: resolveColor(index, categories.get(item.categoryId)),
    }));

  if (!data.length) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center text-sm text-muted">
        Masukkan alokasi untuk melihat komposisi.
      </div>
    );
  }

  const total = sumItems(items);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <RechartsPieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="60%" outerRadius="80%" stroke="none" paddingAngle={1.5}>
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
          <Label
            content={({ viewBox }) => {
              if (!viewBox || !('cx' in viewBox) || !('cy' in viewBox)) return null;
              const { cx = 0, cy = 0 } = viewBox;
              return (
                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                  <tspan x={cx} y={cy - 6} className="fill-slate-900 text-xl font-semibold dark:fill-slate-100">
                    {formatCurrency(total)}
                  </tspan>
                  <tspan x={cx} y={cy + 12} className="fill-slate-500 text-xs font-medium dark:fill-slate-400">
                    {salaryAmount > 0 ? `${percentOf(total, salaryAmount).toFixed(1)}% dari gaji` : '—'}
                  </tspan>
                </text>
              );
            }}
          />
        </Pie>
        <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: 12, border: '1px solid rgba(148,163,184,0.4)' }} />
      </RechartsPieChart>
    </ResponsiveContainer>
  );
}

function ComparisonChart({
  items,
  budgets,
  categories,
}: {
  items: SimulationFormItem[];
  budgets: Map<string, MonthlyBudgetRecord>;
  categories: Map<string, ExpenseCategoryRecord>;
}) {
  const data = items.map((item, index) => ({
    name: item.categoryName,
    simulasi: item.allocationAmount,
    budget: budgets.get(item.categoryId)?.planned ?? 0,
    color: resolveColor(index, categories.get(item.categoryId)),
  }));

  if (!data.length) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center text-sm text-muted">
        Tambahkan kategori untuk melihat perbandingan dengan budget.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ left: 8, right: 8, top: 12 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-10} textAnchor="end" height={70} dy={10} />
        <YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
        <Tooltip formatter={(value: number) => formatCurrency(value)} />
        <Bar dataKey="simulasi" name="Simulasi" radius={[8, 8, 0, 0]} fill="#6366f1" />
        <Bar dataKey="budget" name="Budget" radius={[8, 8, 0, 0]} fill="#94a3b8" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function SummaryHighlight({
  label,
  value,
  helper,
  tone = 'default',
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: 'default' | 'success' | 'danger';
}) {
  return (
    <div
      className={clsx(
        'flex flex-col gap-1 rounded-2xl border px-4 py-3 text-sm',
        tone === 'danger'
          ? 'border-red-200/60 bg-red-500/5 text-red-600'
          : tone === 'success'
            ? 'border-emerald-200/60 bg-emerald-500/5 text-emerald-600'
            : 'border-border-subtle bg-surface-alt text-text',
      )}
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      <span className="text-lg font-semibold text-text">{value}</span>
      {helper ? <span className="text-xs text-muted">{helper}</span> : null}
    </div>
  );
}

function SimulationHistory({
  items,
  onOpen,
  onDuplicate,
  onDelete,
  busyId,
}: {
  items: SalarySimulationRecord[];
  onOpen: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  busyId: string | null;
}) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border-subtle bg-surface-alt/70 p-6 text-center text-sm text-muted">
        Simulasi yang tersimpan akan muncul di sini untuk kamu buka kembali atau duplikasi.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border-subtle overflow-hidden rounded-2xl border border-border-subtle">
      {items.map((simulation) => {
        const total = (simulation.items ?? []).reduce((acc, item) => acc + Number(item.allocation_amount ?? 0), 0);
        const remaining = Number(simulation.salary_amount ?? 0) - total;
        return (
          <div
            key={simulation.id}
            className="flex flex-col gap-3 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="space-y-1">
              <h4 className="text-base font-semibold text-text">{simulation.title ?? 'Simulasi Gajian'}</h4>
              <p className="text-xs text-muted">
                {toMonthLabel(simulation.period_month)} · Total alokasi {formatCurrency(total)} · Sisa {formatCurrency(remaining)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => onOpen(simulation.id)} className="btn btn-ghost btn-sm">
                Buka
              </button>
              <button
                type="button"
                onClick={() => onDuplicate(simulation.id)}
                className="btn btn-outline btn-sm"
                disabled={busyId === simulation.id}
              >
                <Copy className="mr-1 h-4 w-4" /> Duplikasi
              </button>
              <button
                type="button"
                onClick={() => onDelete(simulation.id)}
                className="btn btn-destructive btn-sm"
                disabled={busyId === simulation.id}
              >
                Hapus
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function SalarySimulationPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);

  const [categories, setCategories] = useState<ExpenseCategoryRecord[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [budgets, setBudgets] = useState<MonthlyBudgetRecord[]>([]);
  const [budgetsLoading, setBudgetsLoading] = useState(false);
  const [history, setHistory] = useState<SalarySimulationRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyBusyId, setHistoryBusyId] = useState<string | null>(null);

  const draft = useMemo(loadDraft, []);

  const [form, setForm] = useState<SimulationFormState>(() =>
    draft ?? {
      id: null,
      title: buildDefaultTitle(getCurrentPeriod()),
      salaryAmount: 0,
      periodMonth: getCurrentPeriod(),
      notes: '',
      items: [],
    },
  );

  const categoryMap = useMemo(() => {
    const map = new Map<string, ExpenseCategoryRecord>();
    for (const category of categories) {
      map.set(category.id, category);
    }
    return map;
  }, [categories]);

  const budgetMap = useMemo(() => {
    const map = new Map<string, MonthlyBudgetRecord>();
    for (const budget of budgets) {
      if (budget.category_id) {
        map.set(budget.category_id, budget);
      }
    }
    return map;
  }, [budgets]);

  const totalAllocated = useMemo(() => sumItems(form.items), [form.items]);
  const remaining = form.salaryAmount - totalAllocated;
  const overAllocated = remaining < -1e-6;

  const highestAllocation = useMemo(() => {
    if (!form.items.length || form.salaryAmount <= 0) return null;
    const sorted = [...form.items].sort(
      (a, b) => percentOf(b.allocationAmount, form.salaryAmount) - percentOf(a.allocationAmount, form.salaryAmount),
    );
    const [top] = sorted;
    if (!top) return null;
    return {
      name: top.categoryName,
      percent: percentOf(top.allocationAmount, form.salaryAmount),
    };
  }, [form.items, form.salaryAmount]);

  const exceedingBudgets = useMemo(
    () =>
      form.items.filter((item) => {
        const planned = budgetMap.get(item.categoryId)?.planned ?? 0;
        if (!planned) return false;
        return item.allocationAmount > planned;
      }),
    [form.items, budgetMap],
  );

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        const session = data.session;
        if (!session?.user) {
          navigate('/auth', { replace: true });
          return;
        }
        setUserId(session.user.id);
      })
      .catch(() => {
        if (!active) return;
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        navigate('/auth', { replace: true });
        return;
      }
      setUserId(session.user.id);
    });

    return () => {
      active = false;
      subscription.subscription?.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    if (!userId) return;
    setCategoriesLoading(true);
    listExpenseCategories(userId)
      .then((data) => setCategories(data))
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Gagal memuat kategori';
        addToast(message, 'error');
      })
      .finally(() => setCategoriesLoading(false));
  }, [userId, addToast]);

  useEffect(() => {
    if (!userId) return;
    setHistoryLoading(true);
    getSalarySimulations(userId)
      .then((data) => setHistory(data))
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Gagal memuat riwayat simulasi';
        addToast(message, 'error');
      })
      .finally(() => setHistoryLoading(false));
  }, [userId, addToast]);

  useEffect(() => {
    if (!userId || !form.periodMonth) return;
    setBudgetsLoading(true);
    getMonthlyBudgets(userId, form.periodMonth)
      .then((data) => setBudgets(data))
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Gagal memuat budget bulan ini';
        addToast(message, 'error');
      })
      .finally(() => setBudgetsLoading(false));
  }, [userId, form.periodMonth, addToast]);

  useEffect(() => {
    persistDraft(form);
  }, [form]);

  const setItems = useCallback(
    (updater: (prev: SimulationFormItem[]) => SimulationFormItem[]) => {
      setForm((prev) => ({ ...prev, items: updater(prev.items) }));
    },
    [],
  );

  const handleAmountChange = useCallback(
    (categoryId: string, nextAmount: number) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.categoryId !== categoryId) return item;
          const amount = sanitizeNumber(nextAmount);
          const percent = form.salaryAmount > 0 ? (amount / form.salaryAmount) * 100 : 0;
          return {
            ...item,
            allocationAmount: amount,
            allocationPercent: sanitizeNumber(percent),
          };
        }),
      );
    },
    [setItems, form.salaryAmount],
  );

  const handlePercentChange = useCallback(
    (categoryId: string, nextPercent: number) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.categoryId !== categoryId) return item;
          const percent = Math.max(0, sanitizeNumber(nextPercent));
          const amount = form.salaryAmount > 0 ? (percent / 100) * form.salaryAmount : 0;
          return {
            ...item,
            allocationPercent: percent,
            allocationAmount: sanitizeNumber(amount),
          };
        }),
      );
    },
    [setItems, form.salaryAmount],
  );

  const handleToggleLock = useCallback(
    (categoryId: string) => {
      setItems((prev) =>
        prev.map((item) =>
          item.categoryId === categoryId
            ? {
                ...item,
                lockedPercent: !item.lockedPercent,
              }
            : item,
        ),
      );
    },
    [setItems],
  );

  const handleRemoveItem = useCallback(
    (categoryId: string) => {
      setItems((prev) => prev.filter((item) => item.categoryId !== categoryId));
    },
    [setItems],
  );

  const handleAddCategories = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      setItems((prev) => {
        const existing = new Set(prev.map((item) => item.categoryId));
        const nextItems: SimulationFormItem[] = [...prev];
        for (const id of ids) {
          if (existing.has(id)) continue;
          const category = categoryMap.get(id);
          nextItems.push({
            categoryId: id,
            categoryName: category?.name ?? 'Tanpa kategori',
            allocationAmount: 0,
            allocationPercent: 0,
            notes: null,
            lockedPercent: false,
          });
        }
        return nextItems;
      });
    },
    [categoryMap, setItems],
  );

  const [addModalOpen, setAddModalOpen] = useState(false);

  const handleReset = useCallback(() => {
    setForm({
      id: null,
      title: buildDefaultTitle(form.periodMonth),
      salaryAmount: 0,
      periodMonth: form.periodMonth,
      notes: '',
      items: [],
    });
    clearDraft();
  }, [form.periodMonth]);

  const handleAutoDistribute = useCallback(() => {
    if (form.salaryAmount <= 0) {
      addToast('Isi nominal gaji terlebih dahulu untuk distribusi otomatis.', 'warning');
      return;
    }
    const lockedTotal = form.items
      .filter((item) => item.lockedPercent)
      .reduce((sum, item) => sum + item.allocationAmount, 0);
    const unlockedItems = form.items.filter((item) => !item.lockedPercent);
    if (!unlockedItems.length) {
      addToast('Tidak ada kategori yang bisa didistribusikan otomatis.', 'info');
      return;
    }
    const available = Math.max(0, form.salaryAmount - lockedTotal);
    const weights = unlockedItems.map((item) => budgetMap.get(item.categoryId)?.planned ?? 0);
    const totalWeight = weights.reduce((sum, value) => sum + value, 0);
    const useEqual = totalWeight <= 0.01;
    let remainder = available;
    setItems((prev) => {
      const next: SimulationFormItem[] = [];
      let unlockedIndex = 0;
      for (const item of prev) {
        if (item.lockedPercent) {
          next.push(item);
          continue;
        }
        const base = useEqual ? 1 : weights[unlockedIndex] ?? 0;
        const denom = useEqual ? unlockedItems.length : totalWeight;
        const raw = denom > 0 ? (available * base) / denom : 0;
        const amount = unlockedIndex === unlockedItems.length - 1 ? remainder : sanitizeNumber(raw);
        remainder = Math.max(0, remainder - amount);
        const percent = form.salaryAmount > 0 ? (amount / form.salaryAmount) * 100 : 0;
        next.push({
          ...item,
          allocationAmount: sanitizeNumber(amount),
          allocationPercent: sanitizeNumber(percent),
        });
        unlockedIndex += 1;
      }
      return next;
    });
  }, [form.salaryAmount, form.items, budgetMap, setItems, addToast]);

  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);

  const handleSave = useCallback(async () => {
    if (!userId) {
      addToast('Anda harus login untuk menyimpan simulasi.', 'error');
      return;
    }
    if (form.salaryAmount <= 0) {
      addToast('Nominal gaji harus lebih dari 0.', 'error');
      return;
    }
    if (!form.items.length) {
      addToast('Tambahkan minimal satu kategori untuk disimpan.', 'error');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        title: form.title?.trim() || buildDefaultTitle(form.periodMonth),
        salaryAmount: form.salaryAmount,
        periodMonth: form.periodMonth,
        notes: form.notes?.trim() || null,
        items: form.items.map((item) => ({
          categoryId: item.categoryId,
          allocationAmount: item.allocationAmount,
          allocationPercent: item.allocationPercent,
          notes: item.notes ?? null,
        })),
      };
      let saved: SalarySimulationRecord;
      if (form.id) {
        saved = await updateSalarySimulation(form.id, payload);
        addToast('Simulasi diperbarui.', 'success');
      } else {
        saved = await createSalarySimulation({ ...payload, userId });
        addToast('Simulasi tersimpan.', 'success');
      }
      setForm({
        id: saved.id,
        title: saved.title ?? buildDefaultTitle(saved.period_month),
        salaryAmount: saved.salary_amount,
        periodMonth: saved.period_month,
        notes: saved.notes ?? '',
        items: saved.items.map((item) => ({
          id: item.id,
          categoryId: item.category_id,
          categoryName:
            item.category?.name ??
            form.items.find((row) => row.categoryId === item.category_id)?.categoryName ??
              'Tanpa kategori',
          allocationAmount: item.allocation_amount,
          allocationPercent: item.allocation_percent,
          notes: item.notes,
          lockedPercent: form.items.find((row) => row.categoryId === item.category_id)?.lockedPercent ?? false,
        })),
      });
      setHistory((prev) => {
        const without = prev.filter((entry) => entry.id !== saved.id);
        return [saved, ...without];
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menyimpan simulasi';
      addToast(message, 'error');
    } finally {
      setSaving(false);
    }
  }, [userId, form, addToast]);

  const handleHistoryOpen = useCallback(
    async (id: string) => {
      try {
        const result = await getSalarySimulationById(id);
        if (!result) {
          addToast('Simulasi tidak ditemukan.', 'error');
          return;
        }
        setForm({
          id: result.id,
          title: result.title ?? buildDefaultTitle(result.period_month),
          salaryAmount: result.salary_amount,
          periodMonth: result.period_month,
          notes: result.notes ?? '',
          items: result.items.map((item) => ({
            id: item.id,
            categoryId: item.category_id,
            categoryName: item.category?.name ?? 'Tanpa kategori',
            allocationAmount: item.allocation_amount,
            allocationPercent: item.allocation_percent,
            notes: item.notes,
            lockedPercent: false,
          })),
        });
        addToast('Simulasi dimuat.', 'success');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gagal membuka simulasi';
        addToast(message, 'error');
      }
    },
    [addToast],
  );

  const handleHistoryDuplicate = useCallback(
    async (id: string) => {
      if (!userId) {
        addToast('Masuk untuk menduplikasi simulasi.', 'error');
        return;
      }
      try {
        setHistoryBusyId(id);
        const duplicated = await duplicateSalarySimulation(id, {
          userId,
          periodMonth: form.periodMonth,
        });
        setHistory((prev) => [duplicated, ...prev]);
        addToast('Simulasi berhasil diduplikasi.', 'success');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gagal menduplikasi simulasi';
        addToast(message, 'error');
      } finally {
        setHistoryBusyId(null);
      }
    },
    [userId, addToast, form.periodMonth],
  );

  const handleHistoryDelete = useCallback(
    async (id: string) => {
      if (!window.confirm('Hapus simulasi ini? Data tidak dapat dikembalikan.')) return;
      try {
        setHistoryBusyId(id);
        await deleteSalarySimulation(id);
        setHistory((prev) => prev.filter((item) => item.id !== id));
        if (form.id === id) {
          handleReset();
        }
        addToast('Simulasi dihapus.', 'success');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gagal menghapus simulasi';
        addToast(message, 'error');
      } finally {
        setHistoryBusyId(null);
      }
    },
    [addToast, handleReset, form.id],
  );

  const [confirmApply, setConfirmApply] = useState(false);

  const handleApply = useCallback(async () => {
    if (!userId || !form.id) {
      addToast('Simpan simulasi terlebih dahulu sebelum menerapkan.', 'error');
      return;
    }
    if (!confirmApply) {
      addToast('Aktifkan konfirmasi sebelum menerapkan ke budget.', 'warning');
      return;
    }
    if (
      !window.confirm(
        'Terapkan alokasi simulasi ini ke budget bulan aktif? Aksi ini akan mengganti planned amount.',
      )
    ) {
      return;
    }
    try {
      setApplying(true);
      await applySalarySimulationToBudgets(form.id, userId);
      addToast('Alokasi simulasi diterapkan ke budget bulan ini.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menerapkan simulasi ke budget';
      addToast(message, 'error');
    } finally {
      setApplying(false);
    }
  }, [userId, form.id, confirmApply, addToast]);

  const insights = useMemo(() => {
    const summaryParts: string[] = [];
    if (remaining >= 0) {
      const percent = form.salaryAmount > 0 ? percentOf(remaining, form.salaryAmount) : 0;
      summaryParts.push(`Sisa gaji ${formatCurrency(remaining)} (${percent.toFixed(1)}%).`);
    } else {
      summaryParts.push(`Alokasi melebihi gaji sebesar ${formatCurrency(Math.abs(remaining))}.`);
    }
    if (highestAllocation) {
      summaryParts.push(`Alokasi tertinggi pada “${highestAllocation.name}” sebesar ${highestAllocation.percent.toFixed(1)}%.`);
    }
    return summaryParts.join(' ');
  }, [remaining, highestAllocation, form.salaryAmount]);

  return (
    <Page>
      <PageHeader
        title="Simulasi Gajian"
        description="Uji alokasi gaji ke kategori tanpa mengubah data asli."
      >
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-ghost" onClick={handleReset}>
            <RotateCcw className="mr-1 h-4 w-4" /> Reset
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              if (!form.id) {
                addToast('Simpan simulasi terlebih dahulu untuk menggandakan.', 'info');
                return;
              }
              void handleHistoryDuplicate(form.id);
            }}
          >
            <Copy className="mr-1 h-4 w-4" /> Duplikasi
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || form.salaryAmount <= 0 || !form.items.length}
            className="btn btn-primary"
          >
            {saving ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Simpan Simulasi
          </button>
        </div>
      </PageHeader>

      <div className="space-y-8">
        <Card>
          <CardHeader
            title="Setup Gaji & Periode"
            subtext="Mulai dengan nominal gaji, periode, serta judul simulasi."
          />
          <CardBody className="grid gap-4 md:grid-cols-2">
            <CurrencyInput
              label="Nominal Gaji"
              value={form.salaryAmount}
              onChangeNumber={(value: number) =>
                setForm((prev) => ({
                  ...prev,
                  salaryAmount: value,
                  items: prev.items.map((item) => ({
                    ...item,
                    allocationPercent: value > 0 ? sanitizeNumber((item.allocationAmount / value) * 100) : 0,
                  })),
                }))
              }
              helper="Masukkan gaji bersih yang ingin dialokasikan."
            />
            <div className="space-y-4">
              <label className="form-label text-sm font-semibold text-text">Periode Bulan</label>
              <input
                type="month"
                value={form.periodMonth.slice(0, 7)}
                onChange={(event) => {
                  const next = `${event.target.value}-01`;
                  setForm((prev) => ({
                    ...prev,
                    periodMonth: next,
                    title:
                      prev.title === buildDefaultTitle(prev.periodMonth)
                        ? buildDefaultTitle(next)
                        : prev.title,
                  }));
                }}
                className="form-control"
              />
            </div>
            <Input
              label="Judul Simulasi"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Simulasi Gajian Januari"
            />
            <Textarea
              label="Catatan"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Catatan tambahan untuk simulasi ini"
            />
          </CardBody>
          <CardFooter>
            <div className="rounded-xl border border-dashed border-border-subtle bg-surface-alt/70 px-4 py-3 text-sm text-muted">
              {budgetsLoading ? (
                <span className="inline-flex items-center gap-2 text-xs font-medium text-muted">
                  <RefreshCcw className="h-4 w-4 animate-spin" /> Memuat budget bulan ini…
                </span>
              ) : budgets.length ? (
                <span>
                  Budget bulan ini total{' '}
                  {formatCurrency(budgets.reduce((sum, b) => sum + (b.planned ?? 0), 0))}.{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/budgets')}
                    className="font-semibold text-brand underline-offset-2 hover:underline"
                  >
                    Bandingkan dengan budget bulan ini
                  </button>
                </span>
              ) : (
                <span>Belum ada budget untuk periode ini.</span>
              )}
            </div>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader
            title="Alokasi per Kategori"
            subtext="Atur alokasi nominal dan persentase per kategori pengeluaran."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(true)}
                  className="btn btn-outline btn-sm"
                  disabled={categoriesLoading}
                >
                  <Plus className="mr-1 h-4 w-4" /> Tambah Kategori
                </button>
                <button type="button" onClick={handleAutoDistribute} className="btn btn-ghost btn-sm">
                  <Sparkles className="mr-1 h-4 w-4" /> Auto-Distribusi
                </button>
              </div>
            }
          />
          <CardBody>
            {overAllocated ? (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-500/10 px-4 py-3 text-sm text-red-600">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div>Total alokasi melebihi nominal gaji. Kurangi alokasi atau naikkan nominal gaji.</div>
              </div>
            ) : null}
            <AllocationTable
              items={form.items}
              salaryAmount={form.salaryAmount}
              budgets={budgetMap}
              onAmountChange={handleAmountChange}
              onPercentChange={handlePercentChange}
              onToggleLock={handleToggleLock}
              onRemove={handleRemoveItem}
            />
          </CardBody>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader title="Ringkasan" subtext="Pantau total alokasi dan sisa gaji." />
            <CardBody className="space-y-4">
              <div className="grid gap-3">
                <SummaryHighlight label="Total Gaji" value={formatCurrency(form.salaryAmount)} />
                <SummaryHighlight
                  label="Total Alokasi"
                  value={`${formatCurrency(totalAllocated)} (${form.salaryAmount > 0 ? percentOf(totalAllocated, form.salaryAmount).toFixed(1) : '0.0'}%)`}
                />
                <SummaryHighlight
                  label="Sisa Gaji"
                  value={formatCurrency(remaining)}
                  helper={overAllocated ? 'Over-Allocated' : undefined}
                  tone={overAllocated ? 'danger' : remaining > 0 ? 'success' : 'default'}
                />
              </div>
              <div className="rounded-xl border border-border-subtle bg-surface-alt/60 px-4 py-3 text-sm text-muted">
                {insights || 'Tambahkan data untuk melihat insight otomatis.'}
              </div>
              {exceedingBudgets.length ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Kategori melewati budget bulan ini
                  </p>
                  <ul className="space-y-1 text-sm">
                    {exceedingBudgets.map((item) => (
                      <li
                        key={item.categoryId}
                        className="flex items-center justify-between gap-3 rounded-xl bg-red-500/5 px-3 py-2 text-red-600"
                      >
                        <span className="font-medium">{item.categoryName}</span>
                        <span className="text-xs font-semibold">
                          {formatCurrency(item.allocationAmount - (budgetMap.get(item.categoryId)?.planned ?? 0))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader title="Komposisi Alokasi" subtext="Distribusi persentase per kategori." />
            <CardBody>
              <DonutChart items={form.items} salaryAmount={form.salaryAmount} categories={categoryMap} />
            </CardBody>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader title="Simulasi vs Budget" subtext="Bandingkan hasil simulasi dengan budget bulan aktif." />
            <CardBody>
              <ComparisonChart items={form.items} budgets={budgetMap} categories={categoryMap} />
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Tindakan Lanjutan"
            subtext="Terapkan hasil simulasi ke budget bulan aktif jika sudah siap."
          />
          <CardBody className="space-y-4">
            <label className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-alt px-4 py-3 text-sm">
              <input
                type="checkbox"
                checked={confirmApply}
                onChange={(event) => setConfirmApply(event.target.checked)}
                className="h-5 w-5 rounded border-border text-brand focus:ring-brand"
              />
              <span>Saya paham, ini akan memodifikasi budget bulan ini dengan angka pada simulasi ini.</span>
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleApply}
                disabled={!confirmApply || !form.id || applying}
                className="btn btn-primary"
              >
                {applying ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                Terapkan ke Budget
              </button>
              <button type="button" onClick={() => navigate('/budgets')} className="btn btn-ghost">
                Kembali ke Budgets
              </button>
              <span className="text-xs text-muted">Simulasi tidak mengubah data sampai Anda menerapkan.</span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Riwayat Simulasi"
            subtext="Kelola skenario simulasi yang pernah disimpan."
            actions={
              historyLoading ? (
                <RefreshCcw className="h-4 w-4 animate-spin text-muted" />
              ) : (
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">Riwayat</span>
              )
            }
          />
          <CardBody>
            <SimulationHistory
              items={history}
              onOpen={handleHistoryOpen}
              onDuplicate={handleHistoryDuplicate}
              onDelete={handleHistoryDelete}
              busyId={historyBusyId}
            />
          </CardBody>
        </Card>
      </div>

      <AddCategoryModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        categories={categories}
        selected={new Set(form.items.map((item) => item.categoryId))}
        onSubmit={handleAddCategories}
      />
    </Page>
  );
}
