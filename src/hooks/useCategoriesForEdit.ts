import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {
  fetchCategoriesRaw,
  fetchCategoryById,
  type Category,
} from '../services/categories';

type TxType = 'income' | 'expense' | 'transfer';

type UseCategoriesForEditOptions = {
  enabled?: boolean;
};

type UseCategoriesForEditResult = {
  options: Category[];
  isLoading: boolean;
  ensureSelectedLoaded: (categoryId?: string) => Promise<Category | null>;
};

const SESSION_READY_EVENTS = new Set([
  'SIGNED_IN',
  'INITIAL_SESSION',
  'TOKEN_REFRESHED',
]);

type SessionSubscription =
  ReturnType<typeof supabase.auth.onAuthStateChange>['data']['subscription'];

async function waitForSession(
  getIsMounted: () => boolean,
  onSubscription: (subscription: SessionSubscription | null) => void,
): Promise<Session> {
  const { data, error } = await supabase.auth.getSession();

  if (!getIsMounted()) {
    throw new Error('cancelled');
  }

  if (error) {
    console.error('[categories:editHook] Failed to get session', error);
    throw error;
  }

  if (data?.session?.user) {
    return data.session;
  }

  return new Promise<Session>((resolve, reject) => {
    const { data: subscriptionData, error: subscriptionError } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!getIsMounted()) {
          subscriptionData.subscription.unsubscribe();
          onSubscription(null);
          reject(new Error('cancelled'));
          return;
        }

        if (session?.user && SESSION_READY_EVENTS.has(event)) {
          subscriptionData.subscription.unsubscribe();
          onSubscription(null);
          resolve(session);
          return;
        }

        if (event === 'SIGNED_OUT') {
          subscriptionData.subscription.unsubscribe();
          onSubscription(null);
          reject(new Error('Session berakhir, silakan login lagi.'));
        }
      },
    );

    if (subscriptionError) {
      subscriptionData?.subscription.unsubscribe();
      onSubscription(null);
      reject(subscriptionError);
      return;
    }

    onSubscription(subscriptionData.subscription);
  });
}

export default function useCategoriesForEdit(
  txType: TxType,
  selectedCategoryId?: string,
  options: UseCategoriesForEditOptions = {},
): UseCategoriesForEditResult {
  const enabled = options.enabled ?? true;
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const mountedRef = useRef(true);
  const currentTypeRef = useRef<TxType>(txType);
  const authSubscriptionRef = useRef<SessionSubscription | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      authSubscriptionRef.current?.unsubscribe();
      authSubscriptionRef.current = null;
    };
  }, []);

  useEffect(() => {
    currentTypeRef.current = txType;
  }, [txType]);

  const ensureSession = useCallback(async () => {
    try {
      const session = await waitForSession(
        () => mountedRef.current,
        (subscription) => {
          authSubscriptionRef.current = subscription;
        },
      );
      return session;
    } catch (error) {
      if (error instanceof Error && error.message === 'cancelled') {
        throw error;
      }
      throw error;
    }
  }, []);

  const ensureSelectedLoaded = useCallback(
    async (categoryId?: string): Promise<Category | null> => {
      const targetId = categoryId ?? selectedCategoryId;
      if (!enabled || !targetId || currentTypeRef.current === 'transfer') {
        return null;
      }

      const alreadyExists = categories.some((item) => item.id === targetId);
      if (alreadyExists) {
        return categories.find((item) => item.id === targetId) ?? null;
      }

      try {
        await ensureSession();
        const fallback = await fetchCategoryById(targetId);
        if (!mountedRef.current) {
          return fallback;
        }
        if (fallback) {
          setCategories((prev) => {
            if (prev.some((item) => item.id === fallback.id)) {
              return prev;
            }
            return [...prev, fallback];
          });
        }
        return fallback;
      } catch (error) {
        if (error instanceof Error && error.message === 'cancelled') {
          return null;
        }
        console.error('[categories:editHook] Failed to ensure selected category', error);
        return null;
      }
    },
    [categories, enabled, ensureSession, selectedCategoryId],
  );

  const loadCategories = useCallback(async () => {
    if (!enabled) {
      return;
    }

    if (txType !== 'income' && txType !== 'expense') {
      setCategories([]);
      return;
    }

    setIsLoading(true);
    try {
      const session = await ensureSession();
      if (!mountedRef.current || !session) {
        return;
      }

      const rows = await fetchCategoriesRaw({ types: [txType] });
      if (!mountedRef.current) {
        return;
      }
      setCategories(rows);
    } catch (error) {
      if (error instanceof Error && error.message === 'cancelled') {
        return;
      }
      console.error('[categories:editHook] Failed to load categories', error);
      setCategories([]);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [enabled, ensureSession, txType]);

  useEffect(() => {
    if (!enabled) {
      setCategories([]);
      setIsLoading(false);
      return;
    }
    void loadCategories();
  }, [enabled, loadCategories]);

  useEffect(() => {
    if (!enabled || !selectedCategoryId) {
      return;
    }
    if (txType === 'transfer') {
      return;
    }
    if (categories.some((item) => item.id === selectedCategoryId)) {
      return;
    }
    void ensureSelectedLoaded(selectedCategoryId);
  }, [categories, enabled, ensureSelectedLoaded, selectedCategoryId, txType]);

  const sortedCategories = useMemo(() => {
    if (txType === 'transfer') {
      return [] as Category[];
    }
    return [...categories].sort((a, b) => {
      const orderA = a.order_index ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.order_index ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.name.localeCompare(b.name);
    });
  }, [categories, txType]);

  return {
    options: sortedCategories,
    isLoading,
    ensureSelectedLoaded,
  };
}
