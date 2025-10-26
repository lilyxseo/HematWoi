import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Loader2, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';

import Page from '../../../layout/Page';
import PageHeader from '../../../layout/PageHeader';
import Section from '../../../layout/Section';
import Modal from '../../../components/Modal';
import { useToast } from '../../../context/ToastContext';
import { formatCurrency } from '../../../lib/format';
import {
  listCategories,
  type CategoryRecord,
} from '../../../lib/api-categories';
import {
  createSalarySimulation,
  deleteSalarySimulation,
  deleteSalarySimulationItem,
  listSalarySimulationItems,
  listSalarySimulations,
  type SalarySimulationItemRecord,
  type SalarySimulationSummary,
  type SaveSalarySimulationInput,
  type SaveSimulationItemInput,
  upsertSalarySimulationItem,
  updateSalarySimulation,
} from '../../../lib/api-salary-simulation';

interface SimulationFormState {
  title: string;
  period: string;
  salaryAmount: string;
  notes: string;
}

interface ItemFormState {
  categoryId: string;
  allocationAmount: string;
  allocationPercent: string;
  notes: string;
}

interface CategoryOption {
  id: string;
  name: string;
  type: 'income' | 'expense';
}

interface RefreshOptions {
  silent?: boolean;
  signal?: { cancelled: boolean };
}

function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function formatPeriodLabel(period: string): string {
  if (!period) return 'Tanpa periode';
  const [yearStr, monthStr] = period.split('-');
  const year = Number.parseInt(yearStr ?? '', 10);
  const month = Number.parseInt(monthStr ?? '', 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return period;
  }
  try {
    return new Intl.DateTimeFormat('id-ID', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(year, month - 1, 1));
  } catch (error) {
    return period;
  }
}

function sanitizeNumberString(value: string): string {
  return value.replace(/[^0-9.,-]/g, '').replace(',', '.');
}

function createDefaultSimulationState(): SimulationFormState {
  return {
    title: '',
    period: getCurrentPeriod(),
    salaryAmount: '',
    notes: '',
  };
}

function createDefaultItemState(): ItemFormState {
  return {
    categoryId: '',
    allocationAmount: '',
    allocationPercent: '',
    notes: '',
  };
}

