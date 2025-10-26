import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Copy,
  Clock,
  Loader2,
  Lock,
  PieChart,
  Plus,
  RefreshCw,
  Save,
  Unlock,
  Upload,
  X,
} from 'lucide-react';
import Page from '../../../../layout/Page';
import Section from '../../../../layout/Section';
import PageHeader from '../../../../layout/PageHeader';
import Card, { CardBody, CardFooter, CardHeader } from '../../../../components/Card';
import SectionHeader from '../../../../components/SectionHeader';
import CurrencyInput from '../../../../components/ui/CurrencyInput';
import Input from '../../../../components/ui/Input';
import Textarea from '../../../../components/ui/Textarea';
import Modal from '../../../../components/Modal';
import { useToast } from '../../../../context/ToastContext';
import useSupabaseUser from '../../../../hooks/useSupabaseUser';
import {
  applySalarySimulationToBudgets,
  createSalarySimulation,
  deleteSalarySimulation,
  duplicateSalarySimulation,
  getMonthlyBudgets,
  getSalarySimulations,
  listExpenseCategories,
  updateSalarySimulation,
  type BudgetSummaryByCategory,
  type ExpenseCategoryRecord,
  type SalarySimulationWithItems,
  type UUID,
} from '../../../../lib/salarySimulationApi';
import { formatCurrency } from '../../../../lib/format';
import { ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Tooltip, BarChart, CartesianGrid, XAxis, YAxis, Legend, Bar } from 'recharts';
import clsx from 'clsx';

interface AllocationRow {
  id: string;
  categoryId: string;
  categoryName: string;
  color?: string | null;
  amount: number;
  percent: number;
  locked: boolean;
}

interface DraftPayload {
  salaryAmount: number;
  periodMonth: string;
  title: string;
  notes: string;
  allocations: AllocationRow[];
}

const DRAFT_KEY = 'hw:salary-simulation-draft';

function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function toMonthIso(period: string): string {
  if (period.length === 7) return `${period}-01`;
  if (period.length === 10) return period;
  return `${period.slice(0, 7)}-01`;
}

function toMonthLabel(period: string): string {
  const [year, month] = period.split('-').map((value) => Number.parseInt(value, 10));
  if (!year || !month) return period;
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function generateRowId(prefix = 'row'): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function useLocalDraft(initial: DraftPayload) {
  const [draft, setDraftState] = useState<DraftPayload>(initial);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) {
        setLoaded(true);
        return;
      }
      const parsed = JSON.parse(raw) as DraftPayload;
      if (parsed) {
        setDraftState({
          salaryAmount: parsed.salaryAmount ?? initial.salaryAmount,
          periodMonth: parsed.periodMonth ?? initial.periodMonth,
          title: parsed.title ?? initial.title,
          notes: parsed.notes ?? initial.notes,
          allocations: Array.isArray(parsed.allocations) ? parsed.allocations : initial.allocations,
        });
      }
    } catch (error) {
      console.warn('[HW] failed to parse salary simulation draft', error);
    } finally {
      setLoaded(true);
    }
  }, [initial.salaryAmount, initial.periodMonth, initial.title, initial.notes, initial.allocations]);

  const updateDraft = useCallback((updater: (current: DraftPayload) => DraftPayload) => {
    setDraftState((current) => {
      const next = updater(current);
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
      saveTimer.current = window.setTimeout(() => {
        try {
          window.localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
        } catch (error) {
          console.warn('[HW] failed to persist salary simulation draft', error);
        }
      }, 400);
      return next;
    });
  }, []);

  const clearDraft = useCallback(() => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
    }
    window.localStorage.removeItem(DRAFT_KEY);
    setDraftState({
      salaryAmount: initial.salaryAmount,
      periodMonth: initial.periodMonth,
      title: initial.title,
      notes: initial.notes,
      allocations: [...initial.allocations],
    });
  }, [initial]);

  return { draft, setDraft: updateDraft, loaded, clearDraft };
}

interface AllocationTableProps {
  rows: AllocationRow[];
  salaryAmount: number;
  budgetLookup: Map<string, number>;
  onAmountChange: (rowId: string, nextAmount: number) => void;
  onPercentChange: (rowId: string, nextPercent: number) => void;
  onToggleLock: (rowId: string) => void;
  onRemove: (rowId: string) => void;
}

