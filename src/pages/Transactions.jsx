import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import {
  AlertTriangle,
  ArrowRightLeft,
  Check,
  ChevronDown,
  Download,
  Inbox,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import TransactionsFilters from "../components/transactions/TransactionsFilters";
import TransactionsTable from "../components/transactions/TransactionsTable";
import TransactionsCardList from "../components/transactions/TransactionsCardList";
import BatchToolbar from "../components/transactions/BatchToolbar";
import useTransactionsQuery from "../hooks/useTransactionsQuery";
import useNetworkStatus from "../hooks/useNetworkStatus";
import { useToast } from "../context/ToastContext";
import PageHeader from "../layout/PageHeader";
import { addTransaction, listAccounts, updateTransaction } from "../lib/api";
import {
  listTransactions,
  removeTransaction,
  removeTransactionsBulk,
  undoDeleteTransaction,
  undoDeleteTransactions,
} from "../lib/api-transactions";
import { formatCurrency } from "../lib/format";
import { flushQueue, onStatusChange, pending } from "../lib/sync/SyncEngine";
import { parseCSV } from "../lib/statement";

const TYPE_LABELS = {
  income: "Pemasukan",
  expense: "Pengeluaran",
  transfer: "Transfer",
};

const SORT_LABELS = {
  "date-desc": "Terbaru",
  "date-asc": "Terlama",
  "amount-desc": "Nominal Tertinggi",
  "amount-asc": "Nominal Terendah",
};

const PERIOD_LABELS = {
  all: "Semua",
  month: "Bulan ini",
  week: "Minggu ini",
  custom: "Rentang Custom",
};

const PAGE_DESCRIPTION = "Kelola catatan keuangan";

const FILTER_PANEL_BREAKPOINT = 768;
const FILTER_PANEL_STORAGE_KEY = "transactions-filter-open";

function toDateInput(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function formatIDR(value) {
  return formatCurrency(Number(value ?? 0), "IDR");
}

const TRANSACTION_DATE_FORMATTER =
  typeof Intl !== "undefined"
    ? new Intl.DateTimeFormat("id-ID", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

function formatTransactionDate(value) {
  if (!value) return "";
  try {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return String(value);
    return TRANSACTION_DATE_FORMATTER ? TRANSACTION_DATE_FORMATTER.format(date) : String(value);
  } catch {
    return String(value);
  }
}

function chunk(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export default function Transactions() {
  const {
    items: queryItems,
    total,
    page,
    loading,
    error,
    filter,
    setFilter,
    goToPage,
    refresh,
    categories,
    summary,
    pageSize,
  } = useTransactionsQuery();
  const { addToast } = useToast();
  const online = useNetworkStatus();
  const navigate = useNavigate();
  const [items, setItems] = useState(queryItems);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [bulkEditMode, setBulkEditMode] = useState(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [editTarget, setEditTarget] = useState(null);
  const filterBarRef = useRef(null);
  const filterPanelId = useId();
  const [filterBarHeight, setFilterBarHeight] = useState(0);
  const searchInputRef = useRef(null);
  const lastSelectedIdRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState(filter.search);
  const [filterBarStuck, setFilterBarStuck] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const undoTimerRef = useRef(null);
  const undoPayloadRef = useRef(null);
  const [snackbar, setSnackbar] = useState(null);
  const [undoLoading, setUndoLoading] = useState(false);
  const [isDesktopFilterView, setIsDesktopFilterView] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia(`(min-width: ${FILTER_PANEL_BREAKPOINT}px)`).matches;
  });
  const [filterPanelOpen, setFilterPanelOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const stored = window.sessionStorage.getItem(FILTER_PANEL_STORAGE_KEY);
      if (stored === null) return false;
      return stored === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    setItems(queryItems);
  }, [queryItems]);

  useEffect(() => {
    setSearchTerm(filter.search);
  }, [filter.search]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }
    const media = window.matchMedia(`(min-width: ${FILTER_PANEL_BREAKPOINT}px)`);
    const handleChange = (event) => {
      setIsDesktopFilterView(event.matches);
    };
    handleChange(media);
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(
        FILTER_PANEL_STORAGE_KEY,
        String(filterPanelOpen),
      );
    } catch {
      /* ignore persistence errors */
    }
  }, [filterPanelOpen]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!filterBarRef.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setFilterBarHeight(entry.contentRect.height);
    });
    observer.observe(filterBarRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = filterBarRef.current;
    if (!element) return;

    const updateStickyState = () => {
      const style = window.getComputedStyle(element);
      const topValue = parseFloat(style.top || "0");
      const { top } = element.getBoundingClientRect();
      setFilterBarStuck(top <= topValue + 1);
    };

    updateStickyState();
    window.addEventListener("scroll", updateStickyState, { passive: true });
    window.addEventListener("resize", updateStickyState);
    return () => {
      window.removeEventListener("scroll", updateStickyState);
      window.removeEventListener("resize", updateStickyState);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const count = await pending();
        if (mounted) setQueueCount(count);
      } catch (err) {
        console.error("Failed to check pending queue", err);
      }
    })();
    const unsubscribe = onStatusChange(async () => {
      try {
        const count = await pending();
        if (mounted) setQueueCount(count);
      } catch (err) {
        console.error("Failed to refresh queue count", err);
      }
    });
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    const handler = (event) => {
      if (event.defaultPrevented) return;
      const target = event.target;
      const tagName = target?.tagName;
      const isTyping = tagName === "INPUT" || tagName === "TEXTAREA" || target?.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "t") {
        event.preventDefault();
        handleNavigateToAdd();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "i") {
        event.preventDefault();
        setImportOpen(true);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "e") {
        event.preventDefault();
        handleExport();
        return;
      }
      if (
        !isTyping &&
        event.key === "/" &&
        (event.ctrlKey || event.metaKey)
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set();
      items.forEach((item) => {
        if (prev.has(item.id)) next.add(item.id);
      });
      return next;
    });
  }, [items]);

  useEffect(() => {
    const trimmedTerm = searchTerm.trim();
    const trimmedFilter = filter.search.trim();
    if (trimmedTerm === trimmedFilter) return;
    const timer = setTimeout(() => {
      setFilter({ search: searchTerm });
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm, filter.search, setFilter]);

  const categoriesById = useMemo(() => {
    const map = new Map();
    (categories || []).forEach((cat) => {
      if (!cat?.id) return;
      map.set(cat.id, cat);
      if (cat.name) {
        map.set(cat.name.toLowerCase(), cat);
      }
    });
    return map;
  }, [categories]);

  const visibleItems = useMemo(() => {
    if (!Array.isArray(items) || items.length === 0) return [];
    const start = Math.max(0, (page - 1) * pageSize);
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds],
  );

  const allSelected = visibleItems.length > 0 && visibleItems.every((item) => selectedIds.has(item.id));

  const activeChips = useMemo(() => {
    const chips = [];
    if (filter.period.preset === "month") {
      chips.push({ key: "period", label: PERIOD_LABELS.month });
    } else if (filter.period.preset === "week") {
      chips.push({ key: "period", label: PERIOD_LABELS.week });
    } else if (filter.period.preset === "custom") {
      const start = filter.period.start ? filter.period.start : "?";
      const end = filter.period.end ? filter.period.end : "?";
      chips.push({ key: "period", label: `Rentang: ${start} - ${end}` });
    }
    filter.categories.forEach((id) => {
      const cat = categoriesById.get(id) || categoriesById.get(id?.toLowerCase?.());
      chips.push({ key: `category:${id}`, label: cat?.name || "Kategori" });
    });
    if (filter.type !== "all") {
      chips.push({ key: "type", label: TYPE_LABELS[filter.type] || filter.type });
    }
    if (filter.sort !== "date-desc") {
      chips.push({ key: "sort", label: SORT_LABELS[filter.sort] || "Sort" });
    }
    if (filter.search.trim()) {
      chips.push({ key: "search", label: `Cari: ${filter.search}` });
    }
    return chips;
  }, [filter, categoriesById]);

  const toggleSelect = useCallback(
    (id, event) => {
      let desiredState = null;
      const isShiftKey = Boolean(event?.shiftKey ?? event?.nativeEvent?.shiftKey);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        const currentlySelected = next.has(id);
        desiredState = event?.target?.checked ?? !currentlySelected;
        if (!visibleItems.length) {
          if (desiredState) next.add(id);
          else next.delete(id);
          return next;
        }
        if (isShiftKey && lastSelectedIdRef.current) {
          const ids = visibleItems.map((item) => item.id);
          const currentIndex = ids.indexOf(id);
          const lastIndex = ids.indexOf(lastSelectedIdRef.current);
          if (currentIndex !== -1 && lastIndex !== -1) {
            const [startIndex, endIndex] =
              currentIndex < lastIndex ? [currentIndex, lastIndex] : [lastIndex, currentIndex];
            for (let index = startIndex; index <= endIndex; index += 1) {
              const targetId = ids[index];
              if (desiredState) next.add(targetId);
              else next.delete(targetId);
            }
            return next;
          }
        }
        if (desiredState) next.add(id);
        else next.delete(id);
        return next;
      });
      if (desiredState !== null) {
        lastSelectedIdRef.current = id;
      }
    },
    [visibleItems],
  );

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (!visibleItems.length) return next;
      const ids = visibleItems.map((item) => item.id);
      if (allSelected) {
        ids.forEach((itemId) => next.delete(itemId));
        lastSelectedIdRef.current = null;
        return next;
      }
      ids.forEach((itemId) => next.add(itemId));
      lastSelectedIdRef.current = ids[ids.length - 1] ?? null;
      return next;
    });
  }, [allSelected, visibleItems]);

  const handleRemoveChip = useCallback(
    (chip) => {
      if (chip.key === "type") {
        setFilter({ type: "all" });
        return;
      }
      if (chip.key === "sort") {
        setFilter({ sort: "date-desc" });
        return;
      }
      if (chip.key === "search") {
        setSearchTerm("");
        setFilter({ search: "" });
        return;
      }
      if (chip.key === "period") {
        setFilter({
          period: { preset: "all", month: "", start: "", end: "" },
        });
        return;
      }
      if (chip.key.startsWith("category:")) {
        const id = chip.key.split(":")[1];
        setFilter({ categories: filter.categories.filter((catId) => catId !== id) });
      }
    },
    [filter.categories, setFilter],
  );

  const handleResetFilters = useCallback(() => {
    setSearchTerm("");
    setFilter({
      period: { preset: "all", month: "", start: "", end: "" },
      categories: [],
      type: "all",
      sort: "date-desc",
      search: "",
    });
  }, [setFilter, setSearchTerm]);

  const showUndoSnackbar = useCallback((payload) => {
    if (!payload || !payload.ids?.length) return;
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    undoPayloadRef.current = payload;
    setUndoLoading(false);
    const count = payload.ids.length;
    const message = count === 1 ? 'Transaksi dihapus — Urungkan?' : `${count} transaksi dihapus — Urungkan?`;
    setSnackbar({ message, count });
    undoTimerRef.current = window.setTimeout(() => {
      undoPayloadRef.current = null;
      setSnackbar(null);
    }, 6000);
  }, []);

  const handleUndoClick = useCallback(async () => {
    const payload = undoPayloadRef.current;
    if (!payload || undoLoading) return;
    setUndoLoading(true);
    try {
      if (payload.ids.length === 1) {
        const success = await undoDeleteTransaction(payload.ids[0]);
        if (!success) {
          throw new Error('Gagal mengurungkan. Silakan refresh.');
        }
      } else {
        const restored = await undoDeleteTransactions(payload.ids);
        if (restored < payload.ids.length) {
          throw new Error('Gagal mengurungkan. Silakan refresh.');
        }
      }
      setItems((prev) => {
        const next = prev.slice();
        payload.records
          .slice()
          .sort((a, b) => a.index - b.index)
          .forEach(({ item, index }) => {
            const insertIndex = Math.min(index, next.length);
            next.splice(insertIndex, 0, item);
          });
        return next;
      });
      addToast(
        payload.ids.length === 1 ? 'Transaksi dipulihkan' : `${payload.ids.length} transaksi dipulihkan`,
        'success',
      );
      refresh({ keepPage: true });
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : 'Gagal mengurungkan. Silakan refresh.',
        'error',
      );
    } finally {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
        undoTimerRef.current = null;
      }
      undoPayloadRef.current = null;
      setSnackbar(null);
      setUndoLoading(false);
    }
  }, [addToast, refresh, undoLoading]);

  const handleRequestDelete = useCallback(
    (id) => {
      if (deleteInProgress) return;
      const target = items.find((item) => item.id === id);
      if (!target) return;
      setConfirmState({
        type: 'single',
        ids: [id],
      });
    },
    [deleteInProgress, items],
  );

  const handleRequestBulkDelete = useCallback(() => {
    if (deleteInProgress || !selectedItems.length) return;
    setConfirmState({
      type: 'bulk',
      ids: selectedItems.map((item) => item.id),
    });
  }, [deleteInProgress, selectedItems]);

  const handleCloseConfirm = useCallback(() => {
    if (deleteInProgress) return;
    setConfirmState(null);
  }, [deleteInProgress]);

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmState || deleteInProgress) return;
    const ids = confirmState.ids;
    const idSet = new Set(ids);
    const prevItems = items.slice();
    const prevSelected = new Set(selectedIds);
    const removalRecords = prevItems
      .map((item, index) => (idSet.has(item.id) ? { id: item.id, item, index } : null))
      .filter(Boolean);
    if (!removalRecords.length) {
      setConfirmState(null);
      return;
    }
    setDeleteInProgress(true);
    setItems(prevItems.filter((item) => !idSet.has(item.id)));
    const nextSelected = new Set(prevSelected);
    ids.forEach((id) => nextSelected.delete(id));
    setSelectedIds(nextSelected);

    try {
      if (ids.length === 1) {
        const success = await removeTransaction(ids[0]);
        if (!success) {
          throw new Error('Gagal menghapus. Cek koneksi lalu coba lagi.');
        }
      } else {
        const deletedCount = await removeTransactionsBulk(ids);
        if (deletedCount < ids.length) {
          throw new Error('Gagal menghapus. Cek koneksi lalu coba lagi.');
        }
      }
      lastSelectedIdRef.current = null;
      refresh({ keepPage: true });
      showUndoSnackbar({
        ids,
        records: removalRecords.map((record) => ({
          id: record.id,
          item: record.item,
          index: record.index,
        })),
      });
    } catch (error) {
      setItems(prevItems);
      setSelectedIds(prevSelected);
      addToast(
        error instanceof Error ? error.message : 'Gagal menghapus. Cek koneksi lalu coba lagi.',
        'error',
      );
    } finally {
      setConfirmState(null);
      setDeleteInProgress(false);
    }
  }, [
    confirmState,
    deleteInProgress,
    items,
    selectedIds,
    refresh,
    showUndoSnackbar,
    addToast,
  ]);

  const handleBulkUpdateField = useCallback(
    async (field, value) => {
      if (!selectedItems.length || value == null) return;
      setBulkUpdating(true);
      try {
        for (const item of selectedItems) {
          await updateTransaction(item.id, { [field]: value });
        }
        const label = field === "category_id" ? "Kategori" : "Akun";
        addToast(`${label} transaksi diperbarui`, "success");
        setSelectedIds(new Set());
        lastSelectedIdRef.current = null;
        refresh({ keepPage: true });
      } catch (err) {
        console.error(err);
        addToast(err?.message || "Gagal memperbarui transaksi terpilih", "error");
      } finally {
        setBulkUpdating(false);
        setBulkEditMode(null);
      }
    },
    [addToast, refresh, selectedItems],
  );

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const requestFilter = {
        period: filter.period,
        categories: filter.categories,
        type: filter.type,
        sort: filter.sort,
        search: filter.search,
      };
      const rows = [];
      let page = 1;
      while (true) {
        const { rows: chunkRows } = await listTransactions({
          ...requestFilter,
          page,
          pageSize,
        });
        rows.push(...chunkRows);
        if (!chunkRows || chunkRows.length < pageSize) break;
        page += 1;
      }
      const lines = ["date,type,category_name,amount,title,notes"];
      rows.forEach((item) => {
        const categoryName = item.category || categoriesById.get(item.category_id)?.name || "";
        const title = (item.title || "").replaceAll('"', '""');
        const notes = (item.notes ?? item.note ?? "").replaceAll('"', '""');
        lines.push(
          `${toDateInput(item.date)},${item.type},"${categoryName}",${Number(item.amount ?? 0)},"${title}","${notes}"`,
        );
      });
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transactions-${Date.now()}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      addToast("Export CSV berhasil", "success");
    } catch (err) {
      console.error(err);
      addToast(err?.message || "Gagal export CSV", "error");
    } finally {
      setExporting(false);
    }
  }, [addToast, categoriesById, exporting, filter.categories, filter.period, filter.search, filter.sort, filter.type, pageSize]);

  const handleFlushQueue = useCallback(async () => {
    try {
      await flushQueue();
      const count = await pending();
      setQueueCount(count);
      addToast("Sinkronisasi dijalankan", "success");
    } catch (err) {
      console.error(err);
      addToast(err?.message || "Gagal menjalankan sinkronisasi", "error");
    }
  }, [addToast]);

  const offlineMode = !online;
  const showSyncBadge = offlineMode || queueCount > 0;

  const handleNavigateToAdd = useCallback(() => {
    navigate("/transaction/add");
  }, [navigate]);

  const tableStickyTop = `calc(var(--app-header-height, var(--app-topbar-h, 64px)) + ${filterBarHeight}px + 16px)`;
  const isFilterPanelVisible = isDesktopFilterView || filterPanelOpen;
  const activeFilterCount = activeChips.length;

  const toggleFilterPanel = () => {
    if (isDesktopFilterView) return;
    setFilterPanelOpen((prev) => !prev);
  };

  const handleEditTransaction = useCallback((item) => {
    setEditTarget(item);
  }, []);

  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 pb-10 sm:px-6 lg:px-8">
      <PageHeader title="Transaksi" description={PAGE_DESCRIPTION}>
        <button
          type="button"
          onClick={handleNavigateToAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
          aria-label="Tambah transaksi (Ctrl+T)"
        >
          <Plus className="h-4 w-4" /> Tambah Transaksi
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Export CSV (Ctrl+E)"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export CSV
        </button>
      </PageHeader>

      <div className="space-y-6 sm:space-y-7 lg:space-y-8">
        <div
          ref={filterBarRef}
          className="sticky z-20"
          style={{
            top: "var(--app-header-height, var(--app-topbar-h, 64px))",
          }}
        >
          <button
            type="button"
            onClick={toggleFilterPanel}
            className={clsx(
              "md:hidden flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm font-semibold text-white shadow transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
              filterBarStuck && !isFilterPanelVisible && "border-white/15 shadow-[0_12px_30px_-16px_rgba(15,23,42,0.85)]",
            )}
            aria-controls={filterPanelId}
            aria-expanded={isDesktopFilterView ? true : filterPanelOpen}
          >
            <span className="flex items-center gap-2">
              Filter
              {activeFilterCount > 0 && (
                <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white">
                  {activeFilterCount}
                </span>
              )}
            </span>
            <ChevronDown
              className={clsx(
                "h-4 w-4 transition-transform duration-200",
                isFilterPanelVisible ? "rotate-180" : "rotate-0",
              )}
              aria-hidden="true"
            />
          </button>
          <div
            id={filterPanelId}
            aria-hidden={!isDesktopFilterView && !isFilterPanelVisible}
            inert={!isDesktopFilterView && !isFilterPanelVisible ? "" : undefined}
            className={clsx(
              "transition-[max-height,opacity] duration-200 ease-in-out",
              "md:max-h-none md:opacity-100 md:transition-none md:overflow-visible md:pointer-events-auto",
              !isDesktopFilterView && "overflow-hidden",
              !isDesktopFilterView && isFilterPanelVisible && "mt-3",
              !isDesktopFilterView && !isFilterPanelVisible && "pointer-events-none",
              isFilterPanelVisible ? "max-h-[1200px] opacity-100" : "max-h-0 opacity-0",
            )}
          >
            <TransactionsFilters
              filter={filter}
              categories={categories}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onFilterChange={setFilter}
              searchInputRef={searchInputRef}
              onClear={handleResetFilters}
              sort={filter.sort}
              onSortChange={(value) => setFilter({ sort: value })}
            />
          </div>
        </div>

        {showSyncBadge && (
          <div className="flex items-center justify-between rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>
                {offlineMode
                  ? "Offline mode (queued)"
                  : `Sinkronisasi tertunda (${queueCount})`}
              </span>
            </div>
            {queueCount > 0 && !offlineMode && (
              <button
                type="button"
                onClick={handleFlushQueue}
                className="rounded-full border border-amber-400/50 px-3 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-400/10 focus-visible:outline-none focus-visible:ring focus-visible:ring-amber-400/60"
              >
                Flush Sekarang
              </button>
            )}
          </div>
        )}

        <SummaryCards summary={summary} loading={loading && items.length === 0} />

        {activeChips.length > 0 && (
          <ActiveFilterChips chips={activeChips} onRemove={handleRemoveChip} />
        )}

        {selectedIds.size > 0 && (
          <BatchToolbar
            count={selectedIds.size}
            onClear={() => {
              setSelectedIds(new Set());
              lastSelectedIdRef.current = null;
            }}
            onDelete={handleRequestBulkDelete}
            onChangeCategory={() => setBulkEditMode("category")}
            deleting={deleteInProgress}
            updating={bulkUpdating}
            secondaryAction={
              <button
                type="button"
                onClick={() => setBulkEditMode("account")}
                disabled={bulkUpdating}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-900/70 px-4 text-sm font-semibold text-slate-200 ring-1 ring-slate-800 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-initial"
              >
                {bulkUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
                )}
                Ubah Akun
              </button>
            }
          />
        )}

        <TransactionsTable
          items={visibleItems}
          loading={loading}
          error={error}
          onRetry={() => refresh({ keepPage: true })}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          allSelected={allSelected}
          onDelete={handleRequestDelete}
          onEdit={handleEditTransaction}
          formatAmount={formatIDR}
          formatDate={formatTransactionDate}
          toDateValue={toDateInput}
          parseTags={parseTags}
          typeLabels={TYPE_LABELS}
          sort={filter.sort}
          onSortChange={(value) => setFilter({ sort: value })}
          tableStickyTop={tableStickyTop}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={goToPage}
          deleteDisabled={deleteInProgress}
          emptyState={
            <EmptyTransactionsState
              onResetFilters={handleResetFilters}
              onOpenAdd={handleNavigateToAdd}
            />
          }
        />
        <TransactionsCardList
          items={visibleItems}
          loading={loading}
          error={error}
          onRetry={() => refresh({ keepPage: true })}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onDelete={handleRequestDelete}
          onEdit={handleEditTransaction}
          formatAmount={formatIDR}
          formatDate={formatTransactionDate}
          toDateValue={toDateInput}
          parseTags={parseTags}
          typeLabels={TYPE_LABELS}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={goToPage}
          deleteDisabled={deleteInProgress}
          emptyState={
            <EmptyTransactionsState
              onResetFilters={handleResetFilters}
              onOpenAdd={handleNavigateToAdd}
            />
          }
        />

        {confirmState && (
          <Modal open={Boolean(confirmState)} onClose={handleCloseConfirm} title="Konfirmasi Hapus">
            <div className="space-y-4 text-white">
              <p className="text-sm text-white/80">
                {confirmState.ids.length === 1
                  ? 'Hapus transaksi ini? Tindakan dapat diurungkan selama 6 detik.'
                  : `Hapus ${confirmState.ids.length} transaksi? Tindakan dapat diurungkan selama 6 detik.`}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseConfirm}
                  disabled={deleteInProgress}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-border px-4 text-sm font-medium text-text transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleteInProgress}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-danger px-4 text-sm font-semibold text-white shadow transition hover:bg-[color:var(--color-danger-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring-danger)] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {deleteInProgress ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Hapus'}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {snackbar && (
          <UndoSnackbar
            open
            message={snackbar.message}
            onUndo={handleUndoClick}
            loading={undoLoading}
          />
        )}

        {bulkEditMode && (
          <BulkEditDialog
            open={Boolean(bulkEditMode)}
            mode={bulkEditMode}
            onClose={() => {
              if (!bulkUpdating) setBulkEditMode(null);
            }}
            onSubmit={(selectedValue) => {
              const field = bulkEditMode === "category" ? "category_id" : "account_id";
              handleBulkUpdateField(field, selectedValue);
            }}
            categories={categories}
            submitting={bulkUpdating}
            addToast={addToast}
          />
        )}

        {editTarget && (
          <TransactionFormDialog
            open={Boolean(editTarget)}
            onClose={() => setEditTarget(null)}
            initialData={editTarget}
            categories={categories}
            onSuccess={() => {
              refresh({ keepPage: true });
              setSelectedIds(new Set());
              lastSelectedIdRef.current = null;
              setEditTarget(null);
            }}
            addToast={addToast}
          />
        )}

        {importOpen && (
          <ImportCSVDialog
            open={importOpen}
            onClose={() => setImportOpen(false)}
            categories={categories}
            onImported={() => {
              refresh();
              setImportOpen(false);
            }}
            addToast={addToast}
          />
        )}
      </div>
    </main>
  );
}

