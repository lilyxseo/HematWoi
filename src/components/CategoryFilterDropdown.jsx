import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { autoUpdate, flip, offset, shift, size, useFloating } from "@floating-ui/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import clsx from "clsx";
import { Check, Search, X } from "lucide-react";

const FAVORITES_KEY = "hematwoi:category-favorites";
const MAX_PANEL_HEIGHT = 420;
const PANEL_OFFSET = 10;
const ESTIMATED_ROW_HEIGHT = 48;
const MAX_FAVORITES = 12;

function useDebouncedValue(value, delay = 200) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(handle);
  }, [value, delay]);
  return debounced;
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mql = window.matchMedia(query);
    const listener = (event) => setMatches(event.matches);
    listener(mql);
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id) => typeof id === "string");
  } catch (error) {
    console.error("Failed to read favorites", error);
    return [];
  }
}

function persistFavorites(ids) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids.slice(0, MAX_FAVORITES)));
  } catch (error) {
    console.error("Failed to write favorites", error);
  }
}

function reorderCategories(categories, favorites, selectedIds) {
  const priority = new Map();
  favorites.forEach((id, index) => {
    priority.set(id, favorites.length - index);
  });
  selectedIds.forEach((id) => {
    priority.set(id, (priority.get(id) || 0) + 1000);
  });
  const collator = new Intl.Collator("id-ID", { sensitivity: "base" });
  return [...categories].sort((a, b) => {
    const weightA = priority.get(a.id) || 0;
    const weightB = priority.get(b.id) || 0;
    if (weightA !== weightB) return weightB - weightA;
    return collator.compare(a.name, b.name);
  });
}

