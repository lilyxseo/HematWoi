import { useCallback, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Page from "../layout/Page";
import PageHeader from "../layout/PageHeader";
import CalendarGrid from "../components/calendar/CalendarGrid";
import Filters, {
  type CalendarFilterFormState,
} from "../components/calendar/Filters";
import MonthSummary from "../components/calendar/MonthSummary";
import DayDetailModal from "../components/calendar/DayDetailModal";
import useCategories from "../hooks/useCategories";
import useMonthAggregates from "../hooks/useMonthAggregates";
import useDayTransactions from "../hooks/useDayTransactions";
import { supabase } from "../lib/supabase";
import { removeTransaction } from "../lib/api-transactions";
import type { CalendarTransaction } from "../lib/calendarApi";
import { useToast } from "../context/ToastContext";

const MONTH_KEY_PATTERN = /^(\d{4})-(\d{2})$/;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatMonthKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseMonthParam(value: string | null): { year: number; month: number } {
  const now = new Date();
  const fallback = { year: now.getFullYear(), month: now.getMonth() + 1 };
  if (!value) return fallback;
  const match = MONTH_KEY_PATTERN.exec(value);
  if (!match) return fallback;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return fallback;
  }
  return { year, month };
}

function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const [yearStr, monthStr, dayStr] = value.split("-");
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseNumberParam(value: string | null): number | null {
  if (!value) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return numeric;
}

