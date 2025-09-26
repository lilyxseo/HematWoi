import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import {
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  ChevronDown,
  Check,
  Download,
  Inbox,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import useTransactionsQuery from "../hooks/useTransactionsQuery";
import useNetworkStatus from "../hooks/useNetworkStatus";
import { useToast } from "../context/ToastContext";
import PageHeader from "../layout/PageHeader";
import { addTransaction, listAccounts, listMerchants, updateTransaction } from "../lib/api";
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
const MOBILE_BREAKPOINT = 992;

function detectTableVariant() {
  if (typeof window === "undefined") return "table";
  return window.innerWidth < MOBILE_BREAKPOINT ? "card" : "table";
}

function toDateInput(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function currentMonthValue() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
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
    hasMore,
    loading,
    error,
    filter,
    setFilter,
    loadMore,
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
  const [tableVariant, setTableVariant] = useState(() => detectTableVariant());
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
    const handleResize = () => {
      setTableVariant(detectTableVariant());
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds],
  );

  const allSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id));

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
        if (!items.length) {
          if (desiredState) next.add(id);
          else next.delete(id);
          return next;
        }
        if (isShiftKey && lastSelectedIdRef.current) {
          const ids = items.map((item) => item.id);
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
    [items],
  );

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(() => {
      if (allSelected) {
        lastSelectedIdRef.current = null;
        return new Set();
      }
      const ids = items.map((item) => item.id);
      lastSelectedIdRef.current = ids[ids.length - 1] ?? null;
      return new Set(ids);
    });
  }, [allSelected, items]);

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
  const selectionToolbarOffset = tableStickyTop ? `calc(${tableStickyTop} + 12px)` : "16px";
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
          onClick={() => setImportOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
          aria-label="Import CSV (Ctrl+I)"
        >
          <Upload className="h-4 w-4" /> Import CSV
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
              "rounded-2xl border border-white/10 bg-slate-900/60 transition-[max-height,opacity] duration-200 ease-in-out",
              "md:max-h-none md:opacity-100 md:transition-none md:overflow-visible md:pointer-events-auto",
              !isDesktopFilterView && "overflow-hidden",
              !isDesktopFilterView && isFilterPanelVisible && "mt-3",
              !isDesktopFilterView && !isFilterPanelVisible && "pointer-events-none",
              isFilterPanelVisible ? "max-h-[1200px] opacity-100" : "max-h-0 opacity-0",
              filterBarStuck && isFilterPanelVisible && "border-white/15 shadow-[0_12px_30px_-16px_rgba(15,23,42,0.85)]",
            )}
            style={{
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
            }}
          >
            <TransactionsFilterBar
              filter={filter}
              categories={categories}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onFilterChange={setFilter}
              searchInputRef={searchInputRef}
              onOpenAdd={handleNavigateToAdd}
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
          <SelectionToolbar
            count={selectedIds.size}
            onClear={() => {
              setSelectedIds(new Set());
              lastSelectedIdRef.current = null;
            }}
            onDelete={handleRequestBulkDelete}
            onEditCategory={() => setBulkEditMode("category")}
            onEditAccount={() => setBulkEditMode("account")}
            deleting={deleteInProgress}
            updating={bulkUpdating}
            topOffset={selectionToolbarOffset}
          />
        )}

        <TransactionsTable
          items={items}
          loading={loading}
          error={error}
          onRetry={() => refresh({ keepPage: true })}
          onLoadMore={loadMore}
          hasMore={hasMore}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          allSelected={allSelected}
          selectedIds={selectedIds}
          onDelete={handleRequestDelete}
          onEdit={handleEditTransaction}
          tableStickyTop={tableStickyTop}
          variant={tableVariant}
          onResetFilters={handleResetFilters}
          total={total}
          onOpenAdd={handleNavigateToAdd}
          deleteDisabled={deleteInProgress}
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

