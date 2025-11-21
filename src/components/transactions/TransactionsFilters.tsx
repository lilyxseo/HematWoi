import { createPortal } from "react-dom";
import {
  ChangeEvent,
  MutableRefObject,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import clsx from "clsx";
import { Calendar, ChevronDown, Search } from "lucide-react";
import CategoryDot from "./CategoryDot";

const TYPE_LABELS: Record<string, string> = {
  income: "Pemasukan",
  expense: "Pengeluaran",
  transfer: "Transfer",
};

const SORT_OPTIONS: Record<string, string> = {
  "date-desc": "Terbaru",
  "date-asc": "Terlama",
  "amount-desc": "Nominal Tertinggi",
  "amount-asc": "Nominal Terendah",
};

const PRESET_OPTIONS: Record<string, string> = {
  all: "Semua waktu",
  month: "Bulan ini",
  week: "Minggu ini",
  custom: "Rentang tanggal",
};

function currentMonthValue() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

type DateInputElement = HTMLInputElement & {
  showPicker?: () => void;
};

function toDateInput(value?: string | null) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

interface TransactionsFiltersProps {
  filter: any;
  categories: Array<any>;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onFilterChange: (next: any) => void;
  searchInputRef?: MutableRefObject<{ focus: () => void } | null> | null;
  onClear: () => void;
  sort: string;
  onSortChange: (value: string) => void;
}

export default function TransactionsFilters({
  filter,
  categories,
  searchTerm,
  onSearchChange,
  onFilterChange,
  searchInputRef,
  onClear,
  sort,
  onSortChange,
}: TransactionsFiltersProps) {
  const searchId = useId();
  const typeId = useId();
  const sortId = useId();
  const rangeId = useId();
  const startId = useId();
  const endId = useId();
  const internalSearchRef = useRef<HTMLInputElement | null>(null);
  const startInputRef = useRef<HTMLInputElement | null>(null);
  const endInputRef = useRef<HTMLInputElement | null>(null);
  const [supportsDesktopPicker, setSupportsDesktopPicker] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      setSupportsDesktopPicker(false);
      return;
    }
    const media = window.matchMedia("(pointer: fine)");
    setSupportsDesktopPicker(media.matches);
    const handleChange = (event: MediaQueryListEvent) => {
      setSupportsDesktopPicker(event.matches);
    };
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  const openNativePicker = useCallback((input: HTMLInputElement | null) => {
    if (!supportsDesktopPicker) return;
    if (!input) return;
    if (typeof window === "undefined") return;
    input.focus();
    window.requestAnimationFrame(() => {
      try {
        (input as DateInputElement).showPicker?.();
      } catch {
        /* native picker not available */
      }
    });
  }, [supportsDesktopPicker]);

  useEffect(() => {
    if (!searchInputRef) return;
    searchInputRef.current = {
      focus: () => {
        internalSearchRef.current?.focus();
        internalSearchRef.current?.select();
      },
    };
  }, [searchInputRef]);

  const handleTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ type: event.target.value });
  };

  const handleSearchInput = (event: ChangeEvent<HTMLInputElement>) => {
    onSearchChange(event.target.value);
  };

  const handlePresetChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (value === "all") {
      onFilterChange({
        period: { preset: "all", month: "", start: "", end: "" },
      });
      return;
    }
    if (value === "month") {
      onFilterChange({
        period: { preset: "month", month: filter.period.month || currentMonthValue(), start: "", end: "" },
      });
      return;
    }
    if (value === "week") {
      onFilterChange({
        period: { preset: "week", month: "", start: "", end: "" },
      });
      return;
    }
    onFilterChange({
      period: {
        preset: "custom",
        month: "",
        start: filter.period.start || new Date().toISOString().slice(0, 10),
        end: filter.period.end || new Date().toISOString().slice(0, 10),
      },
    });
  };

  const handleStartChange = (event: ChangeEvent<HTMLInputElement>) => {
    onFilterChange({
      period: {
        ...filter.period,
        preset: "custom",
        start: event.target.value,
      },
    });
  };

  const handleEndChange = (event: ChangeEvent<HTMLInputElement>) => {
    onFilterChange({
      period: {
        ...filter.period,
        preset: "custom",
        end: event.target.value,
      },
    });
  };

  const presetValue = filter.period?.preset ?? "all";

  return (
    <section
      className="flex flex-col gap-3 rounded-3xl bg-slate-950/70 p-4 text-slate-200 shadow-lg ring-1 ring-slate-800 backdrop-blur"
      role="search"
      aria-label="Filter transaksi"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex min-w-[240px] flex-1 items-center">
          <input
            id={searchId}
            ref={internalSearchRef}
            type="search"
            value={searchTerm}
            onChange={handleSearchInput}
            placeholder="Cari judul atau catatan"
            className="h-11 w-full rounded-2xl bg-slate-900/60 px-4 text-sm text-slate-200 placeholder:text-slate-500 ring-2 ring-slate-800 focus:outline-none focus:ring-[var(--accent)]"
            aria-label="Cari transaksi"
          />
        </div>
        <div className="flex flex-1 gap-3">
          <label className="flex flex-1 items-center">
            <span className="sr-only">Filter tipe transaksi</span>
            <select
              id={typeId}
              value={filter.type}
              onChange={handleTypeChange}
              className="h-11 w-full rounded-2xl bg-slate-900/60 px-4 text-sm font-medium text-slate-200 ring-2 ring-slate-800 focus:outline-none focus:ring-[var(--accent)]"
            >
              <option value="all">Semua tipe</option>
              <option value="income">Pemasukan</option>
              <option value="expense">Pengeluaran</option>
              <option value="transfer">Transfer</option>
            </select>
          </label>
          <CategoryMultiSelect
            categories={categories}
            selected={filter.categories}
            onChange={(next) => onFilterChange({ categories: next })}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex w-full min-w-[160px] flex-1 items-center md:w-auto">
          <span className="sr-only">Preset rentang waktu</span>
          <div className="relative w-full">
            <select
              id={rangeId}
              value={presetValue}
              onChange={handlePresetChange}
              className="select-no-arrow h-11 w-full appearance-none rounded-2xl bg-slate-900/60 px-4 text-sm font-medium text-slate-200 ring-2 ring-slate-800 focus:outline-none focus:ring-[var(--accent)]"
            >
              {Object.entries(PRESET_OPTIONS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          </div>
        </label>
        <div className="flex flex-1 flex-wrap gap-3 md:flex-nowrap">
          <label
            className="flex min-w-[160px] flex-1 items-center gap-2 rounded-2xl bg-slate-900/60 pl-0 pr-0 ring-2 ring-slate-800 focus-within:ring-[var(--accent)]"
            onClick={() => openNativePicker(startInputRef.current)}
          >
            <Calendar className="ml-3 h-4 w-4 flex-shrink-0 text-slate-500" aria-hidden="true" />
            <input
              id={startId}
              ref={startInputRef}
              type="date"
              value={toDateInput(filter.period?.start)}
              onChange={handleStartChange}
              onKeyDown={(event) => {
                if (!supportsDesktopPicker) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openNativePicker(event.currentTarget);
                }
              }}
              className="date-input-no-indicator h-10 flex-1 bg-transparent text-sm text-slate-200 focus:outline-none"
              aria-label="Tanggal mulai"
            />
          </label>
          <label
            className="flex min-w-[160px] flex-1 items-center gap-2 rounded-2xl bg-slate-900/60 pl-0 pr-0 ring-2 ring-slate-800 focus-within:ring-[var(--accent)]"
            onClick={() => openNativePicker(endInputRef.current)}
          >
            <Calendar className="ml-3 h-4 w-4 flex-shrink-0 text-slate-500" aria-hidden="true" />
            <input
              id={endId}
              ref={endInputRef}
              type="date"
              value={toDateInput(filter.period?.end)}
              onChange={handleEndChange}
              onKeyDown={(event) => {
                if (!supportsDesktopPicker) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openNativePicker(event.currentTarget);
                }
              }}
              className="date-input-no-indicator h-10 flex-1 bg-transparent text-sm text-slate-200 focus:outline-none"
              aria-label="Tanggal akhir"
            />
          </label>
        </div>
        <div className="flex flex-1 items-center justify-end gap-3">
          <label className="md:hidden inline-flex min-w-[160px] flex-1 items-center">
            <span className="sr-only">Urutkan transaksi</span>
            <select
              id={sortId}
              value={sort}
              onChange={(event) => onSortChange(event.target.value)}
              className="h-11 w-full rounded-2xl bg-slate-900/60 px-4 text-sm font-medium text-slate-200 ring-2 ring-slate-800 focus:outline-none focus:ring-[var(--accent)]"
            >
              {Object.entries(SORT_OPTIONS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900/60 px-4 text-sm font-semibold text-slate-200 ring-2 ring-slate-800 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Bersihkan
          </button>
        </div>
      </div>
    </section>
  );
}

interface CategoryMultiSelectProps {
  categories: Array<any>;
  selected: Array<string | number>;
  onChange: (next: Array<string | number>) => void;
}

function CategoryMultiSelect({ categories, selected, onChange }: CategoryMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const selectedKeyMap = useMemo(() => {
    const map = new Map<string, string | number>();
    if (!Array.isArray(selected)) {
      return map;
    }
    for (const value of selected) {
      if (value == null) continue;
      const key = String(value);
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, value);
      }
    }
    return map;
  }, [selected]);

  const normalizedSelected = useMemo(
    () => Array.from(selectedKeyMap.keys()),
    [selectedKeyMap],
  );

  const categoryKeyMap = useMemo(() => {
    const map = new Map<string, string | number>();
    const categoryList = Array.isArray(categories) ? categories : [];
    for (const cat of categoryList) {
      const idValue = cat?.id;
      if (idValue == null) continue;
      const key = String(idValue);
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, idValue as string | number);
      }
    }
    return map;
  }, [categories]);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const anchor = triggerRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const width = Math.min(360, Math.max(260, rect.width));
      const left = Math.min(Math.max(16, rect.left), window.innerWidth - width - 16);
      setPosition({ top: rect.bottom + 8, left, width });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, { passive: true });
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!panelRef.current || !triggerRef.current) return;
      if (panelRef.current.contains(event.target as Node)) return;
      if (triggerRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
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
    if (open) setQuery("");
  }, [open]);

  const filteredCategories = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return categories;
    return categories.filter((cat) =>
      [cat.name, TYPE_LABELS[cat.type] ?? ""].some((value) =>
        String(value || "").toLowerCase().includes(term),
      ),
    );
  }, [categories, query]);

  const summaryLabel = useMemo(() => {
    if (!normalizedSelected.length) return "Semua kategori";
    if (normalizedSelected.length === 1) {
      const match = categories.find((cat) => String(cat.id) === normalizedSelected[0]);
      return match?.name || "1 kategori";
    }
    return `${normalizedSelected.length} kategori`;
  }, [categories, normalizedSelected]);

  const toggle = (value: string | number | null | undefined) => {
    if (value == null) return;
    const key = String(value);
    if (!key) return;
    const nextMap = new Map(selectedKeyMap);
    if (nextMap.has(key)) {
      nextMap.delete(key);
    } else {
      if (categoryKeyMap.has(key)) {
        const mapped = categoryKeyMap.get(key);
        if (mapped != null) {
          nextMap.set(key, mapped);
        }
      } else {
        nextMap.set(key, value);
      }
    }
    onChange(Array.from(nextMap.values()));
  };

  const clear = () => {
    onChange([]);
  };

  return (
    <div className="flex flex-1 min-w-[200px]">
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-11 w-full items-center justify-between rounded-2xl bg-slate-900/60 px-4 text-sm font-medium text-slate-200 ring-2 ring-slate-800 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{summaryLabel}</span>
        <ChevronDown className="ml-3 h-4 w-4 text-slate-500" aria-hidden="true" />
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-50" role="presentation">
            <div
              ref={panelRef}
              role="listbox"
              aria-multiselectable="true"
              className="absolute max-h-[360px] w-[min(360px,calc(100%-32px))] overflow-hidden rounded-3xl bg-slate-900/95 text-slate-200 shadow-2xl ring-1 ring-slate-800 backdrop-blur"
              style={{ top: position.top, left: position.left, width: position.width || undefined }}
            >
              <div className="flex items-center justify-between px-4 pb-3 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Kategori</p>
                <button
                  type="button"
                  onClick={clear}
                  className="rounded-full px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  Reset
                </button>
              </div>
              <div className="px-4 pb-3">
                <div className="flex items-center gap-2 rounded-2xl bg-slate-800/80 px-3">
                  <Search className="h-4 w-4 flex-shrink-0 text-slate-500" aria-hidden="true" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Cari kategori"
                    className="h-9 w-full bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="max-h-[240px] overflow-y-auto px-2 pb-4">
                {filteredCategories.length === 0 && (
                  <p className="px-4 py-3 text-sm text-slate-400">Kategori tidak ditemukan</p>
                )}
                {filteredCategories.map((cat) => {
                  const idValue = cat.id != null ? String(cat.id) : "";
                  const checked = idValue ? normalizedSelected.includes(idValue) : false;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggle(cat.id)}
                      className={clsx(
                        "flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm transition",
                        checked ? "bg-[var(--accent)]/15 text-slate-50" : "text-slate-300 hover:bg-slate-800/80",
                      )}
                      role="option"
                      aria-selected={checked}
                    >
                      <span className="flex items-center gap-3">
                        <CategoryDot color={cat.color} />
                        <span className="font-medium">{cat.name || "(Tanpa kategori)"}</span>
                      </span>
                      {checked && <span className="text-xs uppercase text-[var(--accent)]">Dipilih</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
