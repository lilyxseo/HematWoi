import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SupabaseClient, AuthChangeEvent, Session } from '@supabase/supabase-js';
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
  error: string | null;
  refresh: () => Promise<void>;
};

type AuthSubscription = ReturnType<SupabaseClient['auth']['onAuthStateChange']>['data']['subscription'];

export function useCategories(types?: CategoryType[]): UseCategoriesResult {
  const navigate = useNavigate();
  const [data, setData] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const supabaseClient = supabase as SupabaseClient;
  const isMountedRef = useRef(true);
  const sessionReadyRef = useRef(false);
  const pendingSessionResolveRef = useRef<((value: boolean) => void) | null>(null);
  const authSubscriptionRef = useRef<AuthSubscription | null>(null);
  const skipNextAutoRef = useRef(false);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (pendingSessionResolveRef.current) {
        pendingSessionResolveRef.current(false);
        pendingSessionResolveRef.current = null;
      }
      if (authSubscriptionRef.current) {
        authSubscriptionRef.current.unsubscribe();
        authSubscriptionRef.current = null;
      }
    };
  }, []);

  const typesKey = useMemo(() => {
    if (!types || types.length === 0) {
      return '';
    }
    return [...types].sort().join('|');
  }, [types]);

  const normalizedTypes = useMemo(() => {
    if (!types || types.length === 0) {
      return undefined;
    }
    const filtered = types.filter((item): item is CategoryType => item === 'income' || item === 'expense');
    if (filtered.length === 0) {
      return undefined;
    }
    return Array.from(new Set(filtered));
  }, [typesKey]);

  const cacheKey = useMemo(() => getCategoriesCacheKey(normalizedTypes), [normalizedTypes]);

  useEffect(() => {
    const cached = getCachedCategories(cacheKey);
    if (cached && isMountedRef.current) {
      setData(cached);
      setIsLoading(true);
    }
  }, [cacheKey]);

  const ensureSession = useCallback(async (): Promise<boolean> => {
    if (sessionReadyRef.current) {
      return true;
    }

    try {
      const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
      if (sessionError) {
        console.error('[useCategories] Failed to get session', sessionError);
        if (isMountedRef.current) {
          const message = sessionError.message || 'Gagal mendapatkan sesi.';
          setError(message);
        }
        return false;
      }

      if (sessionData?.session) {
        sessionReadyRef.current = true;
        return true;
      }

      return await new Promise<boolean>((resolve) => {
        pendingSessionResolveRef.current = resolve;
        const { data: listener } = supabaseClient.auth.onAuthStateChange(
          (event: AuthChangeEvent, session: Session | null) => {
            if (!isMountedRef.current) {
              return;
            }
            if (event === 'SIGNED_IN' && session) {
              sessionReadyRef.current = true;
              listener.subscription.unsubscribe();
              authSubscriptionRef.current = null;
              pendingSessionResolveRef.current = null;
              resolve(true);
            } else if (event === 'SIGNED_OUT') {
              console.warn('[useCategories] Received SIGNED_OUT event while waiting for session');
              setError('Session berakhir, silakan login lagi.');
              navigate('/auth', { replace: true });
            }
          },
        );
        authSubscriptionRef.current = listener.subscription;
      });
    } catch (err) {
      console.error('[useCategories] Error while ensuring session', err);
      if (isMountedRef.current) {
        const message = err instanceof Error ? err.message : 'Gagal memeriksa sesi.';
        setError(message);
      }
      return false;
    }
  }, [navigate, supabaseClient]);

  const performFetch = useCallback(async () => {
    if (!isMountedRef.current) {
      return;
    }
    setIsLoading(true);
    setError(null);

    const hasSession = await ensureSession();
    if (!hasSession || !isMountedRef.current) {
      setIsLoading(false);
      return;
    }

    try {
      const categories = await fetchCategoriesSafe({ types: normalizedTypes ?? undefined });
      if (!isMountedRef.current) {
        return;
      }
      setData(categories);
      cacheCategories(cacheKey, categories);
    } catch (err) {
      console.error('[useCategories] Failed to fetch categories', err);
      if (!isMountedRef.current) {
        return;
      }
      const message = err instanceof Error ? err.message : 'Gagal memuat kategori.';
      setError(message);
      if (message.toLowerCase().includes('session')) {
        navigate('/auth', { replace: true });
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [cacheKey, ensureSession, navigate, normalizedTypes]);

  const previousTypesKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isMountedRef.current) {
      return;
    }
    if (skipNextAutoRef.current) {
      skipNextAutoRef.current = false;
      previousTypesKeyRef.current = typesKey;
      return;
    }
    if (previousTypesKeyRef.current !== null && previousTypesKeyRef.current === typesKey) {
      return;
    }
    previousTypesKeyRef.current = typesKey;
    performFetch();
  }, [performFetch, typesKey]);

  const refresh = useCallback(async () => {
    skipNextAutoRef.current = true;
    await performFetch();
  }, [performFetch]);

  return { data, isLoading, error, refresh };
}

export default useCategories;