function TransactionsFilterBar({
  filter,
  categories,
  searchTerm,
  onSearchChange,
  onFilterChange,
  searchInputRef,
  onOpenAdd = () => {},
}) {
  const currentMonth = currentMonthValue();
  const customButtonRef = useRef(null);
  const actualSearchInputRef = useRef(null);
  const [customOpen, setCustomOpen] = useState(false);
  const typeSelectId = useId();
  const sortSelectId = useId();
  const searchInputId = useId();

  useEffect(() => {
    if (!searchInputRef) return;
    searchInputRef.current = {
      focus: () => {
        actualSearchInputRef.current?.focus();
        actualSearchInputRef.current?.select();
      },
    };
  }, [searchInputRef]);

  useEffect(() => {
    if (filter.period.preset !== "custom") {
      setCustomOpen(false);
    }
  }, [filter.period.preset]);

  const handlePresetChange = (preset) => {
    if (preset === "custom" && filter.period.preset === "custom") {
      setCustomOpen((prev) => !prev);
      return;
    }
    if (preset === "all") {
      onFilterChange({ period: { preset: "all", month: "", start: "", end: "" } });
      setCustomOpen(false);
      return;
    }
    if (preset === "month") {
      onFilterChange({ period: { preset: "month", month: filter.period.month || currentMonth, start: "", end: "" } });
      setCustomOpen(false);
      return;
    }
    if (preset === "week") {
      onFilterChange({ period: { preset: "week", month: "", start: "", end: "" } });
      setCustomOpen(false);
      return;
    }
    if (preset === "custom") {
      const today = new Date().toISOString().slice(0, 10);
      onFilterChange({ period: { preset: "custom", month: "", start: filter.period.start || today, end: filter.period.end || today } });
      setCustomOpen(true);
    }
  };

  const handleCategoryChange = (selected) => {
    onFilterChange({ categories: selected });
  };

  const handleReset = () => {
    onFilterChange({
      period: { preset: "all", month: "", start: "", end: "" },
      categories: [],
      type: "all",
      sort: "date-desc",
      search: "",
    });
    onSearchChange("");
  };

  const handleSearchChange = (value) => {
    onSearchChange(value);
  };

  const handleTypeChange = (value) => {
    onFilterChange({ type: value });
  };

  const handleSortChange = (value) => {
    onFilterChange({ sort: value });
  };

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-white shadow">
      <div
        role="toolbar"
        aria-label="Filter transaksi"
        className="grid grid-cols-2 items-center gap-3 md:grid-cols-6"
      >
        <div className="col-span-2 min-w-0 md:col-span-2">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/60">
            Rentang Waktu
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-4">
            {Object.entries(PERIOD_LABELS).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => handlePresetChange(value)}
                ref={value === "custom" ? customButtonRef : undefined}
                className={clsx(
                  "inline-flex h-[40px] items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
                  filter.period.preset === value
                    ? "bg-brand text-white shadow"
                    : "text-white/70 hover:bg-white/10",
                )}
                aria-pressed={filter.period.preset === value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="col-span-2 min-w-0 md:col-span-1">
          <CategoryMultiSelect
            categories={categories}
            selected={filter.categories}
            onChange={handleCategoryChange}
            ariaLabel="Filter kategori transaksi"
          />
        </div>
        <div className="col-span-2 min-w-0 md:col-span-1">
          <label htmlFor={typeSelectId} className="sr-only">
            Filter jenis transaksi
          </label>
          <select
            id={typeSelectId}
            value={filter.type}
            onChange={(event) => handleTypeChange(event.target.value)}
            aria-label="Filter jenis transaksi"
            className="h-[40px] w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            <option value="all">Semua</option>
            <option value="expense">Pengeluaran</option>
            <option value="income">Pemasukan</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>
        <div className="col-span-2 min-w-0 md:col-span-1">
          <label htmlFor={sortSelectId} className="sr-only">
            Urutkan transaksi
          </label>
          <select
            id={sortSelectId}
            value={filter.sort}
            onChange={(event) => handleSortChange(event.target.value)}
            aria-label="Urutkan transaksi"
            className="h-[40px] w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            <option value="date-desc">Terbaru</option>
            <option value="date-asc">Terlama</option>
            <option value="amount-desc">Terbesar</option>
            <option value="amount-asc">Terkecil</option>
          </select>
        </div>
        <div className="col-span-2 min-w-0 md:col-span-1">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" aria-hidden="true" />
            <input
              id={searchInputId}
              ref={actualSearchInputRef}
              type="search"
              value={searchTerm}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Cari judul/catatan…"
              aria-label="Cari transaksi"
              className="h-[40px] w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-white placeholder:text-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            />
          </div>
        </div>
        <div className="col-span-2 flex min-w-0 flex-wrap items-center justify-end gap-2 md:col-span-6 md:flex-nowrap md:gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex h-[40px] items-center rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-medium text-white/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            aria-label="Reset semua filter"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onOpenAdd}
            className="inline-flex h-[40px] items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            aria-label="Tambah transaksi"
          >
            <Plus className="h-4 w-4" /> Tambah Transaksi
          </button>
        </div>
      </div>
      {customOpen && filter.period.preset === "custom" && (
        <CustomRangePopover
          anchorRef={customButtonRef}
          period={filter.period}
          onChange={(next) => onFilterChange({ period: next })}
          onClose={() => setCustomOpen(false)}
        />
      )}
    </div>
  );
}


