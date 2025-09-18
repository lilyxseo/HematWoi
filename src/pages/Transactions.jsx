import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Download,
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
import {
  addTransaction,
  deleteTransaction,
  listAccounts,
  listMerchants,
  listTags,
  listTransactions,
  updateTransaction,
} from "../lib/api";
import { formatCurrency } from "../lib/format";
import { flushQueue, onStatusChange, pending } from "../lib/sync/SyncEngine";
import { parseCSV } from "../lib/statement";

const TYPE_LABELS = {
  income: "Pemasukan",
  expense: "Pengeluaran",
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

function chunk(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export default function Transactions() {
  const {
    items,
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
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const filterBarRef = useRef(null);
  const [filterBarHeight, setFilterBarHeight] = useState(0);
  const searchInputRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState(filter.search);
  const [filterBarStuck, setFilterBarStuck] = useState(false);

  useEffect(() => {
    setSearchTerm(filter.search);
  }, [filter.search]);

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
        setAddOpen(true);
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

  const categoriesByType = useMemo(() => {
    const map = { income: [], expense: [] };
    (categories || []).forEach((cat) => {
      const type = (cat.type || "expense").toLowerCase();
      if (!map[type]) map[type] = [];
      map[type].push(cat);
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

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(() => {
      if (allSelected) return new Set();
      return new Set(items.map((item) => item.id));
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

  const handleUpdateRow = useCallback(
    async (id, patch) => {
      try {
        await updateTransaction(id, patch);
        addToast("Transaksi diperbarui", "success");
        refresh({ keepPage: true });
      } catch (err) {
        console.error(err);
        addToast(err?.message || "Gagal memperbarui transaksi", "error");
        throw err;
      }
    },
    [addToast, refresh],
  );

  const handleDelete = useCallback(
    async (id) => {
      const confirmed = window.confirm("Hapus transaksi ini?");
      if (!confirmed) return;
      try {
        await deleteTransaction(id);
        addToast("Transaksi dihapus", "success");
        refresh();
      } catch (err) {
        console.error(err);
        addToast(err?.message || "Gagal menghapus transaksi", "error");
      }
    },
    [addToast, refresh],
  );

  const handleBulkDelete = useCallback(async () => {
    if (!selectedItems.length) return;
    const confirmed = window.confirm(`Hapus ${selectedItems.length} transaksi terpilih?`);
    if (!confirmed) return;
    setBulkDeleting(true);
    try {
      for (const item of selectedItems) {
        await deleteTransaction(item.id);
      }
      addToast("Transaksi terpilih dihapus", "success");
      setSelectedIds(new Set());
      refresh();
    } catch (err) {
      console.error(err);
      addToast(err?.message || "Gagal menghapus beberapa transaksi", "error");
    } finally {
      setBulkDeleting(false);
    }
  }, [addToast, refresh, selectedItems]);

  const handleBulkExport = useCallback(() => {
    if (!selectedItems.length) return;
    const lines = ["date,type,category_name,amount,title,notes,tags"];
    selectedItems.forEach((item) => {
      const categoryName = item.category || categoriesById.get(item.category_id)?.name || "";
      const title = (item.title || "").replaceAll('"', '""');
      const notes = (item.notes ?? item.note ?? "").replaceAll('"', '""');
      const tags = Array.isArray(item.tags) ? item.tags.join("|") : "";
      lines.push(
        `${toDateInput(item.date)},${item.type},"${categoryName}",${Number(item.amount ?? 0)},"${title}","${notes}","${tags}"`,
      );
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-selected-${Date.now()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    addToast("Export transaksi terpilih berhasil", "success");
  }, [addToast, categoriesById, selectedItems]);

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
      const lines = ["date,type,category_name,amount,title,notes,tags"];
      rows.forEach((item) => {
        const categoryName = item.category || categoriesById.get(item.category_id)?.name || "";
        const title = (item.title || "").replaceAll('"', '""');
        const notes = (item.notes ?? item.note ?? "").replaceAll('"', '""');
        const tags = Array.isArray(item.tags) ? item.tags.join("|") : "";
        lines.push(
          `${toDateInput(item.date)},${item.type},"${categoryName}",${Number(item.amount ?? 0)},"${title}","${notes}","${tags}"`,
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

  const handleFormSuccess = useCallback(() => {
    refresh();
    setSelectedIds(new Set());
  }, [refresh]);

  const tableStickyTop = `calc(var(--app-header-height, var(--app-topbar-h, 64px)) + ${filterBarHeight}px + 16px)`;

  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 pb-10 sm:px-6 lg:px-8">
      <div className="space-y-6 sm:space-y-7 lg:space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Transaksi</h1>
            <p className="text-sm text-white/60">{PAGE_DESCRIPTION}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
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
          </div>
        </header>

        <div
          ref={filterBarRef}
          className={clsx(
            "sticky z-20 rounded-2xl border border-white/10 bg-slate-900/60 transition-all",
            filterBarStuck && "border-white/15 shadow-[0_12px_30px_-16px_rgba(15,23,42,0.85)]"
          )}
          style={{
            top: "var(--app-header-height, var(--app-topbar-h, 64px))",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)"
          }}
        >
          <TransactionsFilterBar
            filter={filter}
            categories={categories}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onFilterChange={setFilter}
            searchInputRef={searchInputRef}
            onOpenAdd={() => setAddOpen(true)}
          />
          {activeChips.length > 0 && (
            <ActiveFilterChips chips={activeChips} onRemove={handleRemoveChip} />
          )}
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

        {selectedIds.size > 0 && (
          <BulkActionsBar
            count={selectedIds.size}
            onClear={() => setSelectedIds(new Set())}
            onDelete={handleBulkDelete}
            onExport={handleBulkExport}
            deleting={bulkDeleting}
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
          onUpdate={handleUpdateRow}
          onDelete={handleDelete}
          categoriesByType={categoriesByType}
          tableStickyTop={tableStickyTop}
          total={total}
        />
      </div>

      {addOpen && (
        <TransactionFormDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          mode="create"
          categories={categories}
          onSuccess={handleFormSuccess}
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
  const toolbarRef = useRef(null);
  const customButtonRef = useRef(null);
  const moreButtonRef = useRef(null);
  const actualSearchInputRef = useRef(null);
  const collapseRef = useRef(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [collapseSecondary, setCollapseSecondary] = useState(false);
  const [viewport, setViewport] = useState(() => {
    if (typeof window === "undefined") return "desktop";
    const width = window.innerWidth;
    if (width < 992) return "mobile";
    if (width < 1280) return "tablet";
    return "desktop";
  });
  const [scrollHints, setScrollHints] = useState({ left: false, right: false });

  const typeSelectId = useId();
  const sortSelectId = useId();
  const searchInputId = useId();

  const isMobile = viewport === "mobile";
  const isTablet = viewport === "tablet";

  useEffect(() => {
    collapseRef.current = collapseSecondary;
  }, [collapseSecondary]);

  useEffect(() => {
    if (!searchInputRef) return;
    searchInputRef.current = {
      focus: () => {
        if (isMobile) {
          setMobileSearchOpen(true);
          requestAnimationFrame(() => {
            actualSearchInputRef.current?.focus();
            actualSearchInputRef.current?.select();
          });
        } else {
          actualSearchInputRef.current?.focus();
          actualSearchInputRef.current?.select();
        }
      },
    };
  }, [isMobile, searchInputRef]);

  const detectViewport = useCallback(() => {
    if (typeof window === "undefined") return "desktop";
    const width = window.innerWidth;
    if (width < 992) return "mobile";
    if (width < 1280) return "tablet";
    return "desktop";
  }, []);

  useEffect(() => {
    const handler = () => {
      setViewport(detectViewport());
    };
    handler();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [detectViewport]);

  const ensureCollapse = useCallback((next) => {
    if (collapseRef.current !== next) {
      collapseRef.current = next;
      setCollapseSecondary(next);
    }
  }, []);

  const updateOverflow = useCallback(() => {
    const element = toolbarRef.current;
    if (!element) return;
    if (!isTablet) {
      ensureCollapse(false);
      return;
    }
    if (!collapseRef.current) {
      const overflow = element.scrollWidth - element.clientWidth > 4;
      if (overflow) {
        ensureCollapse(true);
      }
      return;
    }
    ensureCollapse(false);
    requestAnimationFrame(() => {
      const target = toolbarRef.current;
      if (!target) return;
      const overflow = target.scrollWidth - target.clientWidth > 4;
      if (overflow) {
        ensureCollapse(true);
      }
    });
  }, [ensureCollapse, isTablet]);

  useEffect(() => {
    const element = toolbarRef.current;
    if (!element) return;
    updateOverflow();
    const observer = new ResizeObserver(() => updateOverflow());
    observer.observe(element);
    window.addEventListener("resize", updateOverflow);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateOverflow);
    };
  }, [updateOverflow]);

  useEffect(() => {
    updateOverflow();
  }, [updateOverflow, filter.categories.length, filter.period.end, filter.period.preset, filter.period.start, searchTerm, viewport]);

  const updateScrollHints = useCallback(() => {
    const element = toolbarRef.current;
    if (!element) return;
    const maxScroll = element.scrollWidth - element.clientWidth;
    setScrollHints({
      left: element.scrollLeft > 8,
      right: maxScroll - element.scrollLeft > 8,
    });
  }, []);

  useEffect(() => {
    const element = toolbarRef.current;
    if (!element) return;
    updateScrollHints();
    element.addEventListener("scroll", updateScrollHints, { passive: true });
    const observer = new ResizeObserver(() => updateScrollHints());
    observer.observe(element);
    window.addEventListener("resize", updateScrollHints);
    return () => {
      element.removeEventListener("scroll", updateScrollHints);
      observer.disconnect();
      window.removeEventListener("resize", updateScrollHints);
    };
  }, [updateScrollHints, collapseSecondary, viewport]);

  useEffect(() => {
    updateScrollHints();
  }, [updateScrollHints, collapseSecondary, viewport]);

  useEffect(() => {
    if (!isTablet) {
      setMoreOpen(false);
    }
  }, [isTablet]);

  useEffect(() => {
    if (!collapseSecondary) {
      setMoreOpen(false);
    }
  }, [collapseSecondary]);

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

  const handleOpenSearch = () => {
    if (isMobile) {
      setMobileSearchOpen(true);
      requestAnimationFrame(() => {
        actualSearchInputRef.current?.focus();
        actualSearchInputRef.current?.select();
      });
    } else {
      actualSearchInputRef.current?.focus();
      actualSearchInputRef.current?.select();
    }
  };

  const showSecondaryInline = !isTablet || !collapseSecondary;
  const showMoreButton = isTablet && collapseSecondary;
  const toolbarStyle = {
    overscrollBehaviorInline: "contain",
    scrollbarGutter: "stable both-edges",
  };

  const handleTypeChange = (value) => {
    onFilterChange({ type: value });
    if (showMoreButton) {
      setMoreOpen(false);
    }
  };

  const handleSortChange = (value) => {
    onFilterChange({ sort: value });
    if (showMoreButton) {
      setMoreOpen(false);
    }
  };

  const typeSelect = (
    <div className="flex min-w-[160px] flex-shrink-0">
      <label htmlFor={typeSelectId} className="sr-only">
        Filter jenis transaksi
      </label>
      <select
        id={typeSelectId}
        value={filter.type}
        onChange={(event) => handleTypeChange(event.target.value)}
        aria-label="Filter jenis transaksi"
        className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
      >
        <option value="all">Semua</option>
        <option value="expense">Pengeluaran</option>
        <option value="income">Pemasukan</option>
        <option value="transfer">Transfer</option>
      </select>
    </div>
  );

  const sortSelect = (
    <div className="flex min-w-[160px] flex-shrink-0">
      <label htmlFor={sortSelectId} className="sr-only">
        Urutkan transaksi
      </label>
      <select
        id={sortSelectId}
        value={filter.sort}
        onChange={(event) => handleSortChange(event.target.value)}
        aria-label="Urutkan transaksi"
        className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
      >
        <option value="date-desc">Terbaru</option>
        <option value="date-asc">Terlama</option>
        <option value="amount-desc">Terbesar</option>
        <option value="amount-asc">Terkecil</option>
      </select>
    </div>
  );

  return (
    <div className="relative">
      <div
        ref={toolbarRef}
        role="toolbar"
        aria-label="Filter transaksi"
        className="flex items-center gap-3 overflow-x-auto whitespace-nowrap px-4 py-3"
        style={toolbarStyle}
      >
        <div
          className="flex h-11 flex-shrink-0 items-center gap-1 rounded-full border border-white/15 bg-white/10 px-1.5"
          role="group"
          aria-label="Rentang waktu"
        >
          {Object.entries(PERIOD_LABELS).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => handlePresetChange(value)}
              ref={value === "custom" ? customButtonRef : undefined}
              className={clsx(
                "inline-flex h-9 items-center rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
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
        <CategoryMultiSelect
          categories={categories}
          selected={filter.categories}
          onChange={handleCategoryChange}
          ariaLabel="Filter kategori transaksi"
        />
        {showSecondaryInline && typeSelect}
        {showSecondaryInline && sortSelect}
        {!isMobile && (
          <div className="relative flex min-w-[280px] flex-1 items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-white/40" aria-hidden="true" />
            <input
              id={searchInputId}
              ref={actualSearchInputRef}
              type="search"
              value={searchTerm}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Cari judul, catatan, nominal"
              aria-label="Cari transaksi"
              className="h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-white placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            />
          </div>
        )}
        {isMobile && (
          <button
            type="button"
            onClick={handleOpenSearch}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            aria-label="Buka pencarian transaksi"
          >
            <Search className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={handleReset}
          className="flex h-11 flex-shrink-0 items-center rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-medium text-white/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          aria-label="Reset semua filter"
        >
          Reset
        </button>
        {showMoreButton && (
          <button
            type="button"
            ref={moreButtonRef}
            onClick={() => setMoreOpen((prev) => !prev)}
            className="flex h-11 flex-shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-medium text-white/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            aria-label="Tampilkan filter lainnya"
          >
            More ▾
          </button>
        )}
        <button
          type="button"
          onClick={onOpenAdd}
          className="inline-flex h-11 flex-shrink-0 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          aria-label="Tambah transaksi"
        >
          <Plus className="h-4 w-4" /> Tambah Transaksi
        </button>
      </div>
      {isMobile && scrollHints.left && (
        <div className="pointer-events-none absolute left-0 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center bg-gradient-to-r from-slate-900/80 to-transparent text-white/60">
          <ChevronLeft className="h-4 w-4" />
        </div>
      )}
      {isMobile && scrollHints.right && (
        <div className="pointer-events-none absolute right-0 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center bg-gradient-to-l from-slate-900/80 to-transparent text-white/60">
          <ChevronRight className="h-4 w-4" />
        </div>
      )}
      {customOpen && filter.period.preset === "custom" && (
        <CustomRangePopover
          anchorRef={customButtonRef}
          period={filter.period}
          onChange={(next) => onFilterChange({ period: next })}
          onClose={() => setCustomOpen(false)}
        />
      )}
      {showMoreButton && moreOpen && (
        <MoreMenu anchorRef={moreButtonRef} onClose={() => setMoreOpen(false)}>
          <div className="space-y-3" role="none">
            <div className="w-full" role="menuitem">
              {typeSelect}
            </div>
            <div className="w-full" role="menuitem">
              {sortSelect}
            </div>
          </div>
        </MoreMenu>
      )}
      {isMobile && (
        <MobileSearchSheet
          open={mobileSearchOpen}
          onClose={() => setMobileSearchOpen(false)}
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
          inputRef={actualSearchInputRef}
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
        className="inline-flex h-11 min-w-[260px] max-w-[320px] flex-shrink-0 items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
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
                          <span className="text-xs text-white/40">{TYPE_LABELS[cat.type] || ""}</span>
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

function MoreMenu({ anchorRef, onClose, children }) {
  const menuRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    const anchor = anchorRef?.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = 280;
    const left = Math.min(
      Math.max(16, rect.right - width),
      window.innerWidth - width - 16,
    );
    setPosition({ top: rect.bottom + 8, left, width });
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
      if (menuRef.current?.contains(event.target)) return;
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
        ref={menuRef}
        role="menu"
        className="absolute w-[min(280px,calc(100%-32px))] rounded-2xl border border-white/10 bg-slate-900/95 p-4 shadow-2xl backdrop-blur"
        style={{ top: position.top, left: position.left, width: position.width || undefined }}
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/60">Filter lainnya</p>
        {children}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

function MobileSearchSheet({ open, onClose, searchTerm, onSearchChange, inputRef }) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      inputRef?.current?.focus();
      inputRef?.current?.select();
    });
  }, [open, inputRef]);

  if (!open) return null;

  const content = (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-950/80 backdrop-blur-sm">
      <button
        type="button"
        className="flex-1"
        onClick={onClose}
        aria-label="Tutup pencarian"
      />
      <div
        className="rounded-t-3xl border border-white/10 bg-slate-900/95 p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Cari transaksi"
      >
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
          <Search className="h-5 w-5 text-white/50" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Cari judul, catatan, nominal"
            className="flex-1 bg-transparent text-base text-white placeholder:text-white/40 focus-visible:outline-none"
            aria-label="Cari transaksi"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            Batal
          </button>
        </div>
        <p className="mt-3 text-xs text-white/50">Gunakan Ctrl/Cmd + / untuk membuka lebih cepat.</p>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

function ActiveFilterChips({ chips, onRemove }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-slate-900/40 px-4 py-3">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onRemove(chip)}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
        >
          <span>{chip.label}</span>
          <X className="h-3.5 w-3.5" />
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
      accent: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      key: "expense",
      title: "Pengeluaran",
      value: summary?.expense ?? 0,
      accent: "text-rose-400",
      bg: "bg-rose-500/10",
    },
    {
      key: "net",
      title: "Net",
      value: summary?.net ?? 0,
      accent: "text-sky-400",
      bg: "bg-sky-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.key}
          className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-white/60">{card.title}</p>
          {loading ? (
            <div className="mt-3 h-6 w-32 animate-pulse rounded bg-white/10" />
          ) : (
            <p className={clsx("mt-2 text-2xl font-semibold", card.accent)}>{formatIDR(card.value)}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function BulkActionsBar({ count, onClear, onDelete, onExport, deleting }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-brand/20 px-3 py-1 text-xs font-semibold text-brand">{count} dipilih</span>
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-medium text-white/70 hover:text-white"
        >
          Hapus pilihan
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onExport}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
        >
          <Download className="h-3.5 w-3.5" /> Export terpilih
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white shadow focus-visible:outline-none focus-visible:ring focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Hapus terpilih
        </button>
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
  onUpdate,
  onDelete,
  categoriesByType,
  tableStickyTop,
  total,
}) {
  const isFetchingMore = loading && items.length > 0;
  const start = items.length > 0 ? 1 : 0;
  const end = items.length;

  if (error && items.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/70">
        <p className="mb-3 text-sm">Gagal memuat data transaksi.</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/5 py-16 text-center text-white/70">
        <span className="rounded-full bg-white/10 p-3">
          <Plus className="h-6 w-6" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-white">Belum ada transaksi</h2>
          <p className="text-sm text-white/60">Mulai catat transaksi agar laporanmu lebih akurat.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
        <table className="min-w-full text-sm text-white/80">
          <thead
            className="bg-white/5 text-left text-xs uppercase tracking-wide text-white/60"
            style={{ position: "sticky", top: tableStickyTop, zIndex: 10 }}
          >
            <tr>
              <th className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="h-4 w-4 rounded border-white/30 bg-transparent text-brand focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
                  aria-label="Pilih semua"
                />
              </th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Catatan</th>
              <th className="px-4 py-3">Akun</th>
              <th className="px-4 py-3">Tags</th>
              <th className="px-4 py-3 text-right">Jumlah</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <TransactionRow
                key={item.id}
                item={item}
                isSelected={selectedIds.has(item.id)}
                onToggleSelect={() => onToggleSelect(item.id)}
                onUpdate={onUpdate}
                onDelete={() => onDelete(item.id)}
                categoriesByType={categoriesByType}
              />
            ))}
            {loading && items.length === 0 && (
              <tr className="border-t border-white/10">
                <td colSpan={8} className="px-4 py-6">
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div key={index} className="h-10 animate-pulse rounded bg-white/10" />
                    ))}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 text-sm text-white/60 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Menampilkan {start}-{end} dari {total}
        </span>
        <div className="flex items-center gap-2">
          {hasMore && (
            <button
              type="button"
              onClick={onLoadMore}
              disabled={isFetchingMore}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isFetchingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Muat lebih
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TransactionRow({ item, isSelected, onToggleSelect, onUpdate, onDelete, categoriesByType }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(() => ({
    date: toDateInput(item.date),
    category_id: item.category_id || "",
    notes: item.notes ?? item.note ?? "",
    amount: String(item.amount ?? 0),
  }));

  useEffect(() => {
    setDraft({
      date: toDateInput(item.date),
      category_id: item.category_id || "",
      notes: item.notes ?? item.note ?? "",
      amount: String(item.amount ?? 0),
    });
  }, [item]);

  const categoryOptions = useMemo(() => {
    const list = categoriesByType[item.type] || [];
    return list.length ? list : categoriesByType.expense || [];
  }, [categoriesByType, item.type]);

  const amountNumber = Number(draft.amount.replace(/[^0-9.,-]/g, "").replace(/,/g, "."));

  const handleSave = async () => {
    if (!draft.category_id) {
      alert("Kategori wajib dipilih");
      return;
    }
    if (!draft.date) {
      alert("Tanggal tidak valid");
      return;
    }
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      alert("Nominal harus lebih besar dari 0");
      return;
    }
    setSaving(true);
    try {
      await onUpdate(item.id, {
        category_id: draft.category_id,
        date: draft.date,
        notes: draft.notes,
        amount: amountNumber,
      });
      setEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setDraft({
      date: toDateInput(item.date),
      category_id: item.category_id || "",
      notes: item.notes ?? item.note ?? "",
      amount: String(item.amount ?? 0),
    });
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSave();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      handleCancel();
    }
  };

  const hasAttachments = Boolean(item.receipt_url) || (Array.isArray(item.receipts) && item.receipts.length > 0);

  return (
    <tr className="border-b border-white/5 hover:bg-white/5">
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="h-4 w-4 rounded border-white/30 bg-transparent text-brand focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
          aria-label="Pilih baris"
        />
      </td>
      <td className="px-4 py-3 align-top">
        {editing ? (
          <select
            value={draft.category_id}
            onChange={(event) => setDraft((prev) => ({ ...prev, category_id: event.target.value }))}
            className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
          >
            <option value="">Pilih kategori</option>
            {categoryOptions.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex flex-col">
            <span className="font-semibold text-white">{item.category || "(Tidak ada kategori)"}</span>
            <span className="text-xs text-white/40">{TYPE_LABELS[item.type] || ""}</span>
          </div>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        {editing ? (
          <input
            type="date"
            value={draft.date}
            onChange={(event) => setDraft((prev) => ({ ...prev, date: event.target.value }))}
            onKeyDown={handleKeyDown}
            className="rounded-lg border border-white/15 bg-white/10 px-3 py-1 text-sm text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
          />
        ) : (
          <span>{toDateInput(item.date)}</span>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        {editing ? (
          <textarea
            value={draft.notes}
            onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
            onKeyDown={handleKeyDown}
            rows={2}
            className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
          />
        ) : (
          <span className="line-clamp-2 text-white/70">{item.notes ?? item.note ?? "-"}</span>
        )}
      </td>
      <td className="px-4 py-3 align-top text-white/70">{item.account || "-"}</td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-wrap gap-1">
          {Array.isArray(item.tags) && item.tags.length > 0
            ? item.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">
                  {tag}
                </span>
              ))
            : "-"}
        </div>
      </td>
      <td className={clsx("px-4 py-3 align-top text-right font-semibold", item.type === "income" ? "text-emerald-400" : "text-rose-400")}
      >
        {editing ? (
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.amount}
            onChange={(event) => setDraft((prev) => ({ ...prev, amount: event.target.value }))}
            onKeyDown={handleKeyDown}
            className="w-32 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-right text-sm text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
          />
        ) : (
          formatIDR(item.amount)
        )}
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex items-center justify-end gap-1">
          {hasAttachments && item.receipt_url && (
            <a
              href={item.receipt_url}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/15 bg-white/5 p-2 text-white/70 hover:bg-white/10 focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
              aria-label="Lihat lampiran"
            >
              <Paperclip className="h-4 w-4" />
            </a>
          )}
          {editing ? (
            <>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-full bg-emerald-500 p-2 text-white shadow focus-visible:outline-none focus-visible:ring focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Simpan perubahan"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-full border border-white/15 bg-white/5 p-2 text-white/70 hover:bg-white/10 focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
                aria-label="Batalkan edit"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-full border border-white/15 bg-white/5 p-2 text-white/70 hover:bg-white/10 focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
                aria-label="Edit cepat"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="rounded-full border border-white/15 bg-white/5 p-2 text-white/70 hover:bg-rose-500/30 focus-visible:outline-none focus-visible:ring focus-visible:ring-rose-300"
                aria-label="Hapus transaksi"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
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

function TransactionFormDialog({ open, onClose, mode, initialData, categories, onSuccess, addToast }) {
  const isEdit = mode === "edit" && initialData;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [tags, setTags] = useState([]);
  const [type, setType] = useState(initialData?.type || "expense");
  const [amount, setAmount] = useState(() => String(initialData?.amount ?? 0));
  const [date, setDate] = useState(() => toDateInput(initialData?.date) || new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState(initialData?.category_id || "");
  const [title, setTitle] = useState(initialData?.title || "");
  const [notes, setNotes] = useState(initialData?.notes ?? initialData?.note ?? "");
  const [accountId, setAccountId] = useState(initialData?.account_id || "");
  const [merchantId, setMerchantId] = useState(initialData?.merchant_id || "");
  const [selectedTags, setSelectedTags] = useState(() => (Array.isArray(initialData?.tag_ids) ? initialData.tag_ids : []));
  const [receiptUrl, setReceiptUrl] = useState(initialData?.receipt_url || "");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([listAccounts(), listMerchants(), listTags()])
      .then(([accountRows, merchantRows, tagRows]) => {
        setAccounts(accountRows || []);
        setMerchants(merchantRows || []);
        setTags(tagRows || []);
        if (!isEdit && accountRows?.length && !accountId) {
          setAccountId(accountRows[0].id);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        addToast(err?.message || "Gagal memuat master data", "error");
        setLoading(false);
      });
  }, [open, isEdit, accountId, addToast]);

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
    setSelectedTags(Array.isArray(initialData.tag_ids) ? initialData.tag_ids : []);
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
        tags: selectedTags,
        receipt_url: receiptUrl || null,
      };
      if (isEdit) {
        await updateTransaction(initialData.id, payload);
        addToast("Transaksi diperbarui", "success");
      } else {
        await addTransaction(payload);
        addToast("Transaksi ditambahkan", "success");
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      addToast(err?.message || "Gagal menyimpan transaksi", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Transaksi" : "Tambah Transaksi"}>
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
            <span className="text-xs font-semibold uppercase tracking-wide text-white/60">Tags</span>
            <select
              multiple
              value={selectedTags}
              onChange={(event) => {
                const values = Array.from(event.target.selectedOptions).map((option) => option.value);
                setSelectedTags(values);
              }}
              className="min-h-[96px] rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
            >
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
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
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? "Simpan Perubahan" : "Tambah"}
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
  const [tags, setTags] = useState([]);

  const categoriesByName = useMemo(() => {
    const map = new Map();
    (categories || []).forEach((cat) => {
      if (!cat?.name) return;
      map.set(cat.name.trim().toLowerCase(), cat.id);
    });
    return map;
  }, [categories]);

  const tagsByName = useMemo(() => {
    const map = new Map();
    (tags || []).forEach((tag) => {
      if (!tag?.name) return;
      map.set(tag.name.trim().toLowerCase(), tag.id);
    });
    return map;
  }, [tags]);

  useEffect(() => {
    if (!open) return;
    listTags()
      .then((rows) => setTags(rows || []))
      .catch((err) => {
        console.error(err);
        addToast(err?.message || "Gagal memuat data tag", "error");
      });
  }, [open, addToast]);

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
        const tagNames = (row.tags || "")
          .split(/[|;,]/)
          .map((tag) => tag.trim())
          .filter(Boolean);
        const tagIds = [];
        let tagError = false;
        tagNames.forEach((tagName) => {
          const tagId = tagsByName.get(tagName.toLowerCase());
          if (!tagId) {
            issues.push(`Baris ${line}: tag '${tagName}' tidak ditemukan`);
            tagError = true;
          } else {
            tagIds.push(tagId);
          }
        });
        if (tagError) return;
        valid.push({
          type,
          date,
          amount,
          category_id: categoryId,
          title,
          notes,
          tags: tagIds,
        });
        if (preview.length < 10) {
          preview.push({ type, date, amount, category: row.category || row.category_name, title, notes, tags: tagNames });
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
