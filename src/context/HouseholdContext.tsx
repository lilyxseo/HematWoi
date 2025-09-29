import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getHouseholdContext,
  type HouseholdMember,
  type HouseholdRole,
  type HouseholdSummary,
} from '../lib/householdApi';
import { setHouseholdScopeSnapshot } from '../lib/householdScope';

interface HouseholdCtx {
  loading: boolean;
  error: Error | null;
  householdId: string | null;
  householdName: string | null;
  role: HouseholdRole | null;
  members: HouseholdMember[];
  householdViewEnabled: boolean;
  toggleHouseholdView(enabled: boolean): void;
  refresh(): void;
  memberUserIds: string[];
  currentUserId: string | null;
}

const STORAGE_KEY = 'hw:household:view';

const HouseholdContext = createContext<HouseholdCtx | undefined>(undefined);

interface ProviderProps {
  children: ReactNode;
}

export function HouseholdProvider({ children }: ProviderProps) {
  const queryClient = useQueryClient();
  const [storedEnabled, setStoredEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw === 'true';
    } catch {
      return false;
    }
  });

  const { data, isLoading, error, refetch, isFetching } = useQuery<HouseholdSummary>({
    queryKey: ['household-context'],
    queryFn: getHouseholdContext,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const householdId = data?.householdId ?? null;
  const memberUserIds = data?.memberUserIds ?? [];
  const currentUserId = data?.currentUserId ?? null;

  const enableToggle = storedEnabled && Boolean(householdId);

  useEffect(() => {
    setHouseholdScopeSnapshot(data, enableToggle);
  }, [data, enableToggle]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(storedEnabled));
    } catch {
      /* ignore */
    }
  }, [storedEnabled]);

  const toggleHouseholdView = useCallback(
    (enabled: boolean) => {
      setStoredEnabled(enabled);
      queryClient.invalidateQueries({ queryKey: ['household-context'] }).catch(() => {
        /* noop */
      });
    },
    [queryClient],
  );

  const value = useMemo<HouseholdCtx>(() => ({
    loading: isLoading || isFetching,
    error: error instanceof Error ? error : null,
    householdId,
    householdName: data?.householdName ?? null,
    role: data?.role ?? null,
    members: data?.members ?? [],
    householdViewEnabled: enableToggle,
    toggleHouseholdView,
    refresh: () => {
      void refetch();
    },
    memberUserIds,
    currentUserId,
  }), [
    isLoading,
    isFetching,
    error,
    householdId,
    data?.householdName,
    data?.role,
    data?.members,
    enableToggle,
    toggleHouseholdView,
    refetch,
    memberUserIds,
    currentUserId,
  ]);

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHousehold must be used within HouseholdProvider');
  return ctx;
}
