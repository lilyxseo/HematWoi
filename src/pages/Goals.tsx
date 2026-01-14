import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ChevronDown, Download, Plus, Target } from 'lucide-react';
import Page from '../layout/Page';
import PageHeader from '../layout/PageHeader';
import SummaryCards from '../components/goals/SummaryCards';
import GoalsFilterBar, { type GoalsFilterState } from '../components/goals/GoalsFilterBar';
import GoalCard from '../components/goals/GoalCard';
import GoalForm from '../components/goals/GoalForm';
import GoalEntriesDrawer from '../components/goals/GoalEntriesDrawer';
import ConfirmDialog from '../components/debts/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import {
  addEntry,
  createGoal,
  deleteEntry,
  deleteGoal,
  listGoalEntries,
  listGoals,
  updateGoal,
  type GoalEntryRecord,
  type GoalPayload,
  type GoalRecord,
  type GoalsSummary,
} from '../lib/api-goals';
import { listCategories } from '../lib/api-categories';
import { emitDataInvalidation } from '../lib/dataInvalidation';
import { invalidateGoalQueries } from '../lib/queryInvalidation';

interface CategoryOption {
  id: string;
  name: string;
}

const INITIAL_FILTERS: GoalsFilterState = {
  q: '',
  status: 'all',
  priority: 'all',
  dateField: 'created_at',
  dateFrom: null,
  dateTo: null,
  categoryId: 'all',
  sort: 'newest',
};