const CategoryFilterDropdown = forwardRef(function CategoryFilterDropdown(
  { categories = [], selected = [], onChange },
  ref,
) {
  const triggerRef = useRef(null);
  const floatingRef = useRef(null);
  const listRef = useRef(null);
  const sheetListRef = useRef(null);
  const sheetContainerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [favorites, setFavorites] = useState(() => loadFavorites());
  const listboxId = useId();
  const debouncedSearch = useDebouncedValue(search, 180);
  const isSheet = useMediaQuery("(max-width: 480px)");
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const { refs, floatingStyles, update } = useFloating({
    placement: "bottom-start",
    open,
    onOpenChange: setOpen,
    middleware: [
      offset(PANEL_OFFSET),
      flip({ padding: 12 }),
      shift({ padding: 12 }),
      size({
        apply({ rects, availableHeight, elements }) {
          if (!elements.floating) return;
          const minWidth = rects.reference.width;
          Object.assign(elements.floating.style, {
            minWidth: `${minWidth}px`,
            maxHeight: `${Math.min(availableHeight, MAX_PANEL_HEIGHT)}px`,
          });
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  useEffect(() => {
    refs.setReference(triggerRef.current);
    refs.setFloating(floatingRef.current);
  }, [refs]);

  useImperativeHandle(
    ref,
    () => ({
      open: () => setOpen(true),
      close: () => setOpen(false),
      focus: () => triggerRef.current?.focus(),
    }),
    [],
  );

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      const target = event.target;
      if (triggerRef.current?.contains(target)) return;
      const floatingEl = floatingRef.current;
      const sheetEl = sheetContainerRef.current;
      if (floatingEl?.contains(target) || sheetEl?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const originalOverflow = document.body.style.overflow;
    if (isSheet) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open, isSheet]);

  const sortedCategories = useMemo(
    () => reorderCategories(categories, favorites, selected),
    [categories, favorites, selected],
  );

  const filteredCategories = useMemo(() => {
    if (!debouncedSearch.trim()) return sortedCategories;
    const lower = debouncedSearch.trim().toLowerCase();
    return sortedCategories.filter((category) =>
      category.name.toLowerCase().includes(lower) || category?.group?.toLowerCase?.().includes(lower),
    );
  }, [debouncedSearch, sortedCategories]);

  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => {
      update?.();
      const preferredIndex = filteredCategories.findIndex((cat) => selectedSet.has(cat.id));
      setActiveIndex(preferredIndex >= 0 ? preferredIndex : 0);
      const searchInput = floatingRef.current?.querySelector("input[type='search']");
      if (!isSheet && searchInput instanceof HTMLInputElement) {
        searchInput.focus();
        searchInput.select();
      }
    });
  }, [open, filteredCategories, selectedSet, update, isSheet]);

  useEffect(() => {
    if (!open || !isSheet) return;
    const timeout = window.setTimeout(() => {
      const searchInput = sheetContainerRef.current?.querySelector("input[type='search']");
      if (searchInput instanceof HTMLInputElement) {
        searchInput.focus();
        searchInput.select();
      }
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [open, isSheet]);

  useEffect(() => {
    if (!open) {
      triggerRef.current?.focus();
    }
  }, [open]);

  const updateFavorites = useCallback(
    (nextSelected, toggledId) => {
      setFavorites((prev) => {
        const unique = new Set([toggledId, ...nextSelected, ...prev]);
        const ordered = Array.from(unique).filter((id) => categories.some((cat) => cat.id === id));
        persistFavorites(ordered);
        return ordered;
      });
    },
    [categories],
  );

  const handleToggle = useCallback(
    (id) => {
      const next = new Set(selected);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      const values = Array.from(next);
      onChange(values);
      updateFavorites(values, id);
    },
    [selected, onChange, updateFavorites],
  );

  const handleReset = useCallback(() => {
    onChange([]);
    setSearch("");
    setActiveIndex(0);
    setOpen(false);
  }, [onChange]);

  const handleApply = useCallback(() => {
    setOpen(false);
  }, []);

  const virtualizer = useVirtualizer({
    count: filteredCategories.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 8,
  });

  const sheetVirtualizer = useVirtualizer({
    count: filteredCategories.length,
    getScrollElement: () => sheetListRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 8,
  });

  const handleKeyNavigation = useCallback(
    (event) => {
      if (!open) return;
      const activeVirtualizer = isSheet ? sheetVirtualizer : virtualizer;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!filteredCategories.length) return;
        setActiveIndex((prev) => {
          const delta = event.key === "ArrowDown" ? 1 : -1;
          const nextIndex = (prev + delta + filteredCategories.length) % filteredCategories.length;
          activeVirtualizer.scrollToIndex(nextIndex, { align: "auto" });
          return nextIndex;
        });
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const item = filteredCategories[activeIndex];
        if (item) handleToggle(item.id);
      }
    },
    [open, filteredCategories, activeIndex, handleToggle, isSheet, sheetVirtualizer, virtualizer],
  );

  useEffect(() => {
    if (!open) return undefined;
    const target = isSheet ? sheetListRef.current : listRef.current;
    if (!target) return undefined;
    target.addEventListener("keydown", handleKeyNavigation);
    return () => target.removeEventListener("keydown", handleKeyNavigation);
  }, [open, handleKeyNavigation, isSheet]);

  const renderRow = useCallback(
    (virtualRow) => {
      const index = virtualRow.index;
      const item = filteredCategories[index];
      if (!item) return null;
      const checked = selectedSet.has(item.id);
      const isActive = index === activeIndex;
      const optionId = `${listboxId}-${item.id}`;
      return (
        <button
          key={item.id}
          type="button"
          role="option"
          id={optionId}
          aria-selected={checked}
          onClick={() => handleToggle(item.id)}
          onMouseEnter={() => setActiveIndex(index)}
          className={clsx(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition", 
            checked ? "bg-brand/20 text-white" : "text-white/80 hover:bg-white/10", 
            isActive && !checked ? "ring-2 ring-brand/40" : "ring-0",
          )}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: `${virtualRow.size}px`,
            transform: `translateY(${virtualRow.start}px)`,
          }}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
            {item.name.slice(0, 2).toUpperCase()}
          </span>
          <span className="flex-1">
            <span className="block font-medium text-white">{item.name}</span>
            <span className="block text-xs text-white/40">{(item.group || item.type || "").toString()}</span>
          </span>
          {checked && <Check className="h-4 w-4 text-brand" />}
        </button>
      );
    },
    [filteredCategories, selectedSet, activeIndex, handleToggle, listboxId],
  );

  const panelContent = (
    <div
      className="flex flex-col gap-3"
      role="presentation"
      onKeyDown={(event) => {
        if (event.key === "Tab") {
          update?.();
        }
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/60">Semua Kategori</span>
          <span className="text-[11px] text-white/40">{selected.length ? `${selected.length} dipilih` : "Tidak ada filter"}</span>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-full px-3 py-1 text-xs text-white/70 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
        >
          Reset
        </button>
      </div>
      <div className="relative">
        <label htmlFor={`${listboxId}-search`} className="sr-only">
          Cari kategori
        </label>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <input
          id={`${listboxId}-search`}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari kategori"
          className="w-full rounded-xl border border-white/10 bg-white/10 pl-10 pr-3 py-2 text-sm text-white placeholder:text-white/40 focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
        />
      </div>
      <div
        ref={isSheet ? sheetListRef : listRef}
        id={listboxId}
        role="listbox"
        aria-multiselectable="true"
        aria-activedescendant={filteredCategories[activeIndex] ? `${listboxId}-${filteredCategories[activeIndex].id}` : undefined}
        className="relative w-full overflow-y-auto rounded-xl border border-white/10 bg-slate-950/60"
        style={{ maxHeight: `${MAX_PANEL_HEIGHT}px` }}
      >
        <div style={{ height: `${(isSheet ? sheetVirtualizer : virtualizer).getTotalSize()}px`, position: "relative" }}>
          {(isSheet ? sheetVirtualizer : virtualizer).getVirtualItems().map((virtualRow) =>
            renderRow(virtualRow),
          )}
        </div>
        {!filteredCategories.length && (
          <div className="p-6 text-center text-sm text-white/50">Kategori tidak ditemukan</div>
        )}
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
          }}
          className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10 focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
        >
          Tutup
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white shadow focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
        >
          Terapkan
        </button>
      </div>
    </div>
  );

  const dropdownPanel = (
    <div
      ref={floatingRef}
      className="pointer-events-auto z-[1300] w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/95 p-4 text-white shadow-2xl backdrop-blur"
      style={isSheet ? undefined : floatingStyles}
      role="dialog"
      aria-modal={isSheet ? "true" : "false"}
      aria-label="Pemilih kategori"
    >
      {panelContent}
    </div>
  );

  const sheetPanel = (
    <div
      ref={sheetContainerRef}
      data-role="category-sheet"
      className="pointer-events-auto mt-auto w-full rounded-t-3xl border-t border-white/10 bg-slate-950/95 p-5 text-white shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-label="Pemilih kategori"
    >
      <div className="mb-4 flex items-center justify-between">
        <span id={`${listboxId}-label`} className="text-sm font-semibold uppercase tracking-wide text-white/60">
          Pilih kategori
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-white/15 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
          aria-label="Tutup pemilih kategori"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div ref={sheetListRef} tabIndex={-1} className="flex flex-col gap-4">
        {panelContent}
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring focus-visible:ring-brand/60"
      >
        <span>{selected.length ? `${selected.length} dipilih` : "Semua kategori"}</span>
        <span className="text-xs text-white/50">{open ? "Tutup" : "Pilih"}</span>
      </button>
      {open &&
        createPortal(
          <div className="category-dropdown-portal pointer-events-none fixed inset-0 z-[1200] flex items-start justify-start">
            {!isSheet && dropdownPanel}
            {isSheet && (
              <div
                className="pointer-events-auto flex h-full w-full flex-col bg-black/50"
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    setOpen(false);
                  }
                }}
              >
                <div onClick={(event) => event.stopPropagation()}>{sheetPanel}</div>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
});

export default CategoryFilterDropdown;
