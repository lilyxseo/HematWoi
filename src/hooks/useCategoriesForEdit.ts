import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Category } from '../services/categories';
import { fetchCategoriesRaw, fetchCategoryById } from '../services/categories';

type TxType = 'income' | 'expense' | 'transfer';

type UseCategoriesForEditResult = {
  options: Category[];
  isLoading: boolean;
  error: Error | null;
  appendedCategoryIds: string[];
  reload: () => Promise<void>;
  ensureSelectedLoaded: (categoryId?: string | null) => Promise<void>;
};

function dedupeCategories(categories: Category[]): Category[] {
  const map = new Map<string, Category>();
  categories.forEach((category) => {
    map.set(category.id, category);
  });
  return Array.from(map.values());
}

export function useCategoriesForEdit(
  txType: TxType,
  selectedCategoryId?: string | null,
): UseCategoriesForEditResult {
  const [options, setOptions] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [appendedCategoryIds, setAppendedCategoryIds] = useState<string[]>([]);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadCategories = useCallback(
    async (type: TxType, categoryId?: string | null) => {
      if (!mounted.current) return;

      if (type === 'transfer') {
        setOptions([]);
        setAppendedCategoryIds([]);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const rows = await fetchCategoriesRaw({ types: [type] });
        let nextOptions = [...rows];
        const appended: string[] = [];

        if (categoryId && !rows.some((row) => row.id === categoryId)) {
          const fallback = await fetchCategoryById(categoryId);
          if (fallback) {
            nextOptions.push(fallback);
            appended.push(fallback.id);
          }
        }

        if (!mounted.current) return;

        setOptions(dedupeCategories(nextOptions));
        setAppendedCategoryIds(appended);
      } catch (err) {
        console.error('[categories:editHook] Failed to load categories', err);
        if (!mounted.current) return;
        setError(err instanceof Error ? err : new Error('Gagal memuat kategori.'));
        setOptions([]);
        setAppendedCategoryIds([]);
      } finally {
        if (mounted.current) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void loadCategories(txType, selectedCategoryId ?? undefined);
  }, [loadCategories, txType, selectedCategoryId]);

  const reload = useCallback(async () => {
    await loadCategories(txType, selectedCategoryId ?? undefined);
  }, [loadCategories, txType, selectedCategoryId]);

  const ensureSelectedLoaded = useCallback(
    async (categoryId?: string | null) => {
      if (!categoryId || txType === 'transfer') {
        return;
      }

      if (options.some((category) => category.id === categoryId)) {
        return;
      }

      try {
        const fallback = await fetchCategoryById(categoryId);
        if (fallback && mounted.current) {
          setOptions((prev) => dedupeCategories([...prev, fallback]));
          setAppendedCategoryIds((prev) =>
            prev.includes(fallback.id) ? prev : [...prev, fallback.id],
          );
        }
      } catch (err) {
        console.error('[categories:editHook] Failed to ensure selected category', err);
      }
    },
    [options, txType],
  );

  const stableOptions = useMemo(() => options, [options]);
  const stableAppended = useMemo(() => appendedCategoryIds, [appendedCategoryIds]);

  return {
    options: stableOptions,
    isLoading,
    error,
    appendedCategoryIds: stableAppended,
    reload,
    ensureSelectedLoaded,
  };
}