function formatDateISO(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function escapeCsv(value: string | number | null | undefined) {
  if (value == null) return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export default function Goals() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<GoalsFilterState>(INITIAL_FILTERS);
  const [goals, setGoals] = useState<GoalRecord[]>([]);
  const [summary, setSummary] = useState<GoalsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDesktopFilterView, setIsDesktopFilterView] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(min-width: 768px)').matches;
  });
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const filterPanelId = useId();

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingGoal, setEditingGoal] = useState<GoalRecord | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [entriesOpen, setEntriesOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<GoalRecord | null>(null);
  const [entries, setEntries] = useState<GoalEntryRecord[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entrySubmitting, setEntrySubmitting] = useState(false);
  const [entryDeletingId, setEntryDeletingId] = useState<string | null>(null);
  const [quickAddLoadingKey, setQuickAddLoadingKey] = useState<string | null>(null);

  const [pendingGoalDelete, setPendingGoalDelete] = useState<GoalRecord | null>(null);
  const [pendingEntryDelete, setPendingEntryDelete] = useState<GoalEntryRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [archiveLoadingId, setArchiveLoadingId] = useState<string | null>(null);

  const [categories, setCategories] = useState<CategoryOption[]>([]);

  const logError = useCallback((scope: string, error: unknown) => {
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.error(`[HW][Goals] ${scope}`, error);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const result = await listCategories();
        if (!active) return;
        setCategories(result.map((item) => ({ id: item.id, name: item.name })));
      } catch (error) {
        logError('categories', error);
      }
    })();
    return () => {
      active = false;
    };
  }, [logError]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const result = await listGoals(filters);
        if (!active) return;
        setGoals(result.items);
        setSummary(result.summary);
      } catch (error) {
        logError('listGoals', error);
        addToast('Gagal memuat daftar goal', 'error');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [filters, addToast, logError]);

  const refreshGoals = useCallback(async () => {
    try {
      const result = await listGoals(filters);
      setGoals(result.items);
      setSummary(result.summary);
    } catch (error) {
      logError('refreshGoals', error);
    }
  }, [filters, logError]);

  const handleFilterChange = (next: GoalsFilterState) => {
    setFilters(next);
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  const handleCreateClick = () => {
    setFormMode('create');
    setEditingGoal(null);
    setFormOpen(true);
  };

  const handleEditGoal = (goal: GoalRecord) => {
    setEditingGoal(goal);
    setFormMode('edit');
    setFormOpen(true);
  };

  const handleFormSubmit = async (payload: GoalPayload) => {
    setFormSubmitting(true);
    if (formMode === 'create') {
      try {
        const created = await createGoal(payload);
        setGoals((prev) => [created, ...prev]);
        addToast('Goal berhasil ditambahkan', 'success');
        await refreshGoals();
        setFormOpen(false);
      } catch (error) {
        logError('createGoal', error);
        addToast('Gagal menambahkan goal', 'error');
      } finally {
        setFormSubmitting(false);
      }
      return;
    }

    if (!editingGoal) {
      setFormSubmitting(false);
      return;
    }

    try {
      const updated = await updateGoal(editingGoal.id, payload);
      setGoals((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      addToast('Goal berhasil diperbarui', 'success');
      await refreshGoals();
      setFormOpen(false);
    } catch (error) {
      logError('updateGoal', error);
      addToast('Gagal memperbarui goal', 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleOpenEntries = async (goal: GoalRecord) => {
    setSelectedGoal(goal);
    setEntriesOpen(true);
    setEntriesLoading(true);
    try {
      const list = await listGoalEntries(goal.id);
      setEntries(list);
    } catch (error) {
      logError('listGoalEntries', error);
      addToast('Gagal memuat riwayat setoran', 'error');
    } finally {
      setEntriesLoading(false);
    }
  };

  const handleEntrySubmit = async (payload: { amount: number; date: string; note?: string | null }) => {
    if (!selectedGoal) return;
    setEntrySubmitting(true);
    try {
      await addEntry(selectedGoal.id, payload);
      addToast('Setoran berhasil dicatat', 'success');
      const list = await listGoalEntries(selectedGoal.id);
      setEntries(list);
      await refreshGoals();
    } catch (error) {
      logError('addEntry', error);
      addToast('Gagal menambahkan setoran', 'error');
    } finally {
      setEntrySubmitting(false);
    }
  };

  const handleQuickAdd = async (goal: GoalRecord, amount: number) => {
    const key = `${goal.id}-${amount}`;
    setQuickAddLoadingKey(key);
    try {
      await addEntry(goal.id, { amount, date: new Date().toISOString(), note: 'Tambah cepat' });
      addToast('Setoran cepat berhasil dicatat', 'success');
      if (selectedGoal?.id === goal.id) {
        const list = await listGoalEntries(goal.id);
        setEntries(list);
      }
      await refreshGoals();
    } catch (error) {
      logError('quickAdd', error);
      addToast('Gagal menambahkan setoran cepat', 'error');
    } finally {
      setQuickAddLoadingKey(null);
    }
  };

  const handleRequestDeleteEntry = (entry: GoalEntryRecord) => {
    setPendingEntryDelete(entry);
  };

  const deleteEntryMutation = useMutation({
    mutationFn: (entry: GoalEntryRecord) => deleteEntry(entry.id),
    onMutate: (entry) => {
      const snapshot = entries;
      const nextEntries = snapshot.filter((item) => item.id !== entry.id);
      setEntries(nextEntries);
      setEntryDeletingId(entry.id);
      if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
        // eslint-disable-next-line no-console
        console.debug('[delete:goal-entry]', {
          before: snapshot.length,
          after: nextEntries.length,
        });
      }
      return { snapshot };
    },
    onError: (error, _entry, context) => {
      if (context?.snapshot) {
        setEntries(context.snapshot);
      }
      logError('deleteEntry', error);
      addToast('Gagal menghapus setoran', 'error');
    },
    onSuccess: async (_data, _entry) => {
      addToast('Setoran berhasil dihapus', 'success');
      if (selectedGoal?.id) {
        const list = await listGoalEntries(selectedGoal.id);
        setEntries(list);
      }
      await refreshGoals();
      invalidateGoalQueries(queryClient);
      emitDataInvalidation({ entity: 'goals' });
    },
    onSettled: () => {
      setEntryDeletingId(null);
      setPendingEntryDelete(null);
    },
  });

  const handleConfirmDeleteEntry = async () => {
    if (!pendingEntryDelete || !selectedGoal) return;
    await deleteEntryMutation.mutateAsync(pendingEntryDelete);
  };

  const handleToggleArchive = async (goal: GoalRecord) => {
    const nextStatus = goal.status === 'archived' ? 'active' : 'archived';
    setArchiveLoadingId(goal.id);
    try {
      const updated = await updateGoal(goal.id, { ...goal, status: nextStatus });
      setGoals((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      addToast(nextStatus === 'archived' ? 'Goal diarsipkan' : 'Goal diaktifkan', 'success');
      await refreshGoals();
    } catch (error) {
      logError('archiveGoal', error);
      addToast('Gagal memperbarui status goal', 'error');
    } finally {
      setArchiveLoadingId(null);
    }
  };

  const handleRequestDeleteGoal = (goal: GoalRecord) => {
    setPendingGoalDelete(goal);
  };

  const deleteGoalMutation = useMutation({
    mutationFn: (goal: GoalRecord) => deleteGoal(goal.id),
    onMutate: (goal) => {
      const snapshot = goals;
      const nextGoals = snapshot.filter((item) => item.id !== goal.id);
      setGoals(nextGoals);
      setDeleteLoading(true);
      if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
        // eslint-disable-next-line no-console
        console.debug('[delete:goal]', {
          before: snapshot.length,
          after: nextGoals.length,
        });
      }
      return { snapshot };
    },
    onError: (error, _goal, context) => {
      if (context?.snapshot) {
        setGoals(context.snapshot);
      }
      logError('deleteGoal', error);
      addToast('Gagal menghapus goal', 'error');
    },
    onSuccess: async (_data, goal) => {
      addToast('Goal berhasil dihapus', 'success');
      await refreshGoals();
      invalidateGoalQueries(queryClient);
      emitDataInvalidation({ entity: 'goals', ids: [String(goal.id)] });
    },
    onSettled: () => {
      setDeleteLoading(false);
      setPendingGoalDelete(null);
    },
  });

  const handleConfirmDeleteGoal = async () => {
    if (!pendingGoalDelete) return;
    await deleteGoalMutation.mutateAsync(pendingGoalDelete);
  };

  const handleExportCsv = () => {
    try {
      const headers = [
        'Judul',
        'Deskripsi',
        'Target',
        'Terkumpul',
        'Sisa',
        'Mulai',
        'Jatuh Tempo',
        'Prioritas',
        'Status',
        'Kategori',
      ];
      const rows = goals.map((goal) => [
        goal.title,
        goal.description ?? '',
        goal.target_amount,
        goal.saved_amount,
        Math.max(goal.target_amount - goal.saved_amount, 0),
        formatDateISO(goal.start_date) ?? '',
        formatDateISO(goal.due_date) ?? '',
        goal.priority,
        goal.status,
        goal.category_id ?? '',
      ]);
      const csv = [headers, ...rows]
        .map((row) => row.map((cell) => escapeCsv(cell)).join(','))
        .join('\n');
      const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'hematwoi-goals.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      addToast('Data goal diekspor ke CSV', 'success');
    } catch (error) {
      logError('exportCsv', error);
      addToast('Gagal mengekspor CSV', 'error');
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktopFilterView(event.matches);
    };

    setIsDesktopFilterView(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const isFilterPanelVisible = isDesktopFilterView || filterPanelOpen;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status !== 'all') count += 1;
    if (filters.priority !== 'all') count += 1;
    if (filters.dateField !== 'created_at') count += 1;
    if (filters.dateFrom) count += 1;
    if (filters.dateTo) count += 1;
    if (filters.categoryId !== 'all') count += 1;
    if (filters.sort !== 'newest') count += 1;
    if (filters.q.trim()) count += 1;
    return count;
  }, [filters]);

  const nearestGoalTitle = useMemo(() => {
    const activeGoals = goals.filter((goal) => goal.status === 'active');
    if (activeGoals.length === 0) return null;
    const sorted = [...activeGoals].sort((a, b) => {
      const remainingA = Math.max(a.target_amount - a.saved_amount, 0);
      const remainingB = Math.max(b.target_amount - b.saved_amount, 0);
      return remainingA - remainingB;
    });
    return sorted[0]?.title ?? null;
  }, [goals]);

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string }[] = [];
    const statusLabelMap: Record<string, string> = {
      active: 'Aktif',
      paused: 'Ditahan',
      achieved: 'Tercapai',
      archived: 'Diarsipkan',
    };
    const priorityLabelMap: Record<string, string> = {
      low: 'Rendah',
      normal: 'Normal',
      high: 'Tinggi',
      urgent: 'Mendesak',
    };
    if (filters.status !== 'all') {
      chips.push({ key: 'status', label: `Status: ${statusLabelMap[filters.status] ?? filters.status}` });
    }
    if (filters.priority !== 'all') {
      chips.push({
        key: 'priority',
        label: `Prioritas: ${priorityLabelMap[filters.priority] ?? filters.priority}`,
      });
    }
    if (filters.dateField !== 'created_at') chips.push({ key: 'dateField', label: 'Tanggal: target' });
    if (filters.dateFrom) chips.push({ key: 'dateFrom', label: `Dari: ${filters.dateFrom}` });
    if (filters.dateTo) chips.push({ key: 'dateTo', label: `Sampai: ${filters.dateTo}` });
    if (filters.categoryId !== 'all') {
      const categoryName = categories.find((item) => item.id === filters.categoryId)?.name ?? 'Kategori';
      chips.push({ key: 'category', label: `Kategori: ${categoryName}` });
    }
    if (filters.sort !== 'newest') chips.push({ key: 'sort', label: `Urut: ${filters.sort}` });
    if (filters.q.trim()) chips.push({ key: 'q', label: `Cari: ${filters.q}` });
    return chips;
  }, [filters, categories]);

  const toggleFilterPanel = () => {
    if (isDesktopFilterView) return;
    setFilterPanelOpen((prev) => !prev);
  };

  return (
    <Page maxWidthClassName="max-w-[1400px]" paddingClassName="px-3 sm:px-4 md:px-6">
      <PageHeader
        title="Goals"
        description="Atur dan pantau progres tabungan tujuan finansial kamu secara menyeluruh."
      >
        <button
          type="button"
          onClick={handleCreateClick}
          className="inline-flex h-[40px] items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground shadow transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Tambah Goal
        </button>
        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex h-[40px] items-center gap-2 rounded-xl border border-border bg-surface-1 px-4 text-sm font-medium text-text transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Export CSV
        </button>
      </PageHeader>

      <div className="space-y-[var(--section-y)]">
        <div className="space-y-3">
          <button
            type="button"
            onClick={toggleFilterPanel}
            className={clsx(
              'md:hidden flex w-full items-center justify-between gap-3 rounded-2xl border border-border/60 bg-surface-1/90 px-4 py-3 text-sm font-semibold text-text shadow-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]',
            )}
            aria-controls={filterPanelId}
            aria-expanded={isDesktopFilterView ? true : filterPanelOpen}
          >
            <span className="flex items-center gap-2">
              Filter
              {activeFilterCount > 0 ? (
                <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-brand-foreground">
                  {activeFilterCount}
                </span>
              ) : null}
            </span>
            <ChevronDown
              className={clsx(
                'h-4 w-4 text-muted transition-transform duration-200',
                isFilterPanelVisible ? 'rotate-180' : 'rotate-0',
              )}
              aria-hidden="true"
            />
          </button>

          <div
            id={filterPanelId}
            aria-hidden={!isDesktopFilterView && !isFilterPanelVisible}
            className={clsx(
              'transition-[max-height,opacity] duration-200 ease-in-out',
              'md:max-h-none md:opacity-100 md:transition-none md:overflow-visible md:pointer-events-auto',
              !isDesktopFilterView && 'overflow-hidden',
              !isDesktopFilterView && isFilterPanelVisible && 'mt-3',
              !isDesktopFilterView && !isFilterPanelVisible && 'pointer-events-none',
              isFilterPanelVisible ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0',
            )}
          >
            <GoalsFilterBar
              filters={filters}
              categories={categories}
              onChange={handleFilterChange}
              onReset={handleResetFilters}
            />
          </div>
          {activeFilterChips.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
              <span className="text-[11px] uppercase tracking-wide">Filter aktif</span>
              {activeFilterChips.map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex items-center rounded-full border border-border/60 bg-surface-1 px-3 py-1 text-xs font-semibold text-text"
                >
                  {chip.label}
                </span>
              ))}
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand transition hover:bg-brand/15"
              >
                Reset semua
              </button>
            </div>
          ) : null}
        </div>

        <SummaryCards summary={summary} nearestGoalTitle={nearestGoalTitle} />

        <section aria-live="polite" className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted">Memuat goals…</p>
          ) : goals.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-surface-1/70 p-8 text-center text-sm text-muted">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                <Target className="h-6 w-6" aria-hidden="true" />
              </span>
              <p>Belum ada goal yang tercatat. Mulai dengan menambahkan goal baru.</p>
              <button
                type="button"
                onClick={handleCreateClick}
                className="inline-flex h-[40px] items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground shadow transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Tambah Goal Pertama
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              {goals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onEdit={handleEditGoal}
                  onOpenEntries={handleOpenEntries}
                  onToggleArchive={handleToggleArchive}
                  onDelete={handleRequestDeleteGoal}
                  archiveLoading={archiveLoadingId === goal.id}
                  onQuickAdd={handleQuickAdd}
                  quickAddLoadingKey={quickAddLoadingKey}
                  className={goal.priority === 'urgent' ? 'xl:col-span-2' : undefined}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <GoalForm
        open={formOpen}
        mode={formMode}
        initialData={editingGoal}
        categories={categories}
        submitting={formSubmitting}
        onSubmit={handleFormSubmit}
        onClose={() => setFormOpen(false)}
      />

      <GoalEntriesDrawer
        open={entriesOpen}
        goal={selectedGoal}
        entries={entries}
        loading={entriesLoading}
        submitting={entrySubmitting}
        deletingId={entryDeletingId}
        onClose={() => {
          setEntriesOpen(false);
          setSelectedGoal(null);
          setPendingEntryDelete(null);
          setEntryDeletingId(null);
        }}
        onSubmit={handleEntrySubmit}
        onDeleteEntry={handleRequestDeleteEntry}
      />

      <ConfirmDialog
        open={Boolean(pendingGoalDelete)}
        title="Hapus goal?"
        description={pendingGoalDelete ? `Anda yakin ingin menghapus goal "${pendingGoalDelete.title}"?` : ''}
        confirmLabel="Hapus"
        destructive
        loading={deleteLoading}
        onConfirm={handleConfirmDeleteGoal}
        onCancel={() => setPendingGoalDelete(null)}
      />

      <ConfirmDialog
        open={Boolean(pendingEntryDelete)}
        title="Hapus setoran?"
        description="Setoran yang dihapus tidak dapat dikembalikan."
        confirmLabel="Hapus"
        destructive
        loading={Boolean(entryDeletingId)}
        onConfirm={handleConfirmDeleteEntry}
        onCancel={() => {
          setPendingEntryDelete(null);
          setEntryDeletingId(null);
        }}
      />
    </Page>
  );
}
