import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getTransactionsSummary, listCategories } from "../lib/api";
import { listTransactions } from "../lib/api-transactions";

const PAGE_SIZE = 50;

const DEFAULT_FILTER = {
  period: { preset: "all", month: "", start: "", end: "" },
  categories: [],
  type: "all",
  sort: "date-desc",
  search: "",
};

function parseSearchParams(params) {
  const preset = params.get("range") || "all";
  const month = params.get("month") || "";
  const start = params.get("start") || "";
  const end = params.get("end") || "";
  const type = params.get("type") || "all";
  const sort = params.get("sort") || "date-desc";
  const search = params.get("search") || "";
  const categoriesParam = params.get("categories");
  const categories = categoriesParam
    ? categoriesParam
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
    : [];
  const pageValue = Number.parseInt(params.get("page") || "1", 10);
  const page = Number.isNaN(pageValue) || pageValue < 1 ? 1 : pageValue;
  return {
    filter: {
      period: { preset, month, start, end },
      categories,
      type,
      sort,
      search,
    },
    page,
  };
}

function serializeFilter(params, filter, page) {
  const next = new URLSearchParams(params);
  const { period } = filter;

  const apply = (key, value, defaultValue = "") => {
    if (value == null || value === "" || value === defaultValue) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  };

  apply("range", period.preset, DEFAULT_FILTER.period.preset);
  if (period.preset === "month") {
    apply("month", period.month, "");
    next.delete("start");
    next.delete("end");
  } else if (period.preset === "custom") {
    apply("start", period.start, "");
    apply("end", period.end, "");
    next.delete("month");
  } else {
    next.delete("month");
    next.delete("start");
    next.delete("end");
  }

  apply("type", filter.type, DEFAULT_FILTER.type);
  apply("sort", filter.sort, DEFAULT_FILTER.sort);
  apply("search", filter.search.trim(), DEFAULT_FILTER.search);

  if (Array.isArray(filter.categories) && filter.categories.length) {
    next.set("categories", filter.categories.join(","));
  } else {
    next.delete("categories");
  }

  if (page > 1) {
    next.set("page", String(page));
  } else {
    next.delete("page");
  }

  return next;
}

function toRequestFilter(filter, page) {
  return {
    type: filter.type,
    categories: filter.categories,
    sort: filter.sort,
    search: filter.search,
    period: {
      preset: filter.period.preset,
      month: filter.period.month,
      start: filter.period.start,
      end: filter.period.end,
    },
    page,
    pageSize: PAGE_SIZE,
  };
}

