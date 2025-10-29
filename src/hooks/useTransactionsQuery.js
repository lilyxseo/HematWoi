import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getTransactionsSummary, listCategories } from "../lib/api";
import { getCachedTransactions, listTransactions } from "../lib/api-transactions";

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
  const preserveItemsRef = useRef(false);

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
    setLoading(true);
    setError(null);
    const preserveItems = preserveItemsRef.current;
    preserveItemsRef.current = false;

    if (page === 1 && !preserveItems) {
      setItems([]);
    }

    (async () => {
      try {
        const cached = await getCachedTransactions(request);
        if (cancelled) return;
        const cachedRows = Array.isArray(cached?.rows) ? cached.rows : [];
        if (typeof cached?.total === "number") {
          setTotal(cached.total);
        }
        if (cachedRows.length || page === 1) {
          setItems((prev) => {
            if (page === 1) {
              return cachedRows;
            }
            const existing = prev.slice(0, (page - 1) * PAGE_SIZE);
            return [...existing, ...cachedRows];
          });
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load cached transactions", err);
        }
      }
    })();

    listTransactions(request)
      .then(({ rows, total }) => {
        if (cancelled) return;
        setTotal(total || 0);
        setItems((prev) => {
          if (page === 1) return rows;
          const existing = prev.slice(0, (page - 1) * PAGE_SIZE);
          return [...existing, ...(rows || [])];
        });
        setLoading(false);
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
    getTransactionsSummary(toRequestFilter(filter, 1))
      .then((value) => {
        if (!cancelled) setSummary(value);
      })
      .catch((err) => console.error("Failed to fetch summary", err));
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
      preserveItemsRef.current = keepPage;
      setRefreshToken((token) => token + 1);
      if (keepPage) {
        updateParams({}, page);
      } else {
        updateParams({}, 1);
      }
    },
    [page, updateParams],
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
