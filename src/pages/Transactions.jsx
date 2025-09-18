import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { useVirtualizer } from "@tanstack/react-virtual";
import { autoUpdate, flip, offset, shift, useFloating } from "@floating-ui/react";
import {
  AlertTriangle,
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
import { CategoryContext } from "../context/CategoryContext";
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
import CategoryFilterDropdown from "../components/CategoryFilterDropdown";

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

const ROW_HEIGHT = 56;

const COLUMN_DEFS = [
  { key: "select", header: "", template: "48px", align: "center" },
  { key: "category", header: "Kategori", template: "minmax(160px, 1.3fr)" },
  { key: "date", header: "Tanggal", template: "minmax(140px, 0.9fr)" },
  { key: "notes", header: "Catatan", template: "minmax(280px, 1.8fr)" },
  { key: "account", header: "Akun", template: "minmax(140px, 0.9fr)", hideOn: "tablet" },
  { key: "tags", header: "Tags", template: "minmax(160px, 0.9fr)", hideOn: "tablet" },
  { key: "amount", header: "Jumlah", template: "minmax(140px, 0.8fr)", align: "end" },
  { key: "actions", header: "Aksi", template: "80px", align: "end" },
];

function buildColumnTemplate(columns) {
  return columns.map((column) => column.template).join(" ");
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
  const { getColor } = useContext(CategoryContext);
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
  const categoryDropdownRef = useRef(null);

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
      if (!isTyping && event.key === "/") {
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
    }, 300);
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
      chips.push({ key: "period", label: PERIOD_LABELS.month, removable: true });
    } else if (filter.period.preset === "week") {
      chips.push({ key: "period", label: PERIOD_LABELS.week, removable: true });
    } else if (filter.period.preset === "custom") {
      const start = filter.period.start ? filter.period.start : "?";
      const end = filter.period.end ? filter.period.end : "?";
      chips.push({ key: "period", label: `Rentang: ${start} - ${end}`, removable: true });
    }

    const categoryChips = filter.categories
      .map((id) => {
        const cat = categoriesById.get(id) || categoriesById.get(id?.toLowerCase?.());
        const label = cat?.name || "Kategori";
        return {
          key: `category:${id}`,
          label,
          removable: true,
          color: getColor(label),
        };
      })
      .filter(Boolean);

    const MAX_VISIBLE_CATEGORY_CHIPS = 2;
    if (categoryChips.length > MAX_VISIBLE_CATEGORY_CHIPS) {
      const visible = categoryChips.slice(0, MAX_VISIBLE_CATEGORY_CHIPS);
      chips.push(...visible);
      chips.push({
        key: "category-overflow",
        label: `+${categoryChips.length - MAX_VISIBLE_CATEGORY_CHIPS}`,
        removable: false,
        action: "open-category",
      });
    } else {
      chips.push(...categoryChips);
    }

    if (filter.type !== "all") {
      chips.push({ key: "type", label: TYPE_LABELS[filter.type] || filter.type, removable: true });
    }
    if (filter.sort !== "date-desc") {
      chips.push({ key: "sort", label: SORT_LABELS[filter.sort] || "Sort", removable: true });
    }
    if (filter.search.trim()) {
      chips.push({ key: "search", label: `Cari: ${filter.search}`, removable: true });
    }
    return chips;
  }, [filter, categoriesById, getColor]);

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

  const tableStickyTop = `calc(var(--app-topbar-h, 64px) + ${filterBarHeight}px + 16px)`;

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
          className="sticky top-[calc(var(--app-topbar-h,64px)+8px)] z-20 rounded-2xl border border-white/10 bg-white/5 backdrop-blur"
        >
          <TransactionsFilterBar
            filter={filter}
            categories={categories}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onFilterChange={setFilter}
            searchInputRef={searchInputRef}
            categoryDropdownRef={categoryDropdownRef}
          />
          {activeChips.length > 0 && (
            <ActiveFilterChips
              chips={activeChips}
              onRemove={handleRemoveChip}
              onOpenCategory={() => categoryDropdownRef.current?.open?.()}
            />
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
          sort={filter.sort}
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
  categoryDropdownRef,
}) {
  const currentMonth = currentMonthValue();

  const handlePresetChange = (preset) => {
    if (preset === filter.period.preset) return;
    if (preset === "all") {
      onFilterChange({ period: { preset: "all", month: "", start: "", end: "" } });
      return;
    }
    if (preset === "month") {
      onFilterChange({ period: { preset: "month", month: filter.period.month || currentMonth, start: "", end: "" } });
      return;
    }
    if (preset === "week") {
      onFilterChange({ period: { preset: "week", month: "", start: "", end: "" } });
      return;
    }
    if (preset === "custom") {
      const today = new Date().toISOString().slice(0, 10);
      onFilterChange({ period: { preset: "custom", month: "", start: filter.period.start || today, end: filter.period.end || today } });
    }
  };

  const handleCategoryChange = (selected) => {
    onFilterChange({ categories: selected });
  };

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5 lg:p-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <div className="space-y-2 md:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-white/60">Rentang Waktu</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PERIOD_LABELS).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => handlePresetChange(value)}
                className={clsx(
                  "rounded-full px-3 py-1 text-sm font-medium focus-visible:outline-none focus-visible:ring",
                  filter.period.preset === value
                    ? "bg-brand text-white shadow"
                    : "border border-white/20 bg-white/5 text-white/70 hover:bg-white/10",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {filter.period.preset === "custom" && (
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-white/70">
                <span>Mulai</span>
                <input
                  type="date"
                  value={filter.period.start || ""}
                  onChange={(event) =>
                    onFilterChange({ period: { ...filter.period, start: event.target.value } })
                  }
                  className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/70">
                <span>Selesai</span>
                <input
                  type="date"
                  value={filter.period.end || ""}
                  min={filter.period.start || undefined}
                  onChange={(event) =>
                    onFilterChange({ period: { ...filter.period, end: event.target.value } })
                  }
                  className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
                />
              </label>
            </div>
          )}
        </div>
        <div className="md:col-span-2">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/60">
            Kategori
          </label>
          <CategoryFilterDropdown
            ref={categoryDropdownRef}
            categories={categories}
            selected={filter.categories}
            onChange={handleCategoryChange}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-white/60">Jenis</label>
          <select
            value={filter.type}
            onChange={(event) => onFilterChange({ type: event.target.value })}
            className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
          >
            <option value="all">Semua</option>
            <option value="expense">Pengeluaran</option>
            <option value="income">Pemasukan</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-white/60">Urutkan</label>
          <select
            value={filter.sort}
            onChange={(event) => onFilterChange({ sort: event.target.value })}
            className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-white/60">Cari</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              ref={searchInputRef}
              type="search"
              value={searchTerm}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Cari judul, catatan, nominal"
              className="w-full rounded-xl border border-white/10 bg-white/10 pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/40 focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
            />
          </div>
          <p className="text-xs text-white/40">Gunakan Ctrl/Cmd + / untuk fokus cepat.</p>
        </div>
      </div>
    </div>
  );
}