function SimulationFormModal({
  open,
  initial,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  initial: SalarySimulationSummary | null;
  onClose: () => void;
  onSubmit: (values: SaveSalarySimulationInput) => void;
  submitting: boolean;
}) {
  const [form, setForm] = useState<SimulationFormState>(createDefaultSimulationState);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        title: initial.title ?? '',
        period: initial.period,
        salaryAmount: initial.salary_amount.toString(),
        notes: initial.notes ?? '',
      });
    } else {
      setForm(createDefaultSimulationState());
    }
  }, [open, initial]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const salaryStr = sanitizeNumberString(form.salaryAmount);
    const parsedSalary = Number.parseFloat(salaryStr);
    const payload: SaveSalarySimulationInput = {
      title: form.title.trim() || undefined,
      period: form.period,
      salaryAmount: Number.isFinite(parsedSalary) && parsedSalary >= 0 ? parsedSalary : 0,
      notes: form.notes.trim() || undefined,
    };
    onSubmit(payload);
  };

  return (
    <Modal
      open={open}
      title={initial ? 'Edit simulasi gaji' : 'Tambah simulasi gaji'}
      onClose={submitting ? () => {} : onClose}
    >
      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text" htmlFor="simulation-title">
            Nama simulasi
          </label>
          <input
            id="simulation-title"
            type="text"
            className="input"
            placeholder="Contoh: Gaji Mei"
            value={form.title}
            onChange={(event) => setForm((state) => ({ ...state, title: event.target.value }))}
            disabled={submitting}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text" htmlFor="simulation-period">
              Periode gaji
            </label>
            <input
              id="simulation-period"
              type="month"
              className="input"
              value={form.period}
              onChange={(event) => setForm((state) => ({ ...state, period: event.target.value }))}
              disabled={submitting}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text" htmlFor="simulation-salary">
              Nominal gaji (IDR)
            </label>
            <input
              id="simulation-salary"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              className="input"
              value={form.salaryAmount}
              onChange={(event) =>
                setForm((state) => ({ ...state, salaryAmount: sanitizeNumberString(event.target.value) }))
              }
              placeholder="0"
              required
              disabled={submitting}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text" htmlFor="simulation-notes">
            Catatan (opsional)
          </label>
          <textarea
            id="simulation-notes"
            className="textarea"
            rows={3}
            placeholder="Tambahkan catatan jika diperlukan"
            value={form.notes}
            onChange={(event) => setForm((state) => ({ ...state, notes: event.target.value }))}
            disabled={submitting}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            Batal
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Menyimpan...
              </span>
            ) : initial ? (
              'Simpan perubahan'
            ) : (
              'Tambah simulasi'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ItemFormModal({
  open,
  categories,
  usedCategoryIds,
  initial,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  categories: CategoryOption[];
  usedCategoryIds: Set<string>;
  initial: SalarySimulationItemRecord | null;
  onClose: () => void;
  onSubmit: (values: SaveSimulationItemInput) => void;
  submitting: boolean;
}) {
  const [form, setForm] = useState<ItemFormState>(createDefaultItemState);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        categoryId: initial.category_id,
        allocationAmount: initial.allocation_amount ? String(initial.allocation_amount) : '',
        allocationPercent:
          initial.allocation_percent != null ? String(initial.allocation_percent) : '',
        notes: initial.notes ?? '',
      });
    } else {
      setForm(createDefaultItemState());
    }
  }, [open, initial]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amountStr = sanitizeNumberString(form.allocationAmount);
    const percentStr = sanitizeNumberString(form.allocationPercent);
    const amount = Number.parseFloat(amountStr);
    const percent = percentStr === '' ? null : Number.parseFloat(percentStr);
    const payload: SaveSimulationItemInput = {
      categoryId: form.categoryId,
      allocationAmount: Number.isFinite(amount) && amount >= 0 ? amount : 0,
      allocationPercent:
        percent == null || !Number.isFinite(percent) ? null : Math.max(0, percent),
      notes: form.notes.trim() || undefined,
    };
    onSubmit(payload);
  };

  const optionCount = categories.length;

  return (
    <Modal
      open={open}
      title={initial ? 'Edit alokasi gaji' : 'Tambah alokasi gaji'}
      onClose={submitting ? () => {} : onClose}
    >
      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text" htmlFor="salary-item-category">
            Kategori tujuan
          </label>
          <select
            id="salary-item-category"
            className="input"
            value={form.categoryId}
            onChange={(event) => setForm((state) => ({ ...state, categoryId: event.target.value }))}
            disabled={submitting || optionCount === 0}
            required
          >
            <option value="" disabled>
              {optionCount === 0 ? 'Tidak ada kategori tersedia' : 'Pilih kategori'}
            </option>
            {categories.map((category) => {
              const disabled = usedCategoryIds.has(category.id) && category.id !== initial?.category_id;
              return (
                <option key={category.id} value={category.id} disabled={disabled}>
                  {category.name} · {category.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                </option>
              );
            })}
          </select>
          <p className="text-xs text-muted">
            Setiap kategori hanya dapat muncul satu kali di simulasi ini.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text" htmlFor="salary-item-amount">
              Nominal dialokasikan (IDR)
            </label>
            <input
              id="salary-item-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              className="input"
              placeholder="0"
              value={form.allocationAmount}
              onChange={(event) =>
                setForm((state) => ({ ...state, allocationAmount: sanitizeNumberString(event.target.value) }))
              }
              disabled={submitting}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text" htmlFor="salary-item-percent">
              Persentase dari gaji (% – opsional)
            </label>
            <input
              id="salary-item-percent"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              className="input"
              placeholder="Contoh: 20"
              value={form.allocationPercent}
              onChange={(event) =>
                setForm((state) => ({ ...state, allocationPercent: sanitizeNumberString(event.target.value) }))
              }
              disabled={submitting}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text" htmlFor="salary-item-notes">
            Catatan (opsional)
          </label>
          <textarea
            id="salary-item-notes"
            className="textarea"
            rows={3}
            placeholder="Tambahkan detail atau asumsi alokasi"
            value={form.notes}
            onChange={(event) => setForm((state) => ({ ...state, notes: event.target.value }))}
            disabled={submitting}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            Batal
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting || optionCount === 0}>
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Menyimpan...
              </span>
            ) : initial ? (
              'Simpan perubahan'
            ) : (
              'Tambah alokasi'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function SalarySimulationPage() {
  const { addToast } = useToast();
  const [period, setPeriod] = useState<string>(getCurrentPeriod());
  const [simulations, setSimulations] = useState<SalarySimulationSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [items, setItems] = useState<SalarySimulationItemRecord[]>([]);
  const [itemsLoading, setItemsLoading] = useState<boolean>(false);
  const [itemsError, setItemsError] = useState<string | null>(null);

  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState<boolean>(false);

  const [simulationModalOpen, setSimulationModalOpen] = useState(false);
  const [simulationSubmitting, setSimulationSubmitting] = useState(false);
  const [simulationEditing, setSimulationEditing] = useState<SalarySimulationSummary | null>(null);
  const [simulationDeleting, setSimulationDeleting] = useState(false);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemSubmitting, setItemSubmitting] = useState(false);
  const [itemEditing, setItemEditing] = useState<SalarySimulationItemRecord | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  const reloadSimulations = useCallback(
    async (options?: RefreshOptions) => {
      const { silent = false, signal } = options ?? {};
      if (!silent && !signal?.cancelled) {
        setLoading(true);
      }
      if (!signal?.cancelled) {
        setError(null);
      }
      try {
        const rows = await listSalarySimulations(period);
        if (signal?.cancelled) {
          return rows;
        }
        setSimulations(rows);
        return rows;
      } catch (err) {
        if (signal?.cancelled) {
          throw err;
        }
        const message = err instanceof Error ? err.message : 'Gagal memuat simulasi gaji';
        setSimulations([]);
        setError(message);
        throw new Error(message);
      } finally {
        if (!silent && !signal?.cancelled) {
          setLoading(false);
        }
      }
    },
    [period]
  );

  const reloadItems = useCallback(
    async (simulationId: string, options?: RefreshOptions) => {
      const { silent = false, signal } = options ?? {};
      if (!simulationId) {
        setItems([]);
        return [];
      }
      if (!silent && !signal?.cancelled) {
        setItemsLoading(true);
      }
      if (!signal?.cancelled) {
        setItemsError(null);
      }
      try {
        const rows = await listSalarySimulationItems(simulationId);
        if (signal?.cancelled) {
          return rows;
        }
        setItems(rows);
        return rows;
      } catch (err) {
        if (signal?.cancelled) {
          throw err;
        }
        const message = err instanceof Error ? err.message : 'Gagal memuat rincian alokasi';
        setItems([]);
        setItemsError(message);
        throw new Error(message);
      } finally {
        if (!silent && !signal?.cancelled) {
          setItemsLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const signal = { cancelled: false };
    reloadSimulations({ signal }).catch(() => {});
    return () => {
      signal.cancelled = true;
    };
  }, [reloadSimulations]);

  useEffect(() => {
    let active = true;
    setCategoriesLoading(true);
    listCategories()
      .then((rows) => {
        if (!active) return;
        setCategories(rows);
      })
      .catch((err) => {
        if (!active) return;
        setCategories([]);
        const message = err instanceof Error ? err.message : 'Gagal memuat kategori';
        addToast(message, 'error');
      })
      .finally(() => {
        if (!active) return;
        setCategoriesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [addToast]);

  useEffect(() => {
    if (!selectedId) {
      setItems([]);
      setItemsError(null);
      return;
    }
    const signal = { cancelled: false };
    reloadItems(selectedId, { signal }).catch(() => {});
    return () => {
      signal.cancelled = true;
    };
  }, [selectedId, reloadItems]);

  useEffect(() => {
    if (simulations.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !simulations.some((simulation) => simulation.id === selectedId)) {
      setSelectedId(simulations[0].id);
    }
  }, [simulations, selectedId]);

  const selectedSimulation = useMemo(
    () => simulations.find((simulation) => simulation.id === selectedId) ?? null,
    [simulations, selectedId]
  );

  const categoryOptions = useMemo<CategoryOption[]>(() => {
    const order: Record<'expense' | 'income', number> = { expense: 0, income: 1 };
    return [...categories]
      .map((category) => ({
        id: category.id,
        name: category.name,
        type: category.type,
      }))
      .sort((a, b) => {
        if (a.type !== b.type) {
          return order[a.type] - order[b.type];
        }
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
  }, [categories]);

  const usedCategoryIds = useMemo(() => {
    return new Set(items.map((item) => item.category_id));
  }, [items]);

  const handleRefresh = useCallback(() => {
    reloadSimulations().catch((err) => {
      if (err instanceof Error) {
        addToast(err.message, 'error');
      }
    });
  }, [reloadSimulations, addToast]);

  const openCreateSimulation = () => {
    setSimulationEditing(null);
    setSimulationModalOpen(true);
  };

  const openEditSimulation = () => {
    if (!selectedSimulation) return;
    setSimulationEditing(selectedSimulation);
    setSimulationModalOpen(true);
  };

  const handleSaveSimulation = async (payload: SaveSalarySimulationInput) => {
    setSimulationSubmitting(true);
    try {
      let record = simulationEditing;
      if (simulationEditing) {
        record = {
          ...simulationEditing,
          ...(await updateSalarySimulation(simulationEditing.id, payload)),
        };
        addToast('Simulasi diperbarui', 'success');
      } else {
        const created = await createSalarySimulation(payload);
        record = {
          id: created.id,
          user_id: created.user_id,
          title: created.title ?? null,
          salary_amount: created.salary_amount,
          period_month: created.period_month,
          period: created.period_month.slice(0, 7),
          notes: created.notes ?? null,
          created_at: created.created_at,
          updated_at: created.updated_at,
          total_allocations: 0,
          remaining: created.salary_amount,
          item_count: 0,
        };
        addToast('Simulasi dibuat', 'success');
      }
      setSimulationModalOpen(false);
      setSimulationEditing(null);
      await reloadSimulations({ silent: true });
      if (record) {
        setSelectedId(record.id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan simulasi';
      addToast(message, 'error');
    } finally {
      setSimulationSubmitting(false);
    }
  };

  const handleDeleteSimulation = async () => {
    if (!selectedSimulation || simulationDeleting) return;
    const confirmed = window.confirm('Hapus simulasi ini? Data alokasi juga akan dihapus.');
    if (!confirmed) return;
    setSimulationDeleting(true);
    try {
      await deleteSalarySimulation(selectedSimulation.id);
      addToast('Simulasi dihapus', 'success');
      const rows = await reloadSimulations({ silent: false });
      if (!rows.length) {
        setSelectedId(null);
        setItems([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus simulasi';
      addToast(message, 'error');
    } finally {
      setSimulationDeleting(false);
    }
  };

  const openCreateItem = () => {
    setItemEditing(null);
    setItemModalOpen(true);
  };

  const openEditItem = (item: SalarySimulationItemRecord) => {
    setItemEditing(item);
    setItemModalOpen(true);
  };

  const handleSaveItem = async (payload: SaveSimulationItemInput) => {
    if (!selectedSimulation) return;
    setItemSubmitting(true);
    try {
      await upsertSalarySimulationItem(selectedSimulation.id, itemEditing?.id ?? null, payload);
      addToast(itemEditing ? 'Alokasi diperbarui' : 'Alokasi ditambahkan', 'success');
      setItemModalOpen(false);
      setItemEditing(null);
      await reloadItems(selectedSimulation.id, { silent: true });
      await reloadSimulations({ silent: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan alokasi';
      addToast(message, 'error');
    } finally {
      setItemSubmitting(false);
    }
  };

  const handleDeleteItem = async (item: SalarySimulationItemRecord) => {
    if (deletingItemId) return;
    const confirmed = window.confirm('Hapus alokasi ini dari simulasi?');
    if (!confirmed) return;
    setDeletingItemId(item.id);
    try {
      await deleteSalarySimulationItem(item.id);
      addToast('Alokasi dihapus', 'success');
      if (selectedSimulation) {
        await reloadItems(selectedSimulation.id, { silent: true });
        await reloadSimulations({ silent: true });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus alokasi';
      addToast(message, 'error');
    } finally {
      setDeletingItemId(null);
    }
  };

  return (
    <Page>
      <PageHeader
        title="Simulasi alokasi gaji"
        description="Rencanakan pembagian gaji bulanan ke berbagai pos keuangan dan pantau sisa dana yang tersedia."
      >
        <button type="button" className="btn btn-ghost btn-sm" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={clsx('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
          Muat ulang
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={openCreateSimulation}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Tambah simulasi
        </button>
      </PageHeader>

      <Section first>
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-1 p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-muted">Periode yang ditampilkan</p>
              <div className="flex items-center gap-3">
                <input
                  type="month"
                  className="input max-w-[200px]"
                  value={period}
                  onChange={(event) => setPeriod(event.target.value || getCurrentPeriod())}
                />
                <span className="text-sm text-muted">{formatPeriodLabel(period)}</span>
              </div>
            </div>
            <p className="text-sm text-muted">
              Total simulasi: <span className="font-semibold text-text">{simulations.length}</span>
            </p>
          </div>

          {loading ? (
            <div className="flex min-h-[160px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted" aria-hidden="true" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-dashed border-danger/40 bg-danger/10 p-6 text-center text-sm text-danger">
              {error}
            </div>
          ) : simulations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-subtle bg-surface-2 p-6 text-center">
              <p className="text-sm font-medium text-text">Belum ada simulasi untuk periode ini</p>
              <p className="text-sm text-muted">
                Tambahkan simulasi baru untuk mulai mengalokasikan gaji kamu.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {simulations.map((simulation) => {
                const isActive = simulation.id === selectedId;
                return (
                  <button
                    key={simulation.id}
                    type="button"
                    onClick={() => setSelectedId(simulation.id)}
                    className={clsx(
                      'flex flex-col gap-4 rounded-2xl border bg-surface-2 p-4 text-left transition-colors hover:border-brand/50',
                      isActive ? 'border-brand ring-2 ring-brand/40' : 'border-border'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                          {formatPeriodLabel(simulation.period)}
                        </p>
                        <h3 className="mt-1 text-base font-semibold text-text">
                          {simulation.title || 'Simulasi tanpa nama'}
                        </h3>
                      </div>
                      <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
                        {simulation.item_count} alokasi
                      </span>
                    </div>
                    <div className="grid gap-3 rounded-xl bg-surface-1 p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted">Gaji</span>
                        <span className="font-semibold text-text">{formatCurrency(simulation.salary_amount, 'IDR')}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted">Dialokasikan</span>
                        <span className="font-semibold text-text">{formatCurrency(simulation.total_allocations, 'IDR')}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted">Sisa</span>
                        <span
                          className={clsx(
                            'font-semibold tabular-nums',
                            simulation.remaining < 0 ? 'text-danger' : 'text-success'
                          )}
                        >
                          {formatCurrency(simulation.remaining, 'IDR')}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Section>

      <Section>
        {selectedSimulation ? (
          <div className="rounded-2xl border border-border bg-surface-1 shadow-sm">
            <div className="flex flex-col gap-4 border-b border-border-subtle p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="min-w-0 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  <span>Periode</span>
                  <span className="rounded-full bg-muted/20 px-2 py-0.5 text-muted">
                    {formatPeriodLabel(selectedSimulation.period)}
                  </span>
                </div>
                <h2 className="text-lg font-semibold text-text">
                  {selectedSimulation.title || 'Simulasi tanpa nama'}
                </h2>
                <div className="flex flex-wrap gap-4 text-sm text-muted">
                  <span>Gaji: {formatCurrency(selectedSimulation.salary_amount, 'IDR')}</span>
                  <span>Dialokasikan: {formatCurrency(selectedSimulation.total_allocations, 'IDR')}</span>
                  <span>
                    Sisa:{' '}
                    <span
                      className={clsx(
                        'font-semibold',
                        selectedSimulation.remaining < 0 ? 'text-danger' : 'text-success'
                      )}
                    >
                      {formatCurrency(selectedSimulation.remaining, 'IDR')}
                    </span>
                  </span>
                </div>
                {selectedSimulation.notes && (
                  <p className="text-sm text-muted">Catatan: {selectedSimulation.notes}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={openEditSimulation}
                  disabled={simulationDeleting}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Edit simulasi
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={handleDeleteSimulation}
                  disabled={simulationDeleting}
                >
                  {simulationDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  )}
                  Hapus
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-text">Rincian alokasi</h3>
                  <p className="text-sm text-muted">
                    Distribusi kategori untuk simulasi ini.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={openCreateItem}
                  disabled={categoriesLoading}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Tambah alokasi
                </button>
              </div>

              {itemsLoading ? (
                <div className="flex min-h-[160px] items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted" aria-hidden="true" />
                </div>
              ) : itemsError ? (
                <div className="rounded-xl border border-dashed border-danger/40 bg-danger/10 p-6 text-center text-sm text-danger">
                  {itemsError}
                </div>
              ) : items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border-subtle bg-surface-2 p-6 text-center">
                  <p className="text-sm font-medium text-text">Belum ada alokasi untuk simulasi ini</p>
                  <p className="text-sm text-muted">
                    Tambahkan kategori untuk membagi gaji kamu.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border-subtle text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
                        <th className="px-4 py-3">Kategori</th>
                        <th className="px-4 py-3 text-right">Nominal</th>
                        <th className="px-4 py-3 text-right">Persentase</th>
                        <th className="px-4 py-3">Catatan</th>
                        <th className="px-4 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {items.map((item) => {
                        const percentLabel =
                          item.allocation_percent != null
                            ? `${item.allocation_percent.toFixed(2)}%`
                            : '—';
                        const isDeleting = deletingItemId === item.id;
                        return (
                          <tr key={item.id} className="text-sm">
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="font-medium text-text">
                                  {item.category?.name ?? 'Tanpa kategori'}
                                </span>
                                <span className="text-xs text-muted">
                                  {item.category?.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold tabular-nums text-text">
                              {formatCurrency(item.allocation_amount, 'IDR')}
                            </td>
                            <td className="px-4 py-3 text-right text-muted tabular-nums">{percentLabel}</td>
                            <td className="px-4 py-3 text-text">
                              {item.notes ? item.notes : <span className="text-muted">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs"
                                  onClick={() => openEditItem(item)}
                                  disabled={isDeleting}
                                >
                                  <Pencil className="h-4 w-4" aria-hidden="true" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-xs"
                                  onClick={() => handleDeleteItem(item)}
                                  disabled={isDeleting}
                                >
                                  {isDeleting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                  )}
                                  Hapus
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border-subtle bg-surface-2 p-6 text-center text-sm text-muted">
            Pilih simulasi untuk melihat rincian alokasi.
          </div>
        )}
      </Section>

      <SimulationFormModal
        open={simulationModalOpen}
        initial={simulationEditing}
        onClose={() => {
          if (simulationSubmitting) return;
          setSimulationModalOpen(false);
        }}
        onSubmit={handleSaveSimulation}
        submitting={simulationSubmitting}
      />

      <ItemFormModal
        open={itemModalOpen}
        initial={itemEditing}
        categories={categoryOptions}
        usedCategoryIds={usedCategoryIds}
        onClose={() => {
          if (itemSubmitting) return;
          setItemModalOpen(false);
        }}
        onSubmit={handleSaveItem}
        submitting={itemSubmitting}
      />
    </Page>
  );
}
