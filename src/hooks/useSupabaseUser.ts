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
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        const user = data.session?.user ?? null;
        console.info('[AUTH] useSupabaseUser bootstrap', user?.email ?? null);
        setState({ user, loading: false });
      })
      .catch((error) => {
        if (!active) return;
        console.error('[AUTH] useSupabaseUser bootstrap failed', error);
        setState({ user: null, loading: false });
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'SIGNED_IN') {
        console.info('[AUTH] useSupabaseUser SIGNED_IN', session?.user?.email ?? null);
      }
      setState({ user: session?.user ?? null, loading: false });
    });

    return () => {
      active = false;
      subscription.subscription?.unsubscribe();
    };
  }, []);

  return state;
}