function CategoryMultiSelect({ categories = [], selected = [], onChange, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const anchor = triggerRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const preferredWidth = Math.min(320, Math.max(260, rect.width || 260));
      const left = Math.min(
        Math.max(16, rect.left),
        window.innerWidth - preferredWidth - 16,
      );
      setPosition({
        top: rect.bottom + 8,
        left,
        width: preferredWidth,
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event) => {
      if (triggerRef.current?.contains(event.target)) return;
      if (panelRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const handleKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
    }
  }, [open]);

  const toggle = (id) => {
    const set = new Set(selected);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange(Array.from(set));
  };

  const clearAll = () => {
    onChange([]);
  };

  const filteredCategories = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return categories;
    return categories.filter((cat) => {
      return (
        cat.name?.toLowerCase().includes(term) ||
        (TYPE_LABELS[cat.type] || "").toLowerCase().includes(term)
      );
    });
  }, [categories, query]);

  const summaryLabel = useMemo(() => {
    if (!selected.length) return "Semua kategori";
    if (selected.length === 1) {
      const match = categories.find((cat) => cat.id === selected[0]);
      return match?.name || "1 dipilih";
    }
    return `${selected.length} dipilih`;
  }, [categories, selected]);

  const label = ariaLabel || "Pilih kategori transaksi";

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-[40px] w-full min-w-0 flex-shrink-0 items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
      >
        <span className="truncate">{summaryLabel}</span>
        <ChevronDown className="h-4 w-4 text-white/60" aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-40" role="presentation">
            <div
              ref={panelRef}
              role="listbox"
              aria-multiselectable="true"
              className="absolute max-h-[320px] w-[min(320px,calc(100%-32px))] overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur"
              style={{ top: position.top, left: position.left, width: position.width || undefined }}
              data-role="category-panel"
            >
              <div className="flex items-center justify-between px-3 pt-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-white/60">Kategori</span>
                <button
                  type="button"
                  onClick={clearAll}
                  className="rounded-full px-2 py-1 text-xs text-white/60 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                >
                  Reset
                </button>
              </div>
              <div className="px-3 pb-2">
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3">
                  <Search className="h-4 w-4 text-white/40" aria-hidden="true" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Cari kategori"
                    className="h-9 w-full bg-transparent text-sm text-white placeholder:text-white/40 focus-visible:outline-none"
                    aria-label="Cari kategori"
                  />
                </div>
              </div>
              <div className="max-h-[220px] overflow-y-auto px-1 pb-3">
                {filteredCategories.length ? (
                  filteredCategories.map((cat) => {
                    const checked = selected.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggle(cat.id)}
                        className={clsx(
                          "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
                          checked ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/5",
                        )}
                        role="option"
                        aria-selected={checked}
                      >
                      <div className="flex flex-col text-left">
                        <span className="font-medium text-white">{cat.name}</span>
                      </div>
                        {checked ? (
                          <Check className="h-4 w-4 text-brand" aria-hidden="true" />
                        ) : (
                          <span className="h-4 w-4 rounded-full border border-white/30" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })
                ) : (
                  <p className="px-3 py-6 text-center text-sm text-white/50">Tidak ada kategori ditemukan.</p>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function CustomRangePopover({ anchorRef, period, onChange, onClose }) {
  const popoverRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    const anchor = anchorRef?.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(360, Math.max(280, rect.width + 120));
    const left = Math.min(
      Math.max(16, rect.left - (width - rect.width) / 2),
      window.innerWidth - width - 16,
    );
    setPosition({
      top: rect.bottom + 8,
      left,
      width,
    });
  }, [anchorRef]);

  useEffect(() => {
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [updatePosition]);

  useEffect(() => {
    const handleClick = (event) => {
      if (anchorRef?.current?.contains(event.target)) return;
      if (popoverRef.current?.contains(event.target)) return;
      onClose();
    };
    const handleKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [anchorRef, onClose]);

  const content = (
    <div className="fixed inset-0 z-40" role="presentation">
      <div
        ref={popoverRef}
        className="absolute w-[min(360px,calc(100%-32px))] rounded-2xl border border-white/10 bg-slate-900/95 p-4 shadow-2xl backdrop-blur"
        style={{ top: position.top, left: position.left, width: position.width || undefined }}
        data-role="custom-range"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Rentang custom</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-xs text-white/60">
            <span className="font-medium text-white/70">Mulai</span>
            <input
              type="date"
              value={period.start || ""}
              onChange={(event) => onChange({ ...period, start: event.target.value })}
              className="h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs text-white/60">
            <span className="font-medium text-white/70">Selesai</span>
            <input
              type="date"
              value={period.end || ""}
              min={period.start || undefined}
              onChange={(event) => onChange({ ...period, end: event.target.value })}
              className="h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            />
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-white/50">
          <span>Pilih rentang tanggal sesuai kebutuhan.</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
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

function SelectionToolbar({
  count,
  onClear,
  onDelete,
  onEditCategory,
  onEditAccount,
  deleting,
  updating,
  topOffset,
}) {
  return (
    <div
      className="pointer-events-none sticky bottom-4 z-30 md:bottom-auto md:top-0 md:sticky"
      style={topOffset ? { top: topOffset } : undefined}
      aria-live="polite"
    >
      <div className="pointer-events-auto mx-auto flex w-full max-w-[720px] flex-col gap-3 rounded-2xl border border-border bg-surface/95 p-4 shadow-lg shadow-black/5 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-sm font-semibold text-brand">
            {count} dipilih
          </span>
          <button
            type="button"
            onClick={onClear}
            className="text-sm font-medium text-muted transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            Batal
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onEditCategory}
            disabled={updating}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border px-4 text-sm font-medium text-text transition hover:border-brand/40 hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {updating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Pencil className="h-4 w-4" aria-hidden="true" />}
            Ubah kategori
          </button>
          <button
            type="button"
            onClick={onEditAccount}
            disabled={updating}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border px-4 text-sm font-medium text-text transition hover:border-brand/40 hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {updating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />}
            Ubah akun
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-danger px-4 text-sm font-semibold text-white shadow transition hover:bg-[color:var(--color-danger-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring-danger)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
            Hapus
          </button>
        </div>
      </div>
    </div>
  );
}

function TransactionsTable({
  items,
  loading,
  error,
  onRetry,
  onLoadMore,
  hasMore,
  onToggleSelect,
  onToggleSelectAll,
  allSelected,
  selectedIds,
  onDelete,
  onEdit,
  tableStickyTop,
  total,
  variant = "table",
  onResetFilters = () => {},
  onOpenAdd = () => {},
  deleteDisabled = false,
}) {
  const isCardVariant = variant === "card";
  const isInitialLoading = loading && items.length === 0;
  const isFetchingMore = loading && items.length > 0;
  const displayStart = items.length > 0 ? 1 : 0;
  const displayEnd = items.length;
  const stickyHeaderStyle = tableStickyTop ? { top: tableStickyTop } : undefined;

  if (error && !items.length) {
    return (
      <div className="rounded-2xl border border-danger/30 bg-danger/10 p-6 text-center">
        <p className="mb-3 text-sm font-medium text-danger">Gagal memuat data transaksi.</p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-danger/40 bg-white/80 px-4 text-sm font-semibold text-danger transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring-danger)]"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  if (!loading && !items.length) {
    return <EmptyTransactionsState onResetFilters={onResetFilters} onOpenAdd={onOpenAdd} />;
  }

  return (
    <section className="space-y-4">
      <div className={clsx("rounded-2xl border border-border bg-surface shadow-sm", isCardVariant ? "p-3" : "") }>
        {isCardVariant ? (
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <TransactionItem
                key={item.id}
                item={item}
                variant="card"
                isSelected={selectedIds.has(item.id)}
                onToggleSelect={(event) => onToggleSelect(item.id, event)}
                onDelete={() => onDelete(item.id)}
                onEdit={() => onEdit(item)}
                deleteDisabled={deleteDisabled}
              />
            ))}
            {isInitialLoading &&
              Array.from({ length: 6 }).map((_, index) => <TransactionSkeletonCard key={`card-skeleton-${index}`} />)}
            {isFetchingMore &&
              !isInitialLoading &&
              Array.from({ length: 2 }).map((_, index) => <TransactionSkeletonCard key={`card-fetch-${index}`} />)}
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="min-w-full table-fixed border-separate border-spacing-0" aria-label="Daftar transaksi">
              <thead
                className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900"
                style={stickyHeaderStyle}
              >
                <tr>
                  <th
                    scope="col"
                    className="w-12 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted"
                  >
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={onToggleSelectAll}
                      className="h-4 w-4 rounded border-border/70 text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                      aria-label="Pilih semua transaksi"
                    />
                  </th>
                  <th
                    scope="col"
                    className="min-w-[200px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted"
                  >
                    Kategori
                  </th>
                  <th
                    scope="col"
                    className="min-w-[160px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted"
                  >
                    Tanggal
                  </th>
                  <th
                    scope="col"
                    className="min-w-[240px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted"
                  >
                    Catatan
                  </th>
                  <th
                    scope="col"
                    className="min-w-[180px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted"
                  >
                    Akun
                  </th>
                  <th
                    scope="col"
                    className="min-w-[200px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted"
                  >
                    Tags
                  </th>
                  <th
                    scope="col"
                    className="min-w-[140px] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted"
                  >
                    Jumlah
                  </th>
                  <th
                    scope="col"
                    className="w-[120px] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted"
                  >
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {items.map((item) => (
                  <TransactionItem
                    key={item.id}
                    item={item}
                    variant="table"
                    isSelected={selectedIds.has(item.id)}
                    onToggleSelect={(event) => onToggleSelect(item.id, event)}
                    onDelete={() => onDelete(item.id)}
                    onEdit={() => onEdit(item)}
                    deleteDisabled={deleteDisabled}
                  />
                ))}
                {isInitialLoading &&
                  Array.from({ length: 6 }).map((_, index) => <TransactionSkeletonRow key={`row-skeleton-${index}`} />)}
                {isFetchingMore &&
                  !isInitialLoading &&
                  Array.from({ length: 2 }).map((_, index) => <TransactionSkeletonRow key={`row-fetch-${index}`} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <span>
          {total
            ? `Menampilkan ${displayStart || 0}–${displayEnd} dari ${total}`
            : `Menampilkan ${displayEnd} transaksi`}
        </span>
        {hasMore ? (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isFetchingMore}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-border px-4 text-sm font-medium text-text transition hover:border-brand/40 hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isFetchingMore && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {isFetchingMore ? "Memuat…" : "Muat lagi"}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function UndoSnackbar({ open, message, onUndo, loading }) {
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 sm:bottom-6"
      role="status"
      aria-live="polite"
    >
      <div className="flex w-full max-w-sm items-center gap-3 rounded-2xl border border-border bg-surface/95 px-4 py-3 text-sm text-text shadow-lg shadow-black/20">
        <span className="flex-1">{message}</span>
        <button
          type="button"
          onClick={onUndo}
          disabled={loading}
          className="inline-flex h-11 items-center justify-center rounded-xl border border-brand/50 px-4 text-sm font-semibold text-brand transition hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Urungkan'}
        </button>
      </div>
    </div>,
    document.body,
  );
}

function TransactionSkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 8 }).map((_, index) => (
        <td key={index} className="px-4 py-3 align-middle">
          <div className="h-4 w-full rounded-full bg-border/60" />
        </td>
      ))}
    </tr>
  );
}

function TransactionSkeletonCard() {
  return (
    <div className="rounded-2xl border border-border bg-surface/80 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="h-4 w-32 animate-pulse rounded-full bg-border/60" />
        <div className="h-5 w-20 animate-pulse rounded-full bg-border/60" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="h-4 w-full animate-pulse rounded-full bg-border/60" />
        <div className="h-4 w-full animate-pulse rounded-full bg-border/60" />
      </div>
      <div className="mt-4 h-12 w-full animate-pulse rounded-2xl bg-border/60" />
    </div>
  );
}

function TransactionItem({
  item,
  variant = "table",
  isSelected,
  onToggleSelect,
  onDelete,
  onEdit,
  deleteDisabled = false,
}) {
  const amountTone =
    item.type === "income"
      ? "text-success"
      : item.type === "transfer"
        ? "text-info"
        : "text-danger";
  const amountClass = clsx("text-right text-sm font-semibold tabular-nums", amountTone);
  const amountCardClass = clsx("text-lg font-semibold tabular-nums", amountTone);
  const note = item.notes ?? item.note ?? item.title ?? "";
  const noteDisplay = note.trim() ? note.trim() : "—";
  const formattedDate = formatTransactionDate(item.date);
  const dateValue = toDateInput(item.date);
  const categoryName = item.category || "(Tanpa kategori)";
  const tags = useMemo(() => parseTags(item.tags), [item.tags]);
  const hasAttachments = Boolean(item.receipt_url) || (Array.isArray(item.receipts) && item.receipts.length > 0);

  const selectionCheckbox = (
    <input
      type="checkbox"
      checked={isSelected}
      onChange={onToggleSelect}
      className="h-4 w-4 rounded border-border/70 text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      aria-label="Pilih transaksi"
    />
  );

  if (variant === "card") {
    return (
      <article
        className={clsx(
          "rounded-2xl border border-border bg-surface/90 p-4 shadow-sm transition-colors",
          isSelected && "border-brand/40 bg-brand/5 ring-2 ring-brand/40",
        )}
        onDoubleClick={onEdit}
      >
        <div className="flex items-start gap-3">
          <div className="pt-1">{selectionCheckbox}</div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={item.category_color ? { backgroundColor: item.category_color } : undefined}
                  aria-hidden="true"
                />
                <p className="text-sm font-semibold text-text" title={categoryName}>
                  {categoryName}
                </p>
                {hasAttachments && <Paperclip className="h-4 w-4 text-muted" aria-hidden="true" />}
              </div>
              <span className={clsx("text-right", amountCardClass)}>{formatIDR(item.amount)}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 text-sm text-muted sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide">Tanggal</p>
                <p className="font-medium text-text">
                  <time dateTime={dateValue}>{formattedDate}</time>
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide">Akun</p>
                <p className="font-medium text-text">
                  {item.type === "transfer" ? (
                    <span className="flex items-center gap-1">
                      <span className="truncate">{item.account || "—"}</span>
                      <ArrowRight className="h-4 w-4 text-muted" aria-hidden="true" />
                      <span className="truncate">{item.to_account || "—"}</span>
                    </span>
                  ) : (
                    <span className="truncate">{item.account || "—"}</span>
                  )}
                </p>
              </div>
            </div>
            <p className="line-clamp-2 text-sm text-muted" title={noteDisplay}>
              {noteDisplay}
            </p>
            {tags.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-text"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-border px-4 text-sm font-medium text-text transition hover:border-brand/40 hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            aria-label="Edit transaksi"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleteDisabled}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-danger/40 bg-danger/10 px-4 text-sm font-medium text-danger transition hover:bg-danger/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring-danger)] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Hapus transaksi"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Hapus
          </button>
        </div>
      </article>
    );
  }

  return (
    <tr
      className={clsx(
        "transition-colors",
        isSelected
          ? "bg-brand/10 shadow-[inset_0_0_0_1px_hsl(var(--color-primary)/0.35)]"
          : "hover:bg-surface-2/60",
      )}
      onDoubleClick={onEdit}
    >
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center justify-center">{selectionCheckbox}</div>
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center gap-3">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={item.category_color ? { backgroundColor: item.category_color } : undefined}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text" title={categoryName}>
              {categoryName}
            </p>
            <p className="text-xs uppercase tracking-wide text-muted">{TYPE_LABELS[item.type] || item.type}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 align-middle text-sm text-muted">
        <time dateTime={dateValue}>{formattedDate}</time>
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="flex items-start gap-2">
          <p className="line-clamp-2 text-sm text-text" title={noteDisplay}>
            {noteDisplay}
          </p>
          {hasAttachments && <Paperclip className="mt-0.5 h-4 w-4 text-muted" aria-hidden="true" />}
        </div>
      </td>
      <td className="px-4 py-3 align-middle text-sm text-text">
        {item.type === "transfer" ? (
          <div className="flex flex-wrap items-center gap-1">
            <span className="truncate">{item.account || "—"}</span>
            <ArrowRight className="h-4 w-4 text-muted" aria-hidden="true" />
            <span className="truncate">{item.to_account || "—"}</span>
          </div>
        ) : (
          <span className="truncate">{item.account || "—"}</span>
        )}
      </td>
      <td className="px-4 py-3 align-middle">
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-text"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-sm text-muted">—</span>
        )}
      </td>
      <td className="px-4 py-3 align-middle text-right">
        <span className={clsx("block", amountClass)}>{formatIDR(item.amount)}</span>
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-muted transition hover:border-brand/40 hover:bg-brand/5 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            aria-label="Edit transaksi"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleteDisabled}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-danger/40 bg-danger/10 text-danger transition hover:bg-danger/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring-danger)] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Hapus transaksi"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function EmptyTransactionsState({ onResetFilters, onOpenAdd }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-surface/80 px-6 py-16 text-center">
      <span className="rounded-full bg-brand/10 p-3 text-brand">
        <Inbox className="h-6 w-6" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-text">Belum ada transaksi sesuai filter</h2>
        <p className="text-sm text-muted">Coba atur ulang filter atau tambahkan transaksi baru.</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onResetFilters}
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-border px-4 text-sm font-medium text-text transition hover:border-brand/40 hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          Reset filter
        </button>
        <button
          type="button"
          onClick={onOpenAdd}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-brand px-4 text-sm font-semibold text-brand-foreground shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
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
  const [merchants, setMerchants] = useState([]);
  const [type, setType] = useState(initialData?.type || "expense");
  const [amount, setAmount] = useState(() => String(initialData?.amount ?? 0));
  const [date, setDate] = useState(() => toDateInput(initialData?.date) || new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState(initialData?.category_id || "");
  const [title, setTitle] = useState(initialData?.title || "");
  const [notes, setNotes] = useState(initialData?.notes ?? initialData?.note ?? "");
  const [accountId, setAccountId] = useState(initialData?.account_id || "");
  const [merchantId, setMerchantId] = useState(initialData?.merchant_id || "");
  const [receiptUrl, setReceiptUrl] = useState(initialData?.receipt_url || "");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([listAccounts(), listMerchants()])
      .then(([accountRows, merchantRows]) => {
        setAccounts(accountRows || []);
        setMerchants(merchantRows || []);
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
    setMerchantId(initialData.merchant_id || "");
    setReceiptUrl(initialData.receipt_url || "");
  }, [open, initialData]);

  const categoryOptions = useMemo(() => {
    return (categories || []).filter((cat) => cat.type === type);
  }, [categories, type]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const amountNumber = Number(amount.toString().replace(/[^0-9.,-]/g, "").replace(/,/g, "."));
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      addToast("Nominal harus lebih besar dari 0", "error");
      return;
    }
    if (!categoryId) {
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
        category_id: categoryId,
        title,
        notes,
        account_id: accountId || null,
        merchant_id: merchantId || null,
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
                  const nextOptions = (categories || []).filter((cat) => cat.type === nextType);
                  if (!nextOptions.some((cat) => cat.id === categoryId)) {
                    setCategoryId(nextOptions[0]?.id || "");
                  }
                }}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
              >
                <option value="expense">Pengeluaran</option>
                <option value="income">Pemasukan</option>
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
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/60">Akun</span>
              <select
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
              >
                <option value="">Pilih akun</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name || "(Tanpa nama)"}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/60">Merchant</span>
              <select
                value={merchantId}
                onChange={(event) => setMerchantId(event.target.value)}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
              >
                <option value="">Pilih merchant</option>
                {merchants.map((merchant) => (
                  <option key={merchant.id} value={merchant.id}>
                    {merchant.name || "(Tanpa nama)"}
                  </option>
                ))}
              </select>
            </label>
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