export default function CalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const updateSearchParams = useCallback(
    (
      updater: (params: URLSearchParams) => void,
      options: { replace?: boolean } = {},
    ) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        updater(next);
        return next;
      }, { replace: options.replace ?? true });
    },
    [setSearchParams],
  );

  const monthParam = searchParams.get("month");
  const monthParts = parseMonthParam(monthParam);
  const monthDate = useMemo(
    () => new Date(monthParts.year, monthParts.month - 1, 1),
    [monthParts.month, monthParts.year],
  );
  monthDate.setHours(0, 0, 0, 0);
  const monthKey = formatMonthKey(monthDate);

  useEffect(() => {
    if (monthParam && monthParam !== monthKey) {
      updateSearchParams((params) => {
        params.set("month", monthKey);
      });
    }
  }, [monthParam, monthKey, updateSearchParams]);

  const selectedDateParam = searchParams.get("date");
  const selectedDate = useMemo(
    () => parseDateParam(selectedDateParam),
    [selectedDateParam],
  );

  const typeParam = searchParams.get("type");
  const includeIncome =
    typeParam === "all" ||
    typeParam === "income" ||
    typeParam === "expense+income" ||
    typeParam === "1";

  const categoryFilters = useMemo(() => {
    const unique = new Set<string>();
    const values = searchParams.getAll("category");
    values.forEach((value) => {
      if (value) unique.add(value);
    });
    return Array.from(unique);
  }, [searchParams]);

  const accountFilters = useMemo(() => {
    const unique = new Set<string>();
    const values = searchParams.getAll("account");
    values.forEach((value) => {
      if (value) unique.add(value);
    });
    return Array.from(unique);
  }, [searchParams]);

  const amountMin = parseNumberParam(searchParams.get("min"));
  const amountMax = parseNumberParam(searchParams.get("max"));
  const searchValue = searchParams.get("q") ?? "";

  const filtersState: CalendarFilterFormState = useMemo(
    () => ({
      includeIncome,
      categories: categoryFilters,
      accounts: accountFilters,
      amountMin,
      amountMax,
      search: searchValue,
    }),
    [includeIncome, categoryFilters, accountFilters, amountMin, amountMax, searchValue],
  );

  const normalizedFilters = useMemo(() => {
    return {
      includeIncome: filtersState.includeIncome,
      categories: [...filtersState.categories].filter(Boolean),
      accounts: [...filtersState.accounts].filter(Boolean),
      amountMin: filtersState.amountMin,
      amountMax: filtersState.amountMax,
      search: filtersState.search.trim(),
    };
  }, [filtersState]);

  const calendarFilters = useMemo(
    () => ({
      includeIncome: normalizedFilters.includeIncome,
      categories: [...normalizedFilters.categories].sort(),
      accounts: [...normalizedFilters.accounts].sort(),
      amountMin: normalizedFilters.amountMin,
      amountMax: normalizedFilters.amountMax,
      search: normalizedFilters.search,
    }),
    [normalizedFilters],
  );

  const isDefaultFilters = useMemo(() => {
    return (
      !filtersState.includeIncome &&
      filtersState.categories.length === 0 &&
      filtersState.accounts.length === 0 &&
      filtersState.amountMin === null &&
      filtersState.amountMax === null &&
      filtersState.search.trim() === ""
    );
  }, [filtersState]);

  const { data: categoryData = [], isLoading: categoriesLoading } = useCategories([
    "expense",
    "income",
  ]);

  const categoryOptions = useMemo(
    () =>
      categoryData
        .map((category) => ({
          id: category.id ?? "",
          name: category.name ?? "Tanpa nama",
          type: category.type ?? null,
        }))
        .filter((category) => category.id),
    [categoryData],
  );

  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    categoryOptions.forEach((category) => {
      map[category.id] = category.name;
    });
    return map;
  }, [categoryOptions]);

  const accountsQuery = useQuery({
    queryKey: ["calendar", "accounts"],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) {
        return [] as { id: string; name: string }[];
      }
      const { data, error } = await supabase
        .from("accounts")
        .select("id,name")
        .eq("user_id", userId)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: String(row.id),
        name: row.name ?? "Tanpa nama",
      }));
    },
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  const accountOptions = accountsQuery.data ?? [];

  const accountMap = useMemo(() => {
    const map: Record<string, string> = {};
    accountOptions.forEach((account) => {
      map[account.id] = account.name;
    });
    return map;
  }, [accountOptions]);

  const monthAggregates = useMonthAggregates(monthKey, calendarFilters);

  const selectedDateKey = selectedDate ? formatDateKey(selectedDate) : null;

  const dayTransactionsQuery = useDayTransactions(selectedDateKey, calendarFilters);

  const handleSelectDate = useCallback(
    (date: Date) => {
      const nextMonthKey = formatMonthKey(date);
      const dateKey = formatDateKey(date);
      updateSearchParams((params) => {
        params.set("month", nextMonthKey);
        params.set("date", dateKey);
      }, { replace: false });
    },
    [updateSearchParams],
  );

  const handleNavigateMonth = useCallback(
    (nextMonth: Date) => {
      const nextKey = formatMonthKey(nextMonth);
      updateSearchParams((params) => {
        params.set("month", nextKey);
        const currentDate = params.get("date");
        if (currentDate) {
          const parsed = parseDateParam(currentDate);
          if (
            !parsed ||
            parsed.getFullYear() !== nextMonth.getFullYear() ||
            parsed.getMonth() !== nextMonth.getMonth()
          ) {
            params.delete("date");
          }
        }
      });
    },
    [updateSearchParams],
  );

  const handleJumpToToday = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    updateSearchParams((params) => {
      params.set("month", formatMonthKey(today));
      params.set("date", formatDateKey(today));
    });
  }, [updateSearchParams]);

  const handleFiltersChange = useCallback(
    (next: CalendarFilterFormState) => {
      updateSearchParams((params) => {
        if (next.includeIncome) {
          params.set("type", "all");
        } else {
          params.delete("type");
        }

        params.delete("category");
        next.categories.forEach((categoryId) => {
          if (categoryId) params.append("category", categoryId);
        });

        params.delete("account");
        next.accounts.forEach((accountId) => {
          if (accountId) params.append("account", accountId);
        });

        if (next.amountMin != null) {
          params.set("min", String(next.amountMin));
        } else {
          params.delete("min");
        }

        if (next.amountMax != null) {
          params.set("max", String(next.amountMax));
        } else {
          params.delete("max");
        }

        const search = next.search.trim();
        if (search) {
          params.set("q", search);
        } else {
          params.delete("q");
        }
      });
    },
    [updateSearchParams],
  );

  const handleResetFilters = useCallback(() => {
    updateSearchParams((params) => {
      params.delete("type");
      params.delete("category");
      params.delete("account");
      params.delete("min");
      params.delete("max");
      params.delete("q");
    });
  }, [updateSearchParams]);

  const handleCloseModal = useCallback(() => {
    updateSearchParams((params) => {
      params.delete("date");
    });
  }, [updateSearchParams]);

  const handleEditTransaction = useCallback(
    (transaction: CalendarTransaction) => {
      if (!transaction?.id) return;
      navigate("/transactions", { state: { editTransactionId: transaction.id } });
    },
    [navigate],
  );

  const handleDeleteTransaction = useCallback(
    async (transaction: CalendarTransaction) => {
      if (!transaction?.id) return;
      try {
        await removeTransaction(transaction.id);
        addToast("Transaksi dihapus", "success");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["calendar", "month"] }),
          queryClient.invalidateQueries({ queryKey: ["calendar", "day"] }),
        ]);
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Gagal menghapus transaksi";
        addToast(message, "error");
        throw error;
      }
    },
    [addToast, queryClient],
  );

  const summaryLoading = monthAggregates.isLoading && Object.keys(monthAggregates.daySummaries).length === 0;

  return (
    <Page>
      <PageHeader
        title="Kalender"
        description="Pantau pengeluaran dan pemasukan harian secara interaktif."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Filters
            filters={filtersState}
            categories={categoryOptions}
            accounts={accountOptions}
            isCategoryLoading={categoriesLoading}
            isAccountLoading={accountsQuery.isLoading}
            onChange={handleFiltersChange}
            onReset={handleResetFilters}
            resetDisabled={isDefaultFilters}
          />
          <CalendarGrid
            monthDate={monthAggregates.monthDate}
            selectedDate={selectedDate}
            summaries={monthAggregates.daySummaries}
            includeIncome={calendarFilters.includeIncome}
            loading={monthAggregates.isLoading}
            isFetching={monthAggregates.isFetching}
            onSelectDate={handleSelectDate}
            onNavigateMonth={handleNavigateMonth}
            onJumpToToday={handleJumpToToday}
          />
        </div>
        <MonthSummary
          expense={monthAggregates.monthExpense}
          income={monthAggregates.monthIncome}
          net={monthAggregates.monthNet}
          previousExpense={monthAggregates.previousExpense}
          previousIncome={monthAggregates.previousIncome}
          momExpenseChange={monthAggregates.momExpenseChange}
          momIncomeChange={monthAggregates.momIncomeChange}
          loading={summaryLoading}
        />
      </div>
      <DayDetailModal
        open={Boolean(selectedDateKey)}
        dateKey={selectedDateKey}
        summary={selectedDateKey ? monthAggregates.daySummaries[selectedDateKey] : undefined}
        transactions={dayTransactionsQuery.transactions}
        includeIncome={calendarFilters.includeIncome}
        categoryMap={categoryMap}
        accountMap={accountMap}
        isLoading={dayTransactionsQuery.isLoading && dayTransactionsQuery.transactions.length === 0}
        onClose={handleCloseModal}
        onEdit={handleEditTransaction}
        onDelete={handleDeleteTransaction}
      />
    </Page>
  );
}
