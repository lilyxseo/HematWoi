import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchCategoriesRaw, fetchCategoryById, type Category } from '../services/categories';

type TxType = 'income' | 'expense' | 'transfer';

interface UseCategoriesForEditOptions {
  enabled?: boolean;
}

interface UseCategoriesForEditResult {
  options: Category[];
  isLoading: boolean;
  error: Error | null;
  archivedCategoryIds: Set<string>;
  ensureSelectedLoaded: () => Promise<void>;
}

function createArchivedPlaceholder(id: string, txType: 'income' | 'expense'): Category {
  return {
    id,
    user_id: '',
    type: txType,
    name: 'Kategori lama (arsip)',
    group_name: null,
    order_index: null,
    inserted_at: new Date().toISOString(),
  } satisfies Category;
}

function dedupeCategories(list: Category[]): Category[] {
  const map = new Map<string, Category>();
  list.forEach((category) => {
    map.set(category.id, category);
  });
  return Array.from(map.values());
}

export default function useCategoriesForEdit(
  txType: TxType,
  selectedCategoryId?: string | null,
  options?: UseCategoriesForEditOptions,
): UseCategoriesForEditResult {
  const enabled = options?.enabled ?? true;
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());
  const optionsRef = useRef<Category[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    optionsRef.current = categories;
  }, [categories]);

  const ensureSelectedLoaded = useCallback(
    async (categoryId?: string, candidateOptions?: Category[]): Promise<void> => {
      const targetId = categoryId ?? selectedCategoryId ?? undefined;
      if (!enabled || !targetId || txType === 'transfer') {
        return;
      }

      const currentOptions = candidateOptions ?? optionsRef.current;
      if (currentOptions.some((item) => item.id === targetId)) {
        setArchivedIds((prev) => {
          if (!prev.size || !prev.has(targetId)) {
            return prev;
          }
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
        return;
      }

      try {
        const fetched = await fetchCategoryById(targetId);
        if (!mountedRef.current) return;

        if (fetched) {
          setCategories((prev) => dedupeCategories([...prev, fetched]));
          setArchivedIds((prev) => {
            const next = new Set(prev);
            if (fetched.type !== txType) {
              next.add(fetched.id);
            } else {
              next.delete(fetched.id);
            }
            return next;
          });
        } else {
          const placeholder = createArchivedPlaceholder(targetId, txType === 'income' ? 'income' : 'expense');
          setCategories((prev) => dedupeCategories([...prev, placeholder]));
          setArchivedIds((prev) => {
            const next = new Set(prev);
            next.add(targetId);
            return next;
          });
        }
      } catch (err) {
        console.error('[categories:editHook] Failed to ensure category', err);
        setError(err instanceof Error ? err : new Error('Gagal memuat kategori.'));
      }
    },
    [enabled, selectedCategoryId, txType],
  );

  const loadCategories = useCallback(async (): Promise<void> => {
    if (!enabled) {
      setCategories([]);
      setArchivedIds(new Set());
      setIsLoading(false);
      return;
    }
    if (txType === 'transfer') {
      setCategories([]);
      setArchivedIds(new Set());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const rows = await fetchCategoriesRaw({ types: [txType], order: true });
      if (!mountedRef.current) return;
      setCategories(rows);
      optionsRef.current = rows;
      const archiveSet = new Set<string>();
      if (selectedCategoryId && !rows.some((item) => item.id === selectedCategoryId)) {
        archiveSet.add(selectedCategoryId);
      }
      setArchivedIds(archiveSet);
      await ensureSelectedLoaded(selectedCategoryId, rows);
    } catch (err) {
      if (!mountedRef.current) return;
      console.error('[categories:editHook] Failed to load categories', err);
      setError(err instanceof Error ? err : new Error('Gagal memuat kategori.'));
      setCategories([]);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [enabled, ensureSelectedLoaded, selectedCategoryId, txType]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (!enabled) return;
    if (selectedCategoryId) {
      void ensureSelectedLoaded(selectedCategoryId);
    } else {
      setArchivedIds((prev) => {
        if (!prev.size) return prev;
        return new Set();
      });
    }
  }, [enabled, ensureSelectedLoaded, selectedCategoryId]);

  const archivedCategoryIds = useMemo(() => new Set(archivedIds), [archivedIds]);

  return {
    options: categories,
    isLoading,
    error,
    archivedCategoryIds,
    ensureSelectedLoaded: () => ensureSelectedLoaded(selectedCategoryId ?? undefined),
  };
}
