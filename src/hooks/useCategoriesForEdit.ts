import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Category } from '../services/categories';
import { fetchCategoryById, fetchCategoriesRaw } from '../services/categories';

type TransactionTypeForEdit = 'income' | 'expense' | 'transfer';

type UseCategoriesForEditOptions = {
  enabled?: boolean;
};

function sortCategories(list: Category[]): Category[] {
  return [...list].sort((a, b) => {
    const orderA = typeof a.order_index === 'number' ? a.order_index : Number.POSITIVE_INFINITY;
    const orderB = typeof b.order_index === 'number' ? b.order_index : Number.POSITIVE_INFINITY;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a.name.localeCompare(b.name, 'id', { sensitivity: 'base' });
  });
}

export function useCategoriesForEdit(
  txType: TransactionTypeForEdit,
  selectedCategoryId?: string | null,
  options?: UseCategoriesForEditOptions,
): {
  options: Category[];
  isLoading: boolean;
  ensureSelectedLoaded: (categoryId?: string | null) => Promise<Category | null>;
} {
  const enabled = options?.enabled ?? true;
  const [items, setItems] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const activeRef = useRef(true);
  const pendingKeyRef = useRef<string | null>(null);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  const effectiveSelectedId = selectedCategoryId ?? undefined;

  const loadCategories = useCallback(async () => {
    if (!enabled || txType === 'transfer') {
      if (activeRef.current) {
        pendingKeyRef.current = null;
        setItems([]);
        setIsLoading(false);
      }
      return;
    }

    const requestKey = `${txType}:${effectiveSelectedId ?? ''}`;
    pendingKeyRef.current = requestKey;
    setIsLoading(true);

    try {
      const base = await fetchCategoriesRaw({ types: [txType], order: true });
      const deduped = new Map<string, Category>();
      base.forEach((category) => {
        deduped.set(category.id, category);
      });

      if (effectiveSelectedId && !deduped.has(effectiveSelectedId)) {
        try {
          const fallback = await fetchCategoryById(effectiveSelectedId);
          if (fallback) {
            deduped.set(fallback.id, fallback);
          }
        } catch (error) {
          console.error('[categories:editHook] Failed to fetch selected category', error);
        }
      }

      if (!activeRef.current || pendingKeyRef.current !== requestKey) {
        return;
      }

      setItems(sortCategories(Array.from(deduped.values())));
    } catch (error) {
      if (!activeRef.current || pendingKeyRef.current !== requestKey) {
        return;
      }
      console.error('[categories:editHook] Failed to load categories', error);
      setItems([]);
    } finally {
      if (activeRef.current && pendingKeyRef.current === requestKey) {
        setIsLoading(false);
      }
    }
  }, [effectiveSelectedId, enabled, txType]);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setIsLoading(false);
      pendingKeyRef.current = null;
      return;
    }
    void loadCategories();
  }, [enabled, loadCategories]);

  const ensureSelectedLoaded = useCallback(
    async (categoryId?: string | null): Promise<Category | null> => {
      const targetId = categoryId ?? effectiveSelectedId;
      if (!enabled || txType === 'transfer' || !targetId) {
        return null;
      }

      const existing = items.find((category) => category.id === targetId);
      if (existing) {
        return existing;
      }

      try {
        const fetched = await fetchCategoryById(targetId);
        if (fetched && activeRef.current) {
          setItems((prev) => {
            if (prev.some((item) => item.id === fetched.id)) {
              return prev;
            }
            const next = [...prev, fetched];
            return sortCategories(next);
          });
        }
        return fetched;
      } catch (error) {
        console.error('[categories:editHook] Failed to ensure selected category', error);
        return null;
      }
    },
    [effectiveSelectedId, enabled, items, txType],
  );

  return useMemo(
    () => ({ options: items, isLoading, ensureSelectedLoaded }),
    [ensureSelectedLoaded, isLoading, items],
  );
}
