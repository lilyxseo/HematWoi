import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { CloudDriver, DataDriver, LocalDriver } from '../lib/data-driver';
import { getGuestSyncTimestamp, syncGuestToCloud } from '../lib/sync';

type ProviderMode = 'guest' | 'online';

interface ProviderState {
  driver: DataDriver;
  mode: ProviderMode;
  syncing: boolean;
  error: Error | null;
  session: Session | null;
}

const defaultState: ProviderState = {
  driver: new LocalDriver(),
  mode: 'guest',
  syncing: false,
  error: null,
  session: null,
};

export function useDataProvider(): ProviderState {
  const [state, setState] = useState<ProviderState>(defaultState);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        console.error('[useDataProvider] Failed to fetch session', error);
      }
      setSession(data.session ?? null);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setState((prev) => ({
        ...prev,
        driver: new LocalDriver(),
        mode: 'guest',
        syncing: false,
        error: null,
        session: null,
      }));
      return;
    }

    const uid = session.user.id;
    let cancelled = false;

    setState((prev) => ({
      ...prev,
      syncing: true,
      error: null,
      session,
    }));

    const run = async () => {
      let syncError: Error | null = null;
      const syncedAt = getGuestSyncTimestamp(uid);
      if (!syncedAt) {
        try {
          await syncGuestToCloud(supabase, uid);
        } catch (err) {
          console.error('[useDataProvider] Sync failed', err);
          syncError = err instanceof Error ? err : new Error('Sync failed');
        }
      }
      if (!cancelled) {
        setState({
          driver: new CloudDriver(supabase, uid),
          mode: 'online',
          syncing: false,
          error: syncError,
          session,
        });
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [session]);

  return useMemo(
    () => ({
      driver: state.driver,
      mode: state.mode,
      syncing: state.syncing,
      error: state.error,
      session: state.session,
    }),
    [state],
  );
}

