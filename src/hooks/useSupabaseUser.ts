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

    const syncInitialSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        setState({ user: data.session?.user ?? null, loading: false });
      } catch (error) {
        console.error('[auth] Failed to read initial session', error);
        if (!active) return;
        setState({ user: null, loading: false });
      }
    };

    void syncInitialSession();

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        console.info('[auth] onAuthStateChange SIGNED_IN', {
          email: session?.user?.email ?? null,
        });
      }
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
