import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type AdminProfile = {
  id: string;
  role: 'user' | 'admin';
  is_active: boolean | null;
  updated_at?: string | null;
};

type AdminState = {
  user: User | null;
  profile: AdminProfile | null;
  loading: boolean;
  error: string | null;
};

type UseIsAdminResult = AdminState & {
  isAdmin: boolean;
  refresh: () => Promise<void>;
};

const INITIAL_STATE: AdminState = {
  user: null,
  profile: null,
  loading: true,
  error: null,
};

function normalizeProfile(row: any): AdminProfile | null {
  if (!row) return null;
  const role = row.role === 'admin' ? 'admin' : 'user';
  let isActive: boolean | null = null;
  if (typeof row.is_active === 'boolean') {
    isActive = row.is_active;
  } else if (row.is_active == null) {
    isActive = null;
  } else if (typeof row.is_active === 'number') {
    isActive = row.is_active !== 0;
  } else if (typeof row.is_active === 'string') {
    isActive = row.is_active === 'true' || row.is_active === '1';
  }

  return {
    id: String(row.id ?? ''),
    role,
    is_active: isActive,
    updated_at: row.updated_at ?? null,
  };
}

export default function useIsAdmin(): UseIsAdminResult {
  const [state, setState] = useState<AdminState>(INITIAL_STATE);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadProfile = useCallback(async () => {
    if (!mountedRef.current) return;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const currentUser = userData.user ?? null;

      if (!mountedRef.current) return;

      if (!currentUser) {
        setState({ user: null, profile: null, loading: false, error: null });
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, role, is_active, updated_at')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!mountedRef.current) return;

      setState({
        user: currentUser,
        profile: normalizeProfile(profileData),
        loading: false,
        error: null,
      });
    } catch (err) {
      if (!mountedRef.current) return;
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat profil admin';
      setState({ user: null, profile: null, loading: false, error: message });
    }
  }, []);

  useEffect(() => {
    void loadProfile();
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      void loadProfile();
    });

    return () => {
      subscription.subscription?.unsubscribe();
    };
  }, [loadProfile]);

  const refresh = useCallback(async () => {
    await loadProfile();
  }, [loadProfile]);

  const isAdmin = state.profile?.role === 'admin';

  return { ...state, isAdmin, refresh };
}
