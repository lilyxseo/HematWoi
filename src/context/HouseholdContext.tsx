import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  deleteHousehold,
  getHouseholdContext,
  inviteByUsername,
  leaveHousehold,
  listMembers,
  removeMember,
  updateMemberRole,
  type HouseholdContextInfo,
  type HouseholdMember,
  type HouseholdMemberStatus,
  type HouseholdRole,
} from '../lib/householdApi';
import { setHouseholdScopeRuntime } from '../lib/householdScope';

const STORAGE_KEY = 'hw:household-view';

type HouseholdState = {
  context: HouseholdContextInfo | null;
  members: HouseholdMember[];
  loading: boolean;
  error: Error | null;
  householdViewEnabled: boolean;
};

type InvitePayload = {
  username: string;
  role: HouseholdRole;
};

type HouseholdContextValue = {
  householdId: string | null;
  householdName: string | null;
  role: HouseholdRole | null;
  members: HouseholdMember[];
  memberUserIds: string[];
  memberCount: number;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  invite: (payload: InvitePayload) => Promise<HouseholdMemberStatus>;
  updateRole: (memberId: string, role: HouseholdRole) => Promise<void>;
  remove: (memberId: string) => Promise<void>;
  leave: () => Promise<void>;
  destroy: () => Promise<void>;
  householdViewEnabled: boolean;
  setHouseholdViewEnabled: (value: boolean) => void;
  isOwner: boolean;
  isEditor: boolean;
};

const defaultContextValue: HouseholdContextValue = {
  householdId: null,
  householdName: null,
  role: null,
  members: [],
  memberUserIds: [],
  memberCount: 0,
  loading: false,
  error: null,
  refresh: async () => {},
  invite: async () => 'pending',
  updateRole: async () => {},
  remove: async () => {},
  leave: async () => {},
  destroy: async () => {},
  householdViewEnabled: false,
  setHouseholdViewEnabled: () => {},
  isOwner: false,
  isEditor: false,
};

const HouseholdContext = createContext<HouseholdContextValue>(defaultContextValue);

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<HouseholdState>(() => ({
    context: null,
    members: [],
    loading: true,
    error: null,
    householdViewEnabled: (() => {
      if (typeof window === 'undefined') return false;
      try {
        return window.localStorage.getItem(STORAGE_KEY) === '1';
      } catch {
        return false;
      }
    })(),
  }));
  const fetchingRef = useRef(false);

  const load = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const context = await getHouseholdContext();
      if (!context) {
        setState((prev) => ({
          ...prev,
          context: null,
          members: [],
          loading: false,
          error: null,
        }));
        return;
      }
      const members = await listMembers(context.householdId);
      setState((prev) => ({
        ...prev,
        context,
        members,
        loading: false,
        error: null,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error : new Error('Gagal memuat household'),
      }));
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const context = state.context;
    setHouseholdScopeRuntime({
      enabled: state.householdViewEnabled,
      memberUserIds: context?.memberUserIds ?? [],
      householdId: context?.householdId ?? null,
      role: context?.role ?? null,
    });
  }, [state.context, state.householdViewEnabled]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  const setHouseholdViewEnabled = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, householdViewEnabled: value }));
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
      } catch {
        /* ignore */
      }
    }
  }, []);

  const invite = useCallback<HouseholdContextValue['invite']>(
    async ({ username, role }) => {
      if (!state.context?.householdId) {
        throw new Error('Household belum siap.');
      }
      const result = await inviteByUsername(state.context.householdId, username, role);
      await refresh();
      return result.status;
    },
    [refresh, state.context?.householdId],
  );

  const updateRole = useCallback<HouseholdContextValue['updateRole']>(
    async (memberId, role) => {
      await updateMemberRole(memberId, role);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback<HouseholdContextValue['remove']>(
    async (memberId) => {
      await removeMember(memberId);
      await refresh();
    },
    [refresh],
  );

  const leave = useCallback(async () => {
    await leaveHousehold();
    await refresh();
  }, [refresh]);

  const destroy = useCallback(async () => {
    if (!state.context?.householdId) return;
    await deleteHousehold(state.context.householdId);
    await refresh();
  }, [refresh, state.context?.householdId]);

  const value = useMemo<HouseholdContextValue>(() => {
    const context = state.context;
    const role = context?.role ?? null;
    const memberUserIds = context?.memberUserIds ?? [];
    const memberCount = context?.memberCount ?? state.members.length;
    const isOwner = role === 'owner';
    const isEditor = role === 'editor' || role === 'owner';

    return {
      householdId: context?.householdId ?? null,
      householdName: context?.householdName ?? null,
      role,
      members: state.members,
      memberUserIds,
      memberCount,
      loading: state.loading,
      error: state.error,
      refresh,
      invite,
      updateRole,
      remove,
      leave,
      destroy,
      householdViewEnabled: state.householdViewEnabled,
      setHouseholdViewEnabled,
      isOwner,
      isEditor,
    };
  }, [invite, refresh, remove, updateRole, leave, destroy, setHouseholdViewEnabled, state]);

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export function useHousehold(): HouseholdContextValue {
  return useContext(HouseholdContext);
}

export { withHouseholdScope } from '../lib/householdScope';
