import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Category } from '../services/categories';
import { fetchCategoriesRaw, fetchCategoryById } from '../services/categories';

const SESSION_READY_EVENTS = new Set<AuthChangeEvent>([
  'INITIAL_SESSION',
  'SIGNED_IN',
  'TOKEN_REFRESHED',
]);

interface UseCategoriesForEditResult {
  options: Category[];
  isLoading: boolean;
  error: Error | null;
  ensureSelectedLoaded: (categoryId?: string | null) => Promise<void>;
}

type TxType = 'income' | 'expense' | 'transfer';

type AuthSubscription = ReturnType<typeof supabase.auth.onAuthStateChange>['data']['subscription'];

export default function useCategoriesForEdit(
  txType: TxType,
  selectedCategoryId?: string,
): UseCategoriesForEditResult {
  const mountedRef = useRef(true);
  const subscriptionRef = useRef<AuthSubscription | null>(null);
  const sessionReadyRef = useRef(false);
  const selectedRef = useRef<string | undefined>(selectedCategoryId);

  const [options, setOptions] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    selectedRef.current = selectedCategoryId;
  }, [selectedCategoryId]);

  useEffect(() => () => {
    mountedRef.current = false;
    subscriptionRef.current?.unsubscribe();
    subscriptionRef.current = null;
  }, []);

  const ensureSession = useCallback(async (): Promise<void> => {
    if (sessionReadyRef.current) {
      return;
    }
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        throw error;
      }
      if (data?.session?.user) {
        sessionReadyRef.current = true;
        return;
      }
      await new Promise<void>((resolve, reject) => {
        const { data: subscription, error: subError } = supabase.auth.onAuthStateChange(
          (event, session) => {
            if (!mountedRef.current) {
              subscription.subscription.unsubscribe();
              if (subscriptionRef.current === subscription.subscription) {
                subscriptionRef.current = null;
              }
              reject(new Error('Component unmounted'));
              return;
            }
            if (session?.user && SESSION_READY_EVENTS.has(event)) {
              subscription.subscription.unsubscribe();
              if (subscriptionRef.current === subscription.subscription) {
                subscriptionRef.current = null;
              }
              resolve();
            }
          },
        );
        if (subError) {
          subscription?.subscription.unsubscribe();
          if (subscriptionRef.current === subscription?.subscription) {
            subscriptionRef.current = null;
          }
          reject(subError);
          return;
        }
        subscriptionRef.current = subscription.subscription;
      });
      sessionReadyRef.current = true;
    } catch (err) {
      console.error('[categories:editHook] Failed to ensure session', err);
      throw err;
    }
  }, []);

  const loadCategories = useCallback(async (): Promise<void> => {
    if (!mountedRef.current) return;
    if (txType === 'transfer') {
      setOptions([]);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await ensureSession();
      if (!mountedRef.current) return;
      const rows = await fetchCategoriesRaw({ types: [txType], order: true });
      if (!mountedRef.current) return;
      let next = rows;
      const selectedId = selectedRef.current;
      if (selectedId && !rows.some((category) => category.id === selectedId)) {
        const fallback = await fetchCategoryById(selectedId);
        if (fallback) {
          next = [...rows, fallback];
        }
      }
      if (!mountedRef.current) return;
      setOptions(next);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      console.error('[categories:editHook] Failed to load categories', err);
      setOptions([]);
      setError(err instanceof Error ? err : new Error('Gagal memuat kategori'));
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [ensureSession, txType]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const ensureSelectedLoaded = useCallback(
    async (categoryId?: string | null) => {
      const targetId = categoryId ?? selectedRef.current;
      selectedRef.current = targetId ?? undefined;
      if (!targetId || txType === 'transfer') {
        return;
      }
      if (options.some((category) => category.id === targetId)) {
        return;
      }
      try {
        await ensureSession();
        if (!mountedRef.current) return;
        const fallback = await fetchCategoryById(targetId);
        if (!mountedRef.current || !fallback) {
          return;
        }
        setOptions((prev) => {
          if (prev.some((category) => category.id === fallback.id)) {
            return prev;
          }
          return [...prev, fallback];
        });
      } catch (err) {
        console.error('[categories:editHook] Failed to ensure selected category', err);
      }
    },
    [ensureSession, options, txType],
  );

  useEffect(() => {
    if (!selectedCategoryId) return;
    void ensureSelectedLoaded(selectedCategoryId);
  }, [ensureSelectedLoaded, selectedCategoryId]);

  const sortedOptions = useMemo(() => {
    if (options.length <= 1) {
      return options;
    }
    return [...options].sort((a, b) => {
      const orderA = typeof a.order_index === 'number' ? a.order_index : Number.POSITIVE_INFINITY;
      const orderB = typeof b.order_index === 'number' ? b.order_index : Number.POSITIVE_INFINITY;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.name.localeCompare(b.name, 'id', { sensitivity: 'base' });
    });
  }, [options]);

  return {
    options: sortedOptions,
    isLoading,
    error,
    ensureSelectedLoaded,
  };
}
