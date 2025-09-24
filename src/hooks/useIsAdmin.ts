import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type AdminRole = 'user' | 'admin';

type AdminProfile = {
  id: string;
  role: AdminRole | null;
  is_active: boolean | null;
  email?: string | null;
  updated_at?: string | null;
};

type AdminState = {
  user: User | null;
  profile: AdminProfile | null;
  loading: boolean;
  error: string | null;
};

const initialState: AdminState = {
  user: null,
  profile: null,
  loading: true,
  error: null,
};

const isDevelopment = Boolean(
  (typeof import.meta !== 'undefined' && import.meta.env?.DEV) ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development'),
);

function logDevError(scope: string, error: unknown) {
  if (!isDevelopment) return;
  // eslint-disable-next-line no-console
  console.error(`[admin-hook:${scope}]`, error);
}

export function useIsAdmin() {
  const [state, setState] = useState<AdminState>(initialState);
  const cacheRef = useRef<{ userId: string | null; profile: AdminProfile | null }>({
    userId: null,
    profile: null,
  });
  const mountedRef = useRef(true);

  const setSafeState = useCallback((value: AdminState | ((prev: AdminState) => AdminState)) => {
    if (!mountedRef.current) return;
    setState(value);
  }, []);

  const fetchProfile = useCallback(
    async (force = false) => {
      setSafeState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        const user = data.user ?? null;
        if (!user) {
          cacheRef.current = { userId: null, profile: null };
          setSafeState({ user: null, profile: null, loading: false, error: null });
          return;
        }

        if (!force && cacheRef.current.userId === user.id && cacheRef.current.profile) {
          setSafeState({
            user,
            profile: cacheRef.current.profile,
            loading: false,
            error: null,
          });
          return;
        }

        const { data: profileRow, error: profileError } = await supabase
          .from('user_profiles')
          .select('id, role, is_active, email, updated_at')
          .eq('id', user.id)
          .maybeSingle();
        if (profileError) throw profileError;

        const profile: AdminProfile | null = profileRow
          ? {
              id: profileRow.id,
              role: (profileRow.role as AdminRole | null) ?? null,
              is_active:
                typeof profileRow.is_active === 'boolean' ? profileRow.is_active : profileRow.is_active ?? null,
              email: profileRow.email ?? null,
              updated_at: profileRow.updated_at ?? null,
            }
          : null;

        cacheRef.current = { userId: user.id, profile };
        setSafeState({ user, profile, loading: false, error: null });
      } catch (error) {
        logDevError('fetchProfile', error);
        const message =
          error instanceof Error && error.message ? error.message : 'Tidak bisa memuat data admin.';
        cacheRef.current = { userId: null, profile: null };
        setSafeState({ user: null, profile: null, loading: false, error: message });
      }
    },
    [setSafeState],
  );

  useEffect(() => {
    mountedRef.current = true;
    fetchProfile();
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      fetchProfile(true);
    });

    return () => {
      mountedRef.current = false;
      subscription.subscription?.unsubscribe();
    };
  }, [fetchProfile]);

  const refresh = useCallback(() => fetchProfile(true), [fetchProfile]);

  return {
    ...state,
    isAdmin: Boolean(state.profile?.role === 'admin' && state.profile?.is_active !== false),
    refresh,
  };
}

export type UseIsAdminReturn = ReturnType<typeof useIsAdmin>;