function ActiveFilterChips({ chips, onRemove, onOpenCategory }) {
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-2 border-t border-white/10 bg-white/5 px-4 py-3">
      {chips.map((chip) => {
        if (chip.action === "open-category") {
          return (
            <button
              key={chip.key}
              type="button"
              onClick={onOpenCategory}
              className="inline-flex items-center gap-2 rounded-full border border-dashed border-white/20 bg-transparent px-3 py-1 text-xs font-medium text-white/80 transition hover:border-white/40 hover:text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
            >
              <span>{chip.label} lagi</span>
            </button>
          );
        }
        if (chip.removable === false) {
          return (
            <span
              key={chip.key}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white/80"
            >
              {chip.color && (
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: chip.color }}
                  aria-hidden
                />
              )}
              <span>{chip.label}</span>
            </span>
          );
        }
        return (
          <button
            key={chip.key}
            type="button"
            onClick={() => onRemove(chip)}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
          >
            {chip.color && (
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: chip.color }}
                aria-hidden
              />
            )}
            <span>{chip.label}</span>
            <X className="h-3.5 w-3.5" />
          </button>
        );
      })}
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
  sort,
}) {
  const initialWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
  const [isMobile, setIsMobile] = useState(initialWidth < 640);
  const [hiddenColumns, setHiddenColumns] = useState(initialWidth < 1024 ? ["account", "tags"] : []);
  const [scrolled, setScrolled] = useState(false);
  const containerRef = useRef(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || typeof ResizeObserver === "undefined") return undefined;
    const applyWidth = (width) => {
      setIsMobile(width < 640);
      const nextHidden = width < 1024 ? ["account", "tags"] : [];
      setHiddenColumns((prev) => {
        if (prev.length === nextHidden.length && prev.every((value, index) => value === nextHidden[index])) {
          return prev;
        }
        return nextHidden;
      });
    };
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = entry.contentRect?.width;
      if (typeof width === "number") {
        applyWidth(width);
      }
    });
    const rect = containerRef.current.getBoundingClientRect();
    if (rect?.width) {
      applyWidth(rect.width);
    }
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const visibleColumns = useMemo(
    () => COLUMN_DEFS.filter((column) => !hiddenColumns.includes(column.key)),
    [hiddenColumns],
  );
  const columnTemplate = useMemo(() => buildColumnTemplate(visibleColumns), [visibleColumns]);
  const isFetchingMore = loading && items.length > 0;
  const start = items.length > 0 ? 1 : 0;
  const end = items.length;

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => bodyRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

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

  const tableStyle = { "--transactions-columns": columnTemplate };

  const renderHeaderCell = (column) => {
    if (column.key === "select") {
      return (
        <div
          key={column.key}
          className="transactions-header-cell"
          role="columnheader"
          data-column={column.key}
          data-align={column.align || "start"}
        >
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onToggleSelectAll}
            className="h-4 w-4 rounded border-white/30 bg-transparent text-brand focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
            aria-label="Pilih semua"
          />
        </div>
      );
    }
    const ariaSort = (() => {
      if (column.key === "date" && sort?.startsWith("date-")) {
        return sort.endsWith("asc") ? "ascending" : "descending";
      }
      if (column.key === "amount" && sort?.startsWith("amount-")) {
        return sort.endsWith("asc") ? "ascending" : "descending";
      }
      return undefined;
    })();
    return (
      <div
        key={column.key}
        className="transactions-header-cell"
        role="columnheader"
        data-column={column.key}
        data-align={column.align || "start"}
        aria-sort={ariaSort}
      >
        {column.header}
      </div>
    );
  };

  const tableContent = (
    <div
      ref={containerRef}
      className="transactions-table"
      role="table"
      aria-label="Daftar transaksi"
      data-scrolled={scrolled}
      style={tableStyle}
    >
      <div
        className="transactions-table__header"
        role="rowgroup"
        style={{ top: tableStickyTop }}
      >
        <div className="transactions-header-row" role="row">
          {visibleColumns.map((column) => renderHeaderCell(column))}
        </div>
      </div>
      <div
        ref={bodyRef}
        className="transactions-table__body"
        role="rowgroup"
        onScroll={(event) => {
          setScrolled(event.currentTarget.scrollTop > 0);
        }}
      >
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const item = items[virtualRow.index];
            if (!item) return null;
            return (
              <TransactionRow
                key={item.id}
                item={item}
                isSelected={selectedIds.has(item.id)}
                onToggleSelect={() => onToggleSelect(item.id)}
                onUpdate={onUpdate}
                onDelete={() => onDelete(item.id)}
                categoriesByType={categoriesByType}
                visibleColumns={visibleColumns}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  transform: `translateY(${virtualRow.start}px)`,
                  height: `${virtualRow.size}px`,
                }}
                index={virtualRow.index}
                isMobile={false}
              />
            );
          })}
        </div>
        {loading && items.length === 0 && (
          <div className="px-4 py-6 text-center text-white/60">Memuat transaksi...</div>
        )}
        {loading && items.length > 0 && (
          <div className="px-4 py-4 text-center text-xs text-white/50">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Memuat data terbaru
          </div>
        )}
      </div>
    </div>
  );

  const mobileContent = (
    <div ref={containerRef} className="transactions-mobile" role="group" aria-label="Daftar transaksi">
      <div className="transactions-mobile__select-all">
        <label className="flex items-center gap-2 text-xs text-white/70">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onToggleSelectAll}
            className="h-4 w-4 rounded border-white/30 bg-transparent text-brand focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
          />
          Pilih semua
        </label>
      </div>
      <div className="transactions-mobile__list">
        {items.map((item, index) => (
          <TransactionRow
            key={item.id}
            item={item}
            isSelected={selectedIds.has(item.id)}
            onToggleSelect={() => onToggleSelect(item.id)}
            onUpdate={onUpdate}
            onDelete={() => onDelete(item.id)}
            categoriesByType={categoriesByType}
            visibleColumns={COLUMN_DEFS}
            index={index}
            isMobile
          />
        ))}
        {loading && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-sm text-white/60">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Memuat transaksi...
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {isMobile ? mobileContent : tableContent}
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

function TransactionRow({
  item,
  isSelected,
  onToggleSelect,
  onUpdate,
  onDelete,
  categoriesByType,
  visibleColumns,
  style,
  index = 0,
  isMobile = false,
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [inlineError, setInlineError] = useState("");
  const noteRef = useRef(null);
  const amountRef = useRef(null);
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
    setInlineError("");
  }, [item]);

  useEffect(() => {
    if (editing && noteRef.current) {
      noteRef.current.focus();
    }
  }, [editing]);

  const categoryOptions = useMemo(() => {
    const list = categoriesByType[item.type] || [];
    return list.length ? list : categoriesByType.expense || [];
  }, [categoriesByType, item.type]);

  const amountNumber = Number(
    draft.amount
      .toString()
      .replace(/[^0-9.,-]/g, "")
      .replace(/,/g, "."),
  );

  const hasAttachments =
    Boolean(item.receipt_url) || (Array.isArray(item.receipts) && item.receipts.length > 0);

  const resetDraft = () => {
    setDraft({
      date: toDateInput(item.date),
      category_id: item.category_id || "",
      notes: item.notes ?? item.note ?? "",
      amount: String(item.amount ?? 0),
    });
    setInlineError("");
  };

  const handleSave = async () => {
    if (!draft.category_id) {
      setInlineError("Kategori wajib dipilih");
      return;
    }
    if (!draft.date) {
      setInlineError("Tanggal tidak valid");
      return;
    }
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setInlineError("Nominal harus lebih besar dari 0");
      return;
    }
    setInlineError("");
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
      setInlineError(err?.message || "Gagal menyimpan perubahan");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    resetDraft();
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
    if (event.key.toLowerCase() === "s" && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      handleSave();
    }
  };

  const handleAmountChange = (event) => {
    const value = event.target.value.replace(/[^0-9.,-]/g, "");
    setDraft((prev) => ({ ...prev, amount: value }));
  };

  const handleConfirmDelete = async () => {
    try {
      await onDelete();
    } catch (err) {
      console.error(err);
      setInlineError(err?.message || "Gagal menghapus transaksi");
    } finally {
      setConfirmOpen(false);
    }
  };

  const categoryDisplay = (
    <div className="flex flex-col gap-0.5">
      <span className="font-medium text-white">
        {item.category || categoryOptions.find((option) => option.id === draft.category_id)?.name ||
          "(Tanpa kategori)"}
      </span>
      <span className="text-xs text-white/45">{TYPE_LABELS[item.type] || ""}</span>
    </div>
  );
  const categoryEditor = (
    <InlineCategoryPicker
      options={categoryOptions}
      value={draft.category_id}
      onChange={(next) => setDraft((prev) => ({ ...prev, category_id: next }))}
    />
  );
  const categoryContent = editing ? categoryEditor : categoryDisplay;

  const dateDisplay = <span className="whitespace-nowrap">{toDateInput(item.date)}</span>;
  const dateEditor = (
    <input
      type="date"
      value={draft.date}
      onChange={(event) => setDraft((prev) => ({ ...prev, date: event.target.value }))}
      onKeyDown={handleKeyDown}
      className="transactions-input w-[140px]"
    />
  );
  const dateContent = editing ? dateEditor : dateDisplay;

  const notesDisplay = (
    <span className="truncate text-white/70" title={item.notes ?? item.note ?? "-"}>
      {item.notes ?? item.note ?? "-"}
    </span>
  );
  const notesEditor = (
    <input
      ref={noteRef}
      type="text"
      value={draft.notes}
      onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
      onKeyDown={handleKeyDown}
      className="transactions-input w-full"
      placeholder="Catatan"
    />
  );
  const notesContent = editing ? notesEditor : notesDisplay;

  const accountContent = <span className="text-white/70">{item.account || "-"}</span>;

  const tagsContent =
    Array.isArray(item.tags) && item.tags.length > 0 ? (
      <div className="flex flex-wrap gap-1">
        {item.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">
            {tag}
          </span>
        ))}
      </div>
    ) : (
      <span className="text-white/60">-</span>
    );

  const amountDisplay = (
    <span
      className={clsx(
        "tabular-nums",
        item.type === "income" ? "text-emerald-400" : "text-rose-400",
      )}
    >
      {formatIDR(item.amount)}
    </span>
  );
  const amountEditor = (
    <div className="relative w-[120px]">
      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-white/50">
        Rp
      </span>
      <input
        ref={amountRef}
        type="text"
        inputMode="decimal"
        value={draft.amount}
        onChange={handleAmountChange}
        onKeyDown={handleKeyDown}
        className="transactions-input w-full pl-6 text-right"
      />
    </div>
  );
  const amountContent = editing ? amountEditor : amountDisplay;

  const attachmentsView =
    hasAttachments && item.receipt_url ? (
      <a
        href={item.receipt_url}
        target="_blank"
        rel="noreferrer"
        className="transactions-action-button"
        aria-label="Lihat lampiran"
      >
        <Paperclip className="h-4 w-4" />
      </a>
    ) : null;

  const actionContent = (
    <div className="flex items-center gap-2">
      {attachmentsView}
      {editing ? (
        <>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="transactions-action-button transactions-action-button--primary"
            aria-label="Simpan perubahan"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="transactions-action-button"
            aria-label="Batalkan edit"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => {
              setInlineError("");
              setEditing(true);
            }}
            className="transactions-action-button"
            aria-label="Edit cepat"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="transactions-action-button transactions-action-button--danger"
            aria-label="Hapus transaksi"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );

  const selectInput = (
    <input
      type="checkbox"
      checked={isSelected}
      onChange={onToggleSelect}
      className="h-4 w-4 rounded border-white/30 bg-transparent text-brand focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
      aria-label="Pilih baris"
    />
  );

  const rowStyle = style ? { ...style } : undefined;

  const desktopRow = (
    <div
      className={clsx(
        "transactions-row",
        index % 2 === 1 && "transactions-row--zebra",
        editing && "transactions-row--editing",
      )}
      role="row"
      style={rowStyle}
      data-row-state={isSelected ? "selected" : undefined}
    >
      {visibleColumns.map((column) => {
        if (column.key === "select") {
          return (
            <div
              key={column.key}
              className="transactions-cell transactions-cell--select"
              role="cell"
              data-column={column.key}
            >
              {selectInput}
            </div>
          );
        }
        if (column.key === "category") {
          return (
            <div key={column.key} className="transactions-cell" role="cell" data-column={column.key}>
              {categoryContent}
            </div>
          );
        }
        if (column.key === "date") {
          return (
            <div key={column.key} className="transactions-cell" role="cell" data-column={column.key}>
              {dateContent}
            </div>
          );
        }
        if (column.key === "notes") {
          return (
            <div key={column.key} className="transactions-cell" role="cell" data-column={column.key}>
              {notesContent}
            </div>
          );
        }
        if (column.key === "account") {
          return (
            <div key={column.key} className="transactions-cell" role="cell" data-column={column.key}>
              {accountContent}
            </div>
          );
        }
        if (column.key === "tags") {
          return (
            <div key={column.key} className="transactions-cell" role="cell" data-column={column.key}>
              {tagsContent}
            </div>
          );
        }
        if (column.key === "amount") {
          return (
            <div
              key={column.key}
              className="transactions-cell transactions-cell--amount"
              role="cell"
              data-column={column.key}
            >
              {amountContent}
            </div>
          );
        }
        if (column.key === "actions") {
          return (
            <div
              key={column.key}
              className="transactions-cell transactions-cell--actions"
              role="cell"
              data-column={column.key}
            >
              {actionContent}
            </div>
          );
        }
        return null;
      })}
      {inlineError && <div className="transactions-row__error">{inlineError}</div>}
    </div>
  );

  const mobileRow = (
    <div
      className={clsx(
        "transactions-card",
        index % 2 === 1 && "transactions-card--zebra",
        editing && "transactions-card--editing",
        isSelected && "transactions-card--selected",
      )}
      data-row-state={isSelected ? "selected" : undefined}
    >
      <div className="transactions-card__header">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="h-4 w-4 rounded border-white/30 bg-transparent text-brand focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
            aria-label="Pilih baris"
          />
          {!editing && <span className="text-xs text-white/50">{toDateInput(item.date)}</span>}
        </div>
        <div className="transactions-card__amount">
          {editing ? amountEditor : amountDisplay}
        </div>
      </div>
      <div className="transactions-card__body">
        <div className="transactions-card__row">
          <span className="transactions-card__label">Tanggal</span>
          <div className="transactions-card__value">{editing ? dateEditor : dateDisplay}</div>
        </div>
        <div className="transactions-card__row">
          <span className="transactions-card__label">Kategori</span>
          <div className="transactions-card__value">{categoryContent}</div>
        </div>
        <div className="transactions-card__row">
          <span className="transactions-card__label">Catatan</span>
          <div className="transactions-card__value">{notesContent}</div>
        </div>
        <div className="transactions-card__row">
          <span className="transactions-card__label">Akun</span>
          <div className="transactions-card__value">{accountContent}</div>
        </div>
        <div className="transactions-card__row">
          <span className="transactions-card__label">Tags</span>
          <div className="transactions-card__value">{tagsContent}</div>
        </div>
      </div>
      <div className="transactions-card__actions">{actionContent}</div>
      {inlineError && <div className="transactions-card__error">{inlineError}</div>}
    </div>
  );

  return (
    <>
      {isMobile ? mobileRow : desktopRow}
      <ConfirmDialog
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        message="Hapus transaksi ini?"
      />
    </>
  );
}