function ActiveFilterChips({ chips, onRemove }) {
  if (!chips?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onRemove(chip)}
          className="group inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition hover:border-brand/40 hover:bg-brand/5 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          aria-label={`Hapus filter ${chip.label}`}
        >
          <span className="truncate">{chip.label}</span>
          <X className="h-3.5 w-3.5 transition group-hover:text-brand" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

function SummaryCards({ summary, loading }) {
  const cards = [
    {
      key: "income",
      title: "Pemasukan",
      value: summary?.income ?? 0,
      accent: "text-success",
    },
    {
      key: "expense",
      title: "Pengeluaran",
      value: summary?.expense ?? 0,
      accent: "text-danger",
    },
    {
      key: "net",
      title: "Net",
      value: summary?.net ?? 0,
      accent: "text-info",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.key}
          className="rounded-2xl border border-border bg-surface-1/90 p-5 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{card.title}</p>
          {loading ? (
            <div className="mt-3 h-6 w-32 animate-pulse rounded-full bg-border/60" />
          ) : (
            <p className={clsx("mt-2 text-2xl font-semibold", card.accent)}>{formatIDR(card.value)}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function EmptyTransactionsState({ onResetFilters, onOpenAdd }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 rounded-3xl bg-slate-950/70 px-8 py-16 text-center text-slate-200 ring-1 ring-slate-800">
      <span className="rounded-full bg-[var(--accent)]/10 p-3 text-[var(--accent)]">
        <Inbox className="h-7 w-7" aria-hidden="true" />
      </span>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Belum ada transaksi</h2>
        <p className="text-sm text-slate-400">Coba bersihkan filter atau mulai catat transaksi pertama Anda.</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onResetFilters}
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-slate-200 ring-1 ring-slate-800 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Bersihkan Filter
        </button>
        <button
          type="button"
          onClick={onOpenAdd}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[var(--accent)] px-4 text-sm font-semibold text-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Tambah Transaksi
        </button>
      </div>
    </div>
  );
}

function parseTags(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((tag) => String(tag).trim())
      .filter(Boolean);
  }
  return String(value)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function BulkEditDialog({
  open,
  mode,
  onClose,
  onSubmit,
  categories,
  submitting = false,
  addToast = () => {},
}) {
  const [value, setValue] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setValue("");
      setOptions([]);
      setLoading(false);
      return;
    }
    if (mode === "category") {
      setOptions((categories || []).map((cat) => ({ id: cat.id, name: cat.name || "(Tanpa kategori)" })));
      setLoading(false);
    } else if (mode === "account") {
      setLoading(true);
      listAccounts()
        .then((rows) => {
          setOptions((rows || []).map((account) => ({ id: account.id, name: account.name || "(Tanpa nama)" })));
        })
        .catch((err) => {
          console.error(err);
          addToast(err?.message || "Gagal memuat akun", "error");
        })
        .finally(() => setLoading(false));
    }
  }, [open, mode, categories, addToast]);

  useEffect(() => {
    if (!open || !options.length) return;
    if (!options.some((option) => option.id === value)) {
      setValue(options[0]?.id || "");
    }
  }, [open, options, value]);

  if (!open) return null;

  const title = mode === "category" ? "Ubah kategori transaksi" : "Ubah akun transaksi";

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!value) {
      addToast("Silakan pilih opsi", "warning");
      return;
    }
    onSubmit(value);
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-white" aria-hidden="true" />
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2 text-sm text-white/80">
            <span>{mode === "category" ? "Pilih kategori" : "Pilih akun"}</span>
            <select
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
            >
              <option value="">{mode === "category" ? "Pilih kategori" : "Pilih akun"}</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || !value}
              className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Terapkan"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}



