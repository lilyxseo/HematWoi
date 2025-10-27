import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {
  cacheCategories,
  fetchCategoriesSafe,
  getCachedCategories,
  getCategoriesCacheKey,
  type Category,
} from '../services/categories';

type CategoryType = 'income' | 'expense';

type UseCategoriesResult = {
  data: Category[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

const SESSION_READY_EVENTS = new Set(['SIGNED_IN', 'INITIAL_SESSION', 'TOKEN_REFRESHED']);

type AuthSubscription = ReturnType<typeof supabase.auth.onAuthStateChange>['data']['subscription'];

export default function useCategories(types?: CategoryType[]): UseCategoriesResult {
  const navigate = useNavigate();
  const isMountedRef = useRef(true);
  const authSubscriptionRef = useRef<AuthSubscription | null>(null);
  const hasRedirectedRef = useRef(false);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      authSubscriptionRef.current?.unsubscribe();
      authSubscriptionRef.current = null;
    };
  }, []);

  const typesKey = useMemo(() => {
    if (!types || types.length === 0) {
      return 'expense+income';
    }
    const deduped: CategoryType[] = [];
    types.forEach((item) => {
      if ((item === 'income' || item === 'expense') && !deduped.includes(item)) {
        deduped.push(item);
      }
    });
    return deduped.length ? deduped.join('+') : 'expense+income';
  }, [Array.isArray(types) ? types.join('+') : '']);

  const normalizedTypes = useMemo<CategoryType[]>(() => {
    if (!typesKey) {
      return ['expense', 'income'];
    }
    const parts = typesKey.split('+').filter(Boolean);
    if (!parts.length) {
      return ['expense', 'income'];
    }
    return parts.filter((value): value is CategoryType => value === 'income' || value === 'expense');
  }, [typesKey]);

  const cacheKey = useMemo(() => getCategoriesCacheKey(normalizedTypes), [typesKey]);

  const [data, setData] = useState<Category[]>(() => getCachedCategories(cacheKey) ?? []);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const cached = getCachedCategories(cacheKey);
    if (cached) {
      setData(cached);
    } else {
      setData([]);
    }
  }, [cacheKey]);

  const ensureSession = useCallback(async (): Promise<Session | null> => {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('[useCategories] Failed to get session', sessionError);
        throw sessionError;
      }
      if (sessionData?.session?.user) {
        return sessionData.session;
      }
      return await new Promise<Session | null>((resolve, reject) => {
        const { data: subscriptionData, error: subscriptionError } = supabase.auth.onAuthStateChange(
          (event, session) => {
            if (!isMountedRef.current) {
              subscriptionData.subscription.unsubscribe();
              if (authSubscriptionRef.current === subscriptionData.subscription) {
                authSubscriptionRef.current = null;
              }
              reject(new Error('Component unmounted'));
              return;
            }
            if (session?.user && SESSION_READY_EVENTS.has(event)) {
              subscriptionData.subscription.unsubscribe();
              if (authSubscriptionRef.current === subscriptionData.subscription) {
                authSubscriptionRef.current = null;
              }
              resolve(session);
            }
          },
        );
        if (subscriptionError) {
          subscriptionData?.subscription.unsubscribe();
          if (authSubscriptionRef.current === subscriptionData?.subscription) {
            authSubscriptionRef.current = null;
          }
          reject(subscriptionError);
          return;
        }
        authSubscriptionRef.current = subscriptionData.subscription;
      });
    } catch (err) {
      console.error('[useCategories] Failed while waiting for session', err);
      throw err;
    }
  }, []);

  const loadCategories = useCallback(async (): Promise<void> => {
    if (isFetchingRef.current) {
      return;
    }
    isFetchingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      await ensureSession();
      if (!isMountedRef.current) return;
      const result = await fetchCategoriesSafe({ types: normalizedTypes });
      if (!isMountedRef.current) return;
      setData(result);
      cacheCategories(cacheKey, result);
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('[useCategories] Failed to load categories', err);
      const resolvedError = err instanceof Error ? err : new Error('Gagal memuat kategori');
      setError(resolvedError);
      const message = resolvedError.message.toLowerCase();
      if (message.includes('session berakhir') && !hasRedirectedRef.current) {
        hasRedirectedRef.current = true;
        navigate('/auth', { replace: true });
      }
    } finally {
      isFetchingRef.current = false;
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [cacheKey, ensureSession, navigate, normalizedTypes]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const refresh = useCallback(async () => {
    await loadCategories();
  }, [loadCategories]);

  return useMemo(
    () => ({
      data,
      isLoading,
      error,
      refresh,
    }),
    [data, error, isLoading, refresh],
  );
}