export default function useTransactionsQuery() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { filter, page } = useMemo(
    () => parseSearchParams(searchParams),
    [searchParams],
  );
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState({ income: 0, expense: 0, net: 0 });
  const [categories, setCategories] = useState([]);
  const [refreshToken, setRefreshToken] = useState(0);
  const cacheRef = useRef(new Map());
  const summaryCacheRef = useRef(new Map());

  const filterKey = useMemo(
    () => JSON.stringify({ ...filter, page: 0 }),
    [filter],
  );

  useEffect(() => {
    let ignore = false;
    listCategories()
      .then((rows) => {
        if (!ignore) setCategories(rows || []);
      })
      .catch((err) => {
        console.error("Failed to fetch categories", err);
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const request = toRequestFilter(filter, page);
    const cacheKey = filterKey;
    const existingEntry = cacheRef.current.get(cacheKey);

    const hasFullCache = Boolean(
      existingEntry &&
        Array.from({ length: page }, (_, index) => existingEntry.pages?.has(index + 1)).every(Boolean),
    );

    if (hasFullCache) {
      const aggregated = [];
      for (let index = 1; index <= page; index += 1) {
        const pageRows = existingEntry.pages.get(index);
        if (!pageRows) break;
        aggregated.push(...pageRows);
      }
      setItems(aggregated);
      if (typeof existingEntry.total === "number") {
        setTotal(existingEntry.total);
      }
      setLoading(false);
    } else {
      if (existingEntry) {
        const aggregated = [];
        for (let index = 1; index < page; index += 1) {
          const pageRows = existingEntry.pages.get(index);
          if (!pageRows) break;
          aggregated.push(...pageRows);
        }
        setItems(aggregated);
        if (typeof existingEntry.total === "number") {
          setTotal(existingEntry.total);
        }
      } else {
        setItems([]);
        setTotal(0);
      }
      setLoading(true);
    }

    setError(null);

    listTransactions(request)
      .then(({ rows, total }) => {
        if (cancelled) return;
        const normalizedRows = Array.isArray(rows) ? rows : [];
        const normalizedTotal =
          typeof total === "number" && Number.isFinite(total)
            ? total
            : existingEntry?.total ?? normalizedRows.length + (page - 1) * PAGE_SIZE;

        const previousEntry = cacheRef.current.get(cacheKey);
        const nextPages = previousEntry ? new Map(previousEntry.pages) : new Map();
        nextPages.set(page, normalizedRows);

        cacheRef.current.set(cacheKey, {
          total: normalizedTotal,
          pages: nextPages,
          timestamp: Date.now(),
        });

        const aggregated = [];
        for (let index = 1; index <= page; index += 1) {
          const pageRows = nextPages.get(index);
          if (!pageRows) break;
          aggregated.push(...pageRows);
        }

        setTotal(normalizedTotal);
        setItems(aggregated);
        setLoading(false);

        if (normalizedTotal > page * PAGE_SIZE) {
          const nextPage = page + 1;
          if (!nextPages.has(nextPage)) {
            const nextRequest = toRequestFilter(filter, nextPage);
            listTransactions(nextRequest)
              .then((result) => {
                if (cancelled) return;
                const currentEntry = cacheRef.current.get(cacheKey);
                if (!currentEntry || currentEntry.pages.has(nextPage)) {
                  return;
                }
                const nextRows = Array.isArray(result?.rows) ? result.rows : [];
                const updatedPages = new Map(currentEntry.pages);
                updatedPages.set(nextPage, nextRows);
                cacheRef.current.set(cacheKey, {
                  total:
                    typeof result?.total === "number" && Number.isFinite(result.total)
                      ? result.total
                      : currentEntry.total,
                  pages: updatedPages,
                  timestamp: Date.now(),
                });
              })
              .catch((prefetchError) => {
                if (!cancelled) {
                  console.error("Failed to prefetch transactions page", prefetchError);
                }
              });
          }
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filter, filterKey, page, refreshToken]);

  useEffect(() => {
    let cancelled = false;
    const request = toRequestFilter(filter, 1);
    const summaryKey = JSON.stringify(request);
    const cachedSummary = summaryCacheRef.current.get(summaryKey);
    if (cachedSummary) {
      setSummary(cachedSummary);
    }
    getTransactionsSummary(request)
      .then((value) => {
        if (cancelled) return;
        const normalizedSummary =
          value && typeof value === "object"
            ? {
                income: Number.isFinite(value.income)
                  ? value.income
                  : Number.isFinite(Number(value.income))
                    ? Number(value.income)
                    : 0,
                expense: Number.isFinite(value.expense)
                  ? value.expense
                  : Number.isFinite(Number(value.expense))
                    ? Number(value.expense)
                    : 0,
                net: Number.isFinite(value.net)
                  ? value.net
                  : Number.isFinite(Number(value.net))
                    ? Number(value.net)
                    : 0,
              }
            : { income: 0, expense: 0, net: 0 };
        setSummary(normalizedSummary);
        summaryCacheRef.current.set(summaryKey, normalizedSummary);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to fetch summary", err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [filter, filterKey, refreshToken]);

  const updateParams = useCallback(
    (nextFilter, nextPage = 1) => {
      const merged = {
        ...filter,
        ...nextFilter,
        period: {
          ...filter.period,
          ...(nextFilter?.period || {}),
        },
      };
      const params = serializeFilter(searchParams, merged, nextPage);
      setSearchParams(params, { replace: true });
    },
    [filter, searchParams, setSearchParams],
  );

  const setFilter = useCallback(
    (patch) => {
      updateParams(patch, 1);
    },
    [updateParams],
  );

  const goToPage = useCallback(
    (nextPage) => {
      const value = Number.isFinite(nextPage) ? nextPage : page;
      const safePage = value > 0 ? Math.floor(value) : 1;
      updateParams({}, safePage);
    },
    [page, updateParams],
  );

  const loadMore = useCallback(() => {
    goToPage(page + 1);
  }, [goToPage, page]);

  const refresh = useCallback(
    ({ keepPage = false } = {}) => {
      cacheRef.current.delete(filterKey);
      const summaryKey = JSON.stringify(toRequestFilter(filter, 1));
      summaryCacheRef.current.delete(summaryKey);
      setRefreshToken((token) => token + 1);
      if (keepPage) {
        updateParams({}, page);
      } else {
        updateParams({}, 1);
      }
    },
    [filter, filterKey, page, updateParams],
  );

  const hasMore = items.length < total;

  return {
    items,
    total,
    page,
    hasMore,
    loading,
    error,
    filter,
    setFilter,
    loadMore,
    goToPage,
    refresh,
    categories,
    summary,
    pageSize: PAGE_SIZE,
  };
}