function InlineCategoryPicker({ options = [], value, onChange }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const { refs, floatingStyles } = useFloating({
    placement: "bottom-start",
    open,
    onOpenChange: setOpen,
    middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  useEffect(() => {
    refs.setReference(buttonRef.current);
  }, [refs]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (buttonRef.current?.contains(event.target)) return;
      if (refs.floating.current?.contains(event.target)) return;
      setOpen(false);
    };
    const handleKey = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, refs.floating]);

  const selected = options.find((option) => option.id === value);

  return (
    <>
      <button
        ref={(node) => {
          buttonRef.current = node;
          refs.setReference(node);
        }}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="transactions-inline-picker"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected?.name || "Pilih kategori"}
      </button>
      {open &&
        createPortal(
          <div
            ref={refs.setFloating}
            style={{ ...floatingStyles, zIndex: 1400 }}
            className="transactions-inline-picker__panel"
            role="listbox"
          >
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
                className={clsx(
                  "transactions-inline-picker__option",
                  option.id === value && "transactions-inline-picker__option--active",
                )}
                role="option"
                aria-selected={option.id === value}
              >
                {option.name}
              </button>
            ))}
            {!options.length && (
              <div className="px-3 py-2 text-sm text-white/60">Tidak ada kategori</div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

function ConfirmDialog({ open, onCancel, onConfirm, message }) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div className="transactions-confirm fixed inset-0 z-[1600] flex items-center justify-center bg-black/60 p-4">
      <div className="transactions-confirm__panel">
        <p className="transactions-confirm__message">{message}</p>
        <div className="transactions-confirm__actions">
          <button type="button" onClick={onCancel} className="transactions-dialog-button">
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="transactions-dialog-button transactions-dialog-button--danger"
          >
            Hapus
          </button>
        </div>
      </div>
    </div>,
    document.body,
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
