import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, Download, Plus } from 'lucide-react';
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

  const handleRequestDeleteEntry = (entry: GoalEntryRecord) => {
    setPendingEntryDelete(entry);
  };

  const handleConfirmDeleteEntry = async () => {
    if (!pendingEntryDelete || !selectedGoal) return;
    setEntryDeletingId(pendingEntryDelete.id);
    try {
      await deleteEntry(pendingEntryDelete.id);
      addToast('Setoran berhasil dihapus', 'success');
      const list = await listGoalEntries(selectedGoal.id);
      setEntries(list);
      await refreshGoals();
    } catch (error) {
      logError('deleteEntry', error);
      addToast('Gagal menghapus setoran', 'error');
    } finally {
      setEntryDeletingId(null);
      setPendingEntryDelete(null);
    }
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

  const handleConfirmDeleteGoal = async () => {
    if (!pendingGoalDelete) return;
    setDeleteLoading(true);
    try {
      await deleteGoal(pendingGoalDelete.id);
      setGoals((prev) => prev.filter((item) => item.id !== pendingGoalDelete.id));
      addToast('Goal berhasil dihapus', 'success');
      await refreshGoals();
    } catch (error) {
      logError('deleteGoal', error);
      addToast('Gagal menghapus goal', 'error');
    } finally {
      setDeleteLoading(false);
      setPendingGoalDelete(null);
    }
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
        </div>

        <SummaryCards summary={summary} />

        <section aria-live="polite" className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted">Memuat goals…</p>
          ) : goals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-surface-1/70 p-8 text-center text-sm text-muted">
              Belum ada goal yang tercatat. Mulai dengan menambahkan goal baru.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {goals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onEdit={handleEditGoal}
                  onOpenEntries={handleOpenEntries}
                  onToggleArchive={handleToggleArchive}
                  onDelete={handleRequestDeleteGoal}
                  archiveLoading={archiveLoadingId === goal.id}
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
