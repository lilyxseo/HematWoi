import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface SupabaseUserState {
  user: User | null;
  loading: boolean;
}

export default function useSupabaseUser(): SupabaseUserState {
  const [state, setState] = useState<SupabaseUserState>({ user: null, loading: true });

  useEffect(() => {
    let active = true;

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!active) return;
        setState({ user: data.user ?? null, loading: false });
      })
      .catch(() => {
        if (!active) return;
        setState({ user: null, loading: false });
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setState({ user: session?.user ?? null, loading: false });
    });

    return () => {
      active = false;
      subscription.subscription?.unsubscribe();
    };
  }, []);

  return state;
}