function AllocationTable({
  rows,
  salaryAmount,
  budgetLookup,
  onAmountChange,
  onPercentChange,
  onToggleLock,
  onRemove,
}: AllocationTableProps) {
  return (
    <div className="space-y-4">
      <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-3 text-xs font-medium text-muted md:grid">
        <div>Kategori</div>
        <div className="text-right">Alokasi (Rp)</div>
        <div className="text-right">Alokasi (%)</div>
        <div className="text-center">Kunci %</div>
        <div className="text-right">&nbsp;</div>
      </div>
      <div className="space-y-3">
        {rows.map((row) => {
          const planned = budgetLookup.get(row.categoryId) ?? 0;
          const overBudget = planned > 0 && row.amount > planned;
          return (
            <div
              key={row.id}
              className="grid grid-cols-1 gap-3 rounded-2xl border border-border-subtle bg-surface-alt p-3 text-sm md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:items-center md:gap-4"
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: row.color || '#38bdf8' }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-text">{row.categoryName}</p>
                  {planned > 0 ? (
                    <p className="text-xs text-muted">
                      Budget: {formatCurrency(planned)}
                      {overBudget ? (
                        <span className="ml-1 inline-flex items-center gap-1 text-error">
                          <AlertCircle className="h-3 w-3" /> Melebihi budget
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 md:justify-end">
                <input
                  type="number"
                  className="form-control h-10 w-full rounded-xl border-border-subtle text-right text-sm tabular-nums"
                  value={Number.isFinite(row.amount) ? row.amount : 0}
                  min={0}
                  step={5000}
                  onChange={(event) => onAmountChange(row.id, Number.parseFloat(event.target.value) || 0)}
                />
              </div>
              <div className="flex items-center justify-between gap-2 md:justify-end">
                <input
                  type="number"
                  className="form-control h-10 w-full rounded-xl border-border-subtle text-right text-sm tabular-nums"
                  value={Number.isFinite(row.percent) ? row.percent : 0}
                  min={0}
                  max={100}
                  step={0.5}
                  onChange={(event) => onPercentChange(row.id, Number.parseFloat(event.target.value) || 0)}
                />
              </div>
              <div className="flex items-center justify-start md:justify-center">
                <button
                  type="button"
                  onClick={() => onToggleLock(row.id)}
                  className={clsx(
                    'inline-flex h-10 w-10 items-center justify-center rounded-xl border text-sm transition-colors',
                    row.locked
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border-subtle bg-white text-muted hover:text-text'
                  )}
                  aria-pressed={row.locked}
                >
                  {row.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                </button>
              </div>
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => onRemove(row.id)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-subtle bg-surface-alt px-4 py-10 text-center text-sm text-muted">
            Belum ada kategori yang dipilih. Gunakan tombol “Tambah Kategori”.
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface CategoryPickerDialogProps {
  open: boolean;
  categories: ExpenseCategoryRecord[];
  selectedIds: Set<string>;
  onClose: () => void;
  onSubmit: (selected: string[]) => void;
}

function CategoryPickerDialog({ open, categories, selectedIds, onClose, onSubmit }: CategoryPickerDialogProps) {
  const [buffer, setBuffer] = useState<Set<string>>(new Set());

  useEffect(() => {
    setBuffer(new Set(selectedIds));
  }, [selectedIds, open]);

  const toggle = useCallback((categoryId: string) => {
    setBuffer((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  const handleSubmit = useCallback(() => {
    onSubmit(Array.from(buffer));
    onClose();
  }, [buffer, onSubmit, onClose]);

  return (
    <Modal open={open} title="Pilih Kategori" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Pilih kategori pengeluaran yang ingin dialokasikan dalam simulasi ini.
        </p>
        <div className="space-y-2">
          {categories.map((category) => (
            <label
              key={category.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle px-4 py-3 text-sm"
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: category.color || '#38bdf8' }}
                />
                <span className="font-medium text-text">{category.name}</span>
                {category.group_name ? (
                  <span className="text-xs text-muted">· {category.group_name}</span>
                ) : null}
              </div>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={buffer.has(category.id)}
                onChange={() => toggle(category.id)}
              />
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn" onClick={onClose}>
            Batal
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit}>
            Simpan Pilihan
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface SummaryHighlightProps {
  salaryAmount: number;
  totalAllocation: number;
  topCategory?: { name: string; percent: number } | null;
}

function SummaryHighlight({ salaryAmount, totalAllocation, topCategory }: SummaryHighlightProps) {
  const remaining = salaryAmount - totalAllocation;
  const percentage = salaryAmount > 0 ? (totalAllocation / salaryAmount) * 100 : 0;
  const remainingPercent = clampPercent(100 - percentage);
  const overAllocated = remaining < 0;
  return (
    <div className="space-y-3 text-sm">
      <p className="text-base font-semibold text-text">Insight Singkat</p>
      <p className="text-muted">
        {overAllocated ? (
          <>
            Alokasi melebihi gaji sebesar{' '}
            <span className="font-semibold text-error">{formatCurrency(Math.abs(remaining))}</span>. Sesuaikan kembali agar tidak over-budget.
          </>
        ) : (
          <>
            Sisa gaji {formatCurrency(remaining)} ({remainingPercent.toFixed(1)}%).
            {topCategory ? (
              <> Alokasi terbesar pada “{topCategory.name}” {topCategory.percent.toFixed(1)}%.</>
            ) : null}
          </>
        )}
      </p>
    </div>
  );
}

interface ComparisonListProps {
  rows: Array<{ name: string; amount: number; planned: number }>;
}

function ComparisonList({ rows }: ComparisonListProps) {
  if (!rows.some((row) => row.planned > 0)) return null;
  const exceeding = rows.filter((row) => row.planned > 0 && row.amount > row.planned);
  if (exceeding.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-error">Kategori melebihi budget bulan ini:</p>
      <ul className="space-y-1 text-sm text-text">
        {exceeding.map((row) => (
          <li key={row.name} className="flex items-center justify-between gap-2 rounded-xl border border-error/30 bg-error/5 px-3 py-2">
            <span>{row.name}</span>
            <span className="text-xs text-error">
              +{formatCurrency(row.amount - row.planned)} dari {formatCurrency(row.planned)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface HistoryListProps {
  simulations: SalarySimulationWithItems[];
  onOpen: (simulation: SalarySimulationWithItems) => void;
  onDuplicate: (simulation: SalarySimulationWithItems) => void;
  onDelete: (simulation: SalarySimulationWithItems) => void;
  loading: boolean;
}

function HistoryList({ simulations, onOpen, onDuplicate, onDelete, loading }: HistoryListProps) {
  return (
    <Card>
      <CardHeader
        title="Riwayat Simulasi"
        subtext="Koleksi simulasi yang pernah Anda simpan."
        actions={
          loading ? (
            <span className="inline-flex items-center gap-2 text-xs text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat
            </span>
          ) : null
        }
      />
      <CardBody className="space-y-3">
        {simulations.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border-subtle bg-surface-alt px-4 py-6 text-sm text-muted">
            Simulasi yang disimpan akan muncul di sini.
          </p>
        ) : (
          <ul className="space-y-3">
            {simulations.map((simulation) => (
              <li
                key={simulation.id}
                className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-alt p-4 text-sm text-text md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-base font-semibold">{simulation.title || 'Tanpa judul'}</p>
                  <p className="text-xs text-muted">
                    {toMonthLabel(simulation.period_month.slice(0, 7))} · Gaji {formatCurrency(simulation.salary_amount)} · Alokasi {formatCurrency(simulation.items.reduce((sum, item) => sum + Number(item.allocation_amount ?? 0), 0))}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => onOpen(simulation)}>
                    Buka
                  </button>
                  <button type="button" className="btn btn-sm" onClick={() => onDuplicate(simulation)}>
                    Duplikasi
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost text-error"
                    onClick={() => onDelete(simulation)}
                  >
                    Hapus
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function buildDefaultDraft(): DraftPayload {
  const period = getCurrentPeriod();
  return {
    salaryAmount: 0,
    periodMonth: `${period}-01`,
    title: `Simulasi Gajian ${toMonthLabel(period)}`,
    notes: '',
    allocations: [],
  };
}

export default function SalarySimulationPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user, loading: userLoading } = useSupabaseUser();

  const defaultDraft = useMemo(() => buildDefaultDraft(), []);
  const { draft, setDraft, loaded: draftLoaded, clearDraft } = useLocalDraft(defaultDraft);
  const [allocations, setAllocations] = useState<AllocationRow[]>(defaultDraft.allocations);
  const [salaryAmount, setSalaryAmount] = useState(defaultDraft.salaryAmount);
  const [period, setPeriod] = useState(defaultDraft.periodMonth.slice(0, 7));
  const [title, setTitle] = useState(defaultDraft.title);
  const [notes, setNotes] = useState(defaultDraft.notes);

  const [categories, setCategories] = useState<ExpenseCategoryRecord[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);

  const [budgetSummaries, setBudgetSummaries] = useState<BudgetSummaryByCategory[]>([]);
  const [budgetLoading, setBudgetLoading] = useState(false);

  const [simulations, setSimulations] = useState<SalarySimulationWithItems[]>([]);
  const [simulationsLoading, setSimulationsLoading] = useState(false);
  const [currentSimulationId, setCurrentSimulationId] = useState<UUID | null>(null);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyConfirmed, setApplyConfirmed] = useState(false);

  useEffect(() => {
    if (!userLoading && !user) {
      navigate('/auth');
    }
  }, [userLoading, user, navigate]);

  useEffect(() => {
    setCategoriesLoading(true);
    listExpenseCategories()
      .then((data) => setCategories(data))
      .catch((error) => addToast(error.message || 'Gagal memuat kategori', 'error'))
      .finally(() => setCategoriesLoading(false));
  }, [addToast]);

  useEffect(() => {
    if (!draftLoaded) return;
    setSalaryAmount(draft.salaryAmount);
    setPeriod(draft.periodMonth.slice(0, 7));
    setTitle(draft.title);
    setNotes(draft.notes);
    setAllocations(draft.allocations);
  }, [draft, draftLoaded]);

  useEffect(() => {
    if (!period) return;
    const isoPeriod = toMonthIso(period);
    setBudgetLoading(true);
    getMonthlyBudgets(isoPeriod)
      .then((data) => setBudgetSummaries(data))
      .catch((error) => addToast(error.message || 'Gagal memuat budget bulanan', 'error'))
      .finally(() => setBudgetLoading(false));
  }, [period, addToast]);

  const refreshSimulations = useCallback(() => {
    setSimulationsLoading(true);
    getSalarySimulations()
      .then((data) => setSimulations(data))
      .catch((error) => addToast(error.message || 'Gagal memuat simulasi', 'error'))
      .finally(() => setSimulationsLoading(false));
  }, [addToast]);

  useEffect(() => {
    refreshSimulations();
  }, [refreshSimulations]);

  const budgetLookup = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of budgetSummaries) {
      map.set(item.categoryId, item.planned);
    }
    return map;
  }, [budgetSummaries]);

  useEffect(() => {
    if (!draftLoaded) return;
    setDraft(() => ({
      salaryAmount,
      periodMonth: toMonthIso(period),
      title,
      notes,
      allocations,
    }));
  }, [salaryAmount, period, title, notes, allocations, draftLoaded, setDraft]);

  const selectedCategoryIds = useMemo(() => new Set(allocations.map((item) => item.categoryId)), [allocations]);

  const totalAllocation = useMemo(() => allocations.reduce((sum, item) => sum + item.amount, 0), [allocations]);
  const remaining = salaryAmount - totalAllocation;
  const totalPercent = salaryAmount > 0 ? (totalAllocation / salaryAmount) * 100 : 0;
  const overAllocated = remaining < 0;

  const handleAmountChange = useCallback(
    (rowId: string, nextAmount: number) => {
      setAllocations((current) => {
        return current.map((row) => {
          if (row.id !== rowId) return row;
          const amount = Math.max(0, nextAmount);
          const percent = salaryAmount > 0 ? Number(((amount / salaryAmount) * 100).toFixed(2)) : 0;
          return { ...row, amount, percent };
        });
      });
    },
    [salaryAmount]
  );

  const handlePercentChange = useCallback(
    (rowId: string, nextPercent: number) => {
      setAllocations((current) => {
        return current.map((row) => {
          if (row.id !== rowId) return row;
          const percent = clampPercent(nextPercent);
          const amount = salaryAmount > 0 ? Number(((percent / 100) * salaryAmount).toFixed(0)) : 0;
          return { ...row, percent, amount };
        });
      });
    },
    [salaryAmount]
  );

  const handleToggleLock = useCallback((rowId: string) => {
    setAllocations((current) =>
      current.map((row) => (row.id === rowId ? { ...row, locked: !row.locked } : row))
    );
  }, []);

  const handleRemove = useCallback((rowId: string) => {
    setAllocations((current) => current.filter((row) => row.id !== rowId));
  }, []);

  const handleAddCategories = useCallback(
    (selected: string[]) => {
      const newRows: AllocationRow[] = [];
      for (const id of selected) {
        if (selectedCategoryIds.has(id)) continue;
        const category = categories.find((item) => item.id === id);
        if (!category) continue;
        newRows.push({
          id: generateRowId('alloc'),
          categoryId: id,
          categoryName: category.name,
          color: category.color,
          amount: 0,
          percent: 0,
          locked: false,
        });
      }
      if (newRows.length === 0) return;
      setAllocations((current) => [...current, ...newRows]);
    },
    [categories, selectedCategoryIds]
  );

  const handleReset = useCallback(() => {
    setSalaryAmount(defaultDraft.salaryAmount);
    setPeriod(defaultDraft.periodMonth.slice(0, 7));
    setTitle(defaultDraft.title);
    setNotes(defaultDraft.notes);
    setAllocations(defaultDraft.allocations);
    setCurrentSimulationId(null);
    setApplyConfirmed(false);
    clearDraft();
  }, [defaultDraft, clearDraft]);

  const mapAllocationsToInput = useCallback(() => {
    return allocations.map((row) => ({
      categoryId: row.categoryId,
      allocationAmount: row.amount,
      allocationPercent: Number.isFinite(row.percent) ? Number(row.percent.toFixed(2)) : null,
      notes: null,
    }));
  }, [allocations]);

  const handleSave = useCallback(async () => {
    if (salaryAmount <= 0) {
      addToast('Nominal gaji harus lebih dari 0', 'error');
      return;
    }
    if (allocations.length === 0) {
      addToast('Pilih minimal satu kategori untuk dialokasikan', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      title: title || null,
      salaryAmount,
      periodMonth: toMonthIso(period),
      notes: notes || null,
      items: mapAllocationsToInput(),
    };
    try {
      if (currentSimulationId) {
        await updateSalarySimulation(currentSimulationId, payload);
        addToast('Simulasi diperbarui', 'success');
      } else {
        const created = await createSalarySimulation(payload);
        setCurrentSimulationId(created.id);
        addToast('Simulasi disimpan', 'success');
      }
      refreshSimulations();
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Gagal menyimpan simulasi', 'error');
    } finally {
      setSaving(false);
    }
  }, [salaryAmount, allocations, title, period, notes, currentSimulationId, mapAllocationsToInput, addToast, refreshSimulations]);

  const handleDuplicate = useCallback(async () => {
    if (currentSimulationId) {
      try {
        const duplicated = await duplicateSalarySimulation(currentSimulationId);
        addToast('Simulasi berhasil diduplikasi', 'success');
        setCurrentSimulationId(duplicated.id);
        setSalaryAmount(duplicated.salary_amount);
        setPeriod(duplicated.period_month.slice(0, 7));
        setTitle(duplicated.title ?? '');
        setNotes(duplicated.notes ?? '');
        setAllocations(
          duplicated.items.map((item) => ({
            id: generateRowId('alloc'),
            categoryId: item.category_id,
            categoryName: item.category?.name ?? 'Tanpa kategori',
            color: item.category?.color ?? null,
            amount: Number(item.allocation_amount ?? 0),
            percent:
              duplicated.salary_amount > 0
                ? Number(((Number(item.allocation_amount ?? 0) / duplicated.salary_amount) * 100).toFixed(2))
                : 0,
            locked: false,
          }))
        );
        refreshSimulations();
      } catch (error) {
        addToast(error instanceof Error ? error.message : 'Gagal menduplikasi simulasi', 'error');
      }
      return;
    }
    // If current changes are unsaved, treat duplication as saving a new copy
    try {
      const created = await createSalarySimulation({
        title: title ? `${title} (Salinan)` : null,
        salaryAmount,
        periodMonth: toMonthIso(period),
        notes: notes || null,
        items: mapAllocationsToInput(),
      });
      setCurrentSimulationId(created.id);
      addToast('Salinan baru berhasil dibuat', 'success');
      refreshSimulations();
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Gagal menduplikasi simulasi', 'error');
    }
  }, [currentSimulationId, addToast, salaryAmount, period, notes, title, mapAllocationsToInput, refreshSimulations]);

  const handleOpenSimulation = useCallback((simulation: SalarySimulationWithItems) => {
    setCurrentSimulationId(simulation.id);
    setSalaryAmount(simulation.salary_amount);
    setPeriod(simulation.period_month.slice(0, 7));
    setTitle(simulation.title ?? '');
    setNotes(simulation.notes ?? '');
    setAllocations(
      simulation.items.map((item) => ({
        id: generateRowId('alloc'),
        categoryId: item.category_id,
        categoryName: item.category?.name ?? 'Tanpa kategori',
        color: item.category?.color ?? null,
        amount: Number(item.allocation_amount ?? 0),
        percent:
          simulation.salary_amount > 0
            ? Number(((Number(item.allocation_amount ?? 0) / simulation.salary_amount) * 100).toFixed(2))
            : 0,
        locked: false,
      }))
    );
    addToast('Simulasi dimuat', 'info');
  }, [addToast]);

  const handleDuplicateFromHistory = useCallback(
    async (simulation: SalarySimulationWithItems) => {
      try {
        const duplicated = await duplicateSalarySimulation(simulation.id);
        addToast('Simulasi berhasil diduplikasi', 'success');
        refreshSimulations();
        handleOpenSimulation(duplicated);
      } catch (error) {
        addToast(error instanceof Error ? error.message : 'Gagal menduplikasi simulasi', 'error');
      }
    },
    [addToast, refreshSimulations, handleOpenSimulation]
  );

  const handleDeleteSimulation = useCallback(
    async (simulation: SalarySimulationWithItems) => {
      if (!window.confirm(`Hapus simulasi "${simulation.title ?? 'Tanpa judul'}"?`)) return;
      try {
        await deleteSalarySimulation(simulation.id);
        addToast('Simulasi dihapus', 'success');
        if (currentSimulationId === simulation.id) {
          handleReset();
        }
        refreshSimulations();
      } catch (error) {
        addToast(error instanceof Error ? error.message : 'Gagal menghapus simulasi', 'error');
      }
    },
    [addToast, currentSimulationId, handleReset, refreshSimulations]
  );

  const handleAutoDistribute = useCallback(() => {
    if (salaryAmount <= 0) {
      addToast('Isi nominal gaji terlebih dahulu', 'warning');
      return;
    }
    setAllocations((current) => {
      const lockedRows = current.filter((row) => row.locked);
      const unlockedRows = current.filter((row) => !row.locked);
      if (unlockedRows.length === 0) return current;

      const lockedAmount = lockedRows.reduce((sum, row) => sum + row.amount, 0);
      const remainingAmount = Math.max(0, salaryAmount - lockedAmount);

      const updates = new Map<string, { amount: number; percent: number }>();
      if (remainingAmount === 0) {
        for (const row of unlockedRows) {
          updates.set(row.id, { amount: 0, percent: 0 });
        }
      } else {
        const basis = unlockedRows.map((row) => budgetLookup.get(row.categoryId) ?? 0);
        const totalBasis = basis.reduce((sum, value) => sum + value, 0);
        let running = 0;
        unlockedRows.forEach((row, index) => {
          let amount: number;
          if (totalBasis > 0) {
            if (index === unlockedRows.length - 1) {
              amount = Math.max(0, remainingAmount - running);
            } else {
              amount = Math.round((basis[index] / totalBasis) * remainingAmount);
            }
          } else if (index === unlockedRows.length - 1) {
            amount = Math.max(0, remainingAmount - running);
          } else {
            amount = Math.floor(remainingAmount / unlockedRows.length);
          }
          running += amount;
          updates.set(row.id, {
            amount,
            percent: salaryAmount > 0 ? Number(((amount / salaryAmount) * 100).toFixed(2)) : 0,
          });
        });
      }

      return current.map((row) => {
        const update = updates.get(row.id);
        if (!update) return row;
        return { ...row, ...update };
      });
    });
  }, [salaryAmount, addToast, budgetLookup]);

  const handleApplyToBudget = useCallback(async () => {
    if (!currentSimulationId) {
      addToast('Simpan simulasi terlebih dahulu sebelum menerapkan', 'warning');
      return;
    }
    if (!applyConfirmed) {
      addToast('Aktifkan konfirmasi terlebih dahulu', 'warning');
      return;
    }
    if (!window.confirm('Terapkan alokasi simulasi ini ke budget bulan aktif?')) return;
    setApplying(true);
    try {
      await applySalarySimulationToBudgets(currentSimulationId);
      addToast('Simulasi diterapkan ke budget', 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Gagal menerapkan simulasi', 'error');
    } finally {
      setApplying(false);
    }
  }, [currentSimulationId, applyConfirmed, addToast]);

  const donutData = useMemo(
    () => allocations.map((row) => ({ name: row.categoryName, value: row.amount })),
    [allocations]
  );

  const barData = useMemo(() => {
    return allocations.map((row) => ({
      name: row.categoryName,
      Simulasi: row.amount,
      Budget: budgetLookup.get(row.categoryId) ?? 0,
    }));
  }, [allocations, budgetLookup]);

  const topCategory = useMemo(() => {
    if (!allocations.length || salaryAmount <= 0) return null;
    const sorted = [...allocations].sort((a, b) => b.percent - a.percent);
    return sorted[0];
  }, [allocations, salaryAmount]);

  const summaryRows = useMemo(() => {
    return barData.map((row) => ({
      name: row.name,
      amount: row.Simulasi,
      planned: row.Budget,
    }));
  }, [barData]);

  if (userLoading || !draftLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Memuat halaman...
      </div>
    );
  }

  return (
    <Page className="space-y-8">
      <PageHeader
        title="Simulasi Gajian"
        description="Uji alokasi gaji ke kategori tanpa mengubah data asli."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Simpan Simulasi
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleDuplicate}>
              <Copy className="mr-2 h-4 w-4" /> Duplikasi
            </button>
            <button type="button" className="btn btn-link" onClick={handleReset}>
              <RefreshCw className="mr-2 h-4 w-4" /> Reset
            </button>
          </div>
        }
      />

      <Section first>
        <SectionHeader title="Setup Gaji & Periode" />
        <Card>
          <CardBody className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <CurrencyInput
                label="Nominal Gaji"
                value={salaryAmount}
                onChangeNumber={(value) => setSalaryAmount(Math.max(0, value))}
              />
              <Input
                label="Periode Bulan"
                type="month"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
              />
              <Input
                label="Judul Simulasi"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Simulasi Gajian"
              />
              <Textarea
                label="Catatan"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Catatan tambahan"
              />
            </div>
            <div className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-muted">
              {budgetLoading ? (
                <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Memuat budget bulan ini...</span>
              ) : budgetSummaries.length > 0 ? (
                <span>
                  Total budget bulan ini {formatCurrency(budgetSummaries.reduce((sum, item) => sum + item.planned, 0))}.{' '}
                  <a href="/budgets" className="font-semibold text-primary underline">Bandingkan dengan budget bulan ini</a>
                </span>
              ) : (
                <span>Belum ada budget bulan ini untuk dibandingkan.</span>
              )}
            </div>
          </CardBody>
        </Card>
      </Section>

      <Section>
        <SectionHeader title="Alokasi per Kategori">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCategoryPickerOpen(true)}
              disabled={categoriesLoading}
            >
              <Plus className="mr-2 h-4 w-4" /> Tambah Kategori
            </button>
            <button type="button" className="btn" onClick={handleAutoDistribute}>
              <RefreshCw className="mr-2 h-4 w-4" /> Auto-Distribusi
            </button>
          </div>
        </SectionHeader>
        <Card>
          <CardBody>
            <AllocationTable
              rows={allocations}
              salaryAmount={salaryAmount}
              budgetLookup={budgetLookup}
              onAmountChange={handleAmountChange}
              onPercentChange={handlePercentChange}
              onToggleLock={handleToggleLock}
              onRemove={handleRemove}
            />
            {overAllocated ? (
              <div className="mt-4 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
                Total alokasi melebihi nominal gaji. Kurangi sebagian alokasi agar tidak defisit.
              </div>
            ) : null}
          </CardBody>
        </Card>
      </Section>

      <Section>
        <SectionHeader title="Ringkasan & Grafik" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Card>
            <CardBody className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border-subtle bg-surface-alt p-4 text-sm">
                  <p className="text-xs text-muted">TOTAL GAJI</p>
                  <p className="text-xl font-semibold text-text">{formatCurrency(salaryAmount)}</p>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-surface-alt p-4 text-sm">
                  <p className="text-xs text-muted">TOTAL ALOKASI</p>
                  <p className="text-xl font-semibold text-text">{formatCurrency(totalAllocation)}</p>
                  <p className="text-xs text-muted">{clampPercent(totalPercent).toFixed(1)}% dari gaji</p>
                </div>
                <div className={clsx('rounded-2xl border p-4 text-sm', remaining < 0 ? 'border-error/60 bg-error/10 text-error' : 'border-border-subtle bg-surface-alt text-text')}>
                  <p className="text-xs text-muted">SISA GAJI</p>
                  <p className="text-xl font-semibold">{formatCurrency(remaining)}</p>
                  {remaining < 0 ? (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-error px-2 py-0.5 text-[11px] font-semibold text-white">
                      <AlertCircle className="h-3 w-3" /> Over-Allocated
                    </span>
                  ) : null}
                </div>
              </div>
              <SummaryHighlight
                salaryAmount={salaryAmount}
                totalAllocation={totalAllocation}
                topCategory={topCategory ? { name: topCategory.categoryName, percent: topCategory.percent } : null}
              />
              <ComparisonList rows={summaryRows} />
            </CardBody>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardHeader title="Komposisi Alokasi" subtext="Persentase tiap kategori" actions={<PieChart className="h-4 w-4 text-muted" />} />
              <CardBody>
                {allocations.length === 0 ? (
                  <p className="text-center text-sm text-muted">Tambah kategori untuk melihat grafik.</p>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer>
                      <RePieChart>
                        <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
                          {donutData.map((entry, index) => (
                            <Cell key={entry.name} fill={`hsl(${(index * 47) % 360} 70% 55%)`} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      </RePieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Simulasi vs Budget" subtext="Bandingkan dengan rencana bulan ini" actions={<BarChart3 className="h-4 w-4 text-muted" />} />
              <CardBody>
                {barData.length === 0 ? (
                  <p className="text-center text-sm text-muted">Belum ada data untuk dibandingkan.</p>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer>
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" hide />
                        <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
                        <Legend />
                        <Bar dataKey="Simulasi" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Budget" fill="#22c55e" radius={[4, 4, 0, 0]} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeader title="Tindakan Lanjutan" />
        <Card>
          <CardBody className="space-y-4">
            <div className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-alt p-4 text-sm text-text md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <Upload className="mt-1 h-5 w-5 text-muted" />
                <div>
                  <p className="font-semibold">Terapkan ke Budget</p>
                  <p className="text-sm text-muted">Simulasi tidak mengubah data sampai Anda menerapkan.</p>
                </div>
              </div>
              <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={applyConfirmed}
                    onChange={(event) => setApplyConfirmed(event.target.checked)}
                  />
                  Saya paham, ini akan memodifikasi budget bulan ini
                </label>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleApplyToBudget}
                  disabled={!applyConfirmed || applying}
                >
                  {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Terapkan ke Budget
                </button>
              </div>
            </div>
          </CardBody>
          <CardFooter>
            <div className="flex flex-col gap-3 text-sm text-muted md:flex-row md:items-center md:justify-between">
              <span>
                Simulasi ini hanya berupa draft hingga Anda menyimpan dan menerapkan ke budget.
              </span>
              <a href="/budgets" className="inline-flex items-center gap-2 text-primary">
                <Clock className="h-4 w-4" /> Kembali ke Budgets
              </a>
            </div>
          </CardFooter>
        </Card>
      </Section>

      <Section>
        <HistoryList
          simulations={simulations}
          onOpen={handleOpenSimulation}
          onDuplicate={handleDuplicateFromHistory}
          onDelete={handleDeleteSimulation}
          loading={simulationsLoading}
        />
      </Section>

      <CategoryPickerDialog
        open={categoryPickerOpen}
        categories={categories}
        selectedIds={selectedCategoryIds}
        onClose={() => setCategoryPickerOpen(false)}
        onSubmit={handleAddCategories}
      />
    </Page>
  );
}