function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const handler = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 shadow-xl backdrop-blur">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/10 p-2 text-white/70 hover:bg-white/20 focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
            aria-label="Tutup dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 text-sm text-white/80">{children}</div>
      </div>
    </div>
  );
}

function TransactionFormDialog({ open, onClose, initialData, categories, onSuccess, addToast }) {
  const isEdit = Boolean(initialData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [type, setType] = useState(initialData?.type || "expense");
  const [amount, setAmount] = useState(() => String(initialData?.amount ?? 0));
  const [date, setDate] = useState(() => toDateInput(initialData?.date) || new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState(initialData?.category_id || "");
  const [title, setTitle] = useState(initialData?.title || "");
  const [notes, setNotes] = useState(initialData?.notes ?? initialData?.note ?? "");
  const [accountId, setAccountId] = useState(initialData?.account_id || "");
  const [toAccountId, setToAccountId] = useState(initialData?.to_account_id || "");
  const [receiptUrl, setReceiptUrl] = useState(initialData?.receipt_url || "");
  const initialMerchantId = initialData?.merchant_id ?? null;

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listAccounts()
      .then((accountRows) => {
        setAccounts(accountRows || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        addToast(err?.message || "Gagal memuat master data", "error");
        setLoading(false);
      });
  }, [open, addToast]);

  useEffect(() => {
    if (!open || !initialData) return;
    setType(initialData.type || "expense");
    setAmount(String(initialData.amount ?? 0));
    setDate(toDateInput(initialData.date) || new Date().toISOString().slice(0, 10));
    setCategoryId(initialData.category_id || "");
    setTitle(initialData.title || "");
    setNotes(initialData.notes ?? initialData.note ?? "");
    setAccountId(initialData.account_id || "");
    setToAccountId(initialData.to_account_id || "");
    setReceiptUrl(initialData.receipt_url || "");
  }, [open, initialData]);

  const categoryOptions = useMemo(() => {
    return (categories || []).filter((cat) => cat.type === type);
  }, [categories, type]);
  const isTransfer = type === "transfer";

  const handleSubmit = async (event) => {
    event.preventDefault();
    const amountNumber = Number(amount.toString().replace(/[^0-9.,-]/g, "").replace(/,/g, "."));
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      addToast("Nominal harus lebih besar dari 0", "error");
      return;
    }
    if (!accountId) {
      addToast("Pilih akun sumber transaksi", "error");
      return;
    }
    if (isTransfer) {
      if (!toAccountId) {
        addToast("Pilih akun tujuan untuk transfer", "error");
        return;
      }
      if (toAccountId === accountId) {
        addToast("Akun tujuan tidak boleh sama dengan sumber", "error");
        return;
      }
    } else if (!categoryId) {
      addToast("Kategori wajib dipilih", "error");
      return;
    }
    if (!isEdit) {
      addToast("Data transaksi tidak ditemukan", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        type,
        amount: amountNumber,
        date,
        category_id: isTransfer ? null : categoryId,
        title,
        notes,
        account_id: accountId || null,
        to_account_id: isTransfer ? toAccountId || null : null,
        merchant_id: initialMerchantId,
        receipt_url: receiptUrl || null,
      };
      await updateTransaction(initialData.id, payload);
      addToast("Transaksi diperbarui", "success");
      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error(err);
      addToast(err?.message || "Gagal menyimpan transaksi", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Transaksi" : "Transaksi"}>
      {loading ? (
        <div className="flex items-center justify-center py-12 text-white/70">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/60">Jenis</span>
              <select
                value={type}
                onChange={(event) => {
                  const nextType = event.target.value;
                  setType(nextType);
                  if (nextType === "transfer") {
                    setCategoryId("");
                  } else {
                    const nextOptions = (categories || []).filter((cat) => cat.type === nextType);
                    if (!nextOptions.some((cat) => cat.id === categoryId)) {
                      setCategoryId(nextOptions[0]?.id || "");
                    }
                  }
                  if (nextType !== "transfer") {
                    setToAccountId("");
                  }
                }}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
              >
                <option value="expense">Pengeluaran</option>
                <option value="income">Pemasukan</option>
                <option value="transfer">Transfer</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/60">Tanggal</span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/60">Nominal</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
              />
            </label>
            {!isTransfer ? (
              <label className="flex flex-col gap-2 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-white/60">Kategori</span>
                <select
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
                >
                  <option value="">Pilih kategori</option>
                  {categoryOptions.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/60">{isTransfer ? "Dari" : "Akun"}</span>
              <select
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
              >
                <option value="">{isTransfer ? "Pilih akun sumber" : "Pilih akun"}</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name || "(Tanpa nama)"}
                  </option>
                ))}
              </select>
            </label>
            {isTransfer ? (
              <label className="flex flex-col gap-2 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-white/60">Tujuan</span>
                <select
                  value={toAccountId}
                  onChange={(event) => setToAccountId(event.target.value)}
                  className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
                >
                  <option value="">Pilih akun tujuan</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name || "(Tanpa nama)"}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-white/60">Judul</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-white/60">Catatan</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-white/60">URL Struk</span>
            <input
              type="url"
              value={receiptUrl}
              onChange={(event) => setReceiptUrl(event.target.value)}
              placeholder="https://..."
              className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
            />
          </label>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? "Simpan Perubahan" : "Simpan"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ImportCSVDialog({ open, onClose, categories, onImported, addToast }) {
  const [fileName, setFileName] = useState("");
  const [previewRows, setPreviewRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [validRows, setValidRows] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const categoriesByName = useMemo(() => {
    const map = new Map();
    (categories || []).forEach((cat) => {
      if (!cat?.name) return;
      map.set(cat.name.trim().toLowerCase(), cat.id);
    });
    return map;
  }, [categories]);


  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      const { rows } = parseCSV(text);
      const issues = [];
      const valid = [];
      const preview = [];
      rows.forEach((row, index) => {
        const line = index + 2;
        const rawType = (row.type || row.Type || "").toLowerCase();
        const type = rawType === "income" || rawType === "pemasukan" ? "income" : rawType === "expense" || rawType === "pengeluaran" ? "expense" : null;
        if (!type) {
          issues.push(`Baris ${line}: tipe tidak valid`);
          return;
        }
        const rawDate = row.date || row.tanggal || row.Date;
        const date = rawDate ? new Date(rawDate).toISOString().slice(0, 10) : null;
        if (!date || Number.isNaN(Date.parse(date))) {
          issues.push(`Baris ${line}: tanggal tidak valid`);
          return;
        }
        const amountValue = row.amount || row.nominal || row.Amount;
        const amount = Number(amountValue);
        if (!Number.isFinite(amount) || amount <= 0) {
          issues.push(`Baris ${line}: nominal harus > 0`);
          return;
        }
        const rawCategory = (row.category_name || row.category || row.kategori || "").trim().toLowerCase();
        const categoryId = categoriesByName.get(rawCategory);
        if (!categoryId) {
          issues.push(`Baris ${line}: kategori '${row.category || row.category_name}' tidak ditemukan`);
          return;
        }
        const title = row.title || row.judul || "";
        const notes = row.notes || row.note || "";
        valid.push({
          type,
          date,
          amount,
          category_id: categoryId,
          title,
          notes,
        });
        if (preview.length < 10) {
          preview.push({ type, date, amount, category: row.category || row.category_name, title, notes });
        }
      });
      setPreviewRows(preview);
      setErrors(issues);
      setValidRows(valid);
    } catch (err) {
      console.error(err);
      addToast("Gagal membaca berkas CSV", "error");
    }
  };

  const handleImport = async () => {
    if (!validRows.length) {
      addToast("Tidak ada baris valid untuk diimport", "error");
      return;
    }
    setProcessing(true);
    setProgress(0);
    try {
      const batches = chunk(validRows, 200);
      for (const batch of batches) {
        await Promise.all(batch.map((row) => addTransaction(row)));
        setProgress((prev) => prev + batch.length);
      }
      addToast(`Berhasil mengimport ${validRows.length} transaksi`, "success");
      onImported();
    } catch (err) {
      console.error(err);
      addToast(err?.message || "Gagal mengimport beberapa baris", "error");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Import CSV">
      <div className="space-y-4">
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/60">Pilih berkas CSV</span>
          <input
            type="file"
            accept=".csv"
            onChange={handleFile}
            className="rounded-xl border border-dashed border-white/20 bg-white/5 px-3 py-3 text-sm text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
          />
          {fileName && <span className="text-xs text-white/50">Dipilih: {fileName}</span>}
        </label>
        {previewRows.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/60">Pratinjau (10 baris pertama)</p>
            <div className="max-h-48 overflow-y-auto">
              <table className="min-w-full text-xs text-white/70">
                <thead className="sticky top-0 bg-white/10 text-left text-[11px] uppercase text-white/50">
                  <tr>
                    <th className="px-2 py-2">Tanggal</th>
                    <th className="px-2 py-2">Tipe</th>
                    <th className="px-2 py-2">Kategori</th>
                    <th className="px-2 py-2">Nominal</th>
                    <th className="px-2 py-2">Judul</th>
                    <th className="px-2 py-2">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, index) => (
                    <tr key={index} className="border-b border-white/10">
                      <td className="px-2 py-1">{row.date}</td>
                      <td className="px-2 py-1">{TYPE_LABELS[row.type]}</td>
                      <td className="px-2 py-1">{row.category}</td>
                      <td className="px-2 py-1">{formatIDR(row.amount)}</td>
                      <td className="px-2 py-1">{row.title}</td>
                      <td className="px-2 py-1">{row.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {errors.length > 0 && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-200">
            <p className="mb-2 font-semibold">Beberapa baris dilewati:</p>
            <ul className="space-y-1 text-amber-100/80">
              {errors.slice(0, 10).map((err, index) => (
                <li key={index}>{err}</li>
              ))}
              {errors.length > 10 && <li>dan {errors.length - 10} lainnya...</li>}
            </ul>
          </div>
        )}
        <div className="flex items-center justify-between text-sm text-white/60">
          <span>{validRows.length} baris siap diimport</span>
          {processing && <span>{progress} / {validRows.length}</span>}
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={processing || validRows.length === 0}
            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Import"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
