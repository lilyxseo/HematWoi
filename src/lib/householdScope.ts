import type { PostgrestFilterBuilder } from '@supabase/supabase-js';
import type { HouseholdRole } from './householdApi';

export type HouseholdScopeRuntime = {
  enabled: boolean;
  memberUserIds: string[];
  householdId: string | null;
  role: HouseholdRole | null;
};

let runtimeState: HouseholdScopeRuntime = {
  enabled: false,
  memberUserIds: [],
  householdId: null,
  role: null,
};

export function setHouseholdScopeRuntime(next: HouseholdScopeRuntime) {
  runtimeState = {
    enabled: Boolean(next.enabled),
    memberUserIds: Array.from(new Set(next.memberUserIds ?? [])).filter(Boolean),
    householdId: next.householdId ?? null,
    role: next.role ?? null,
  };
}

export function getHouseholdScopeRuntime(): HouseholdScopeRuntime {
  return runtimeState;
}

export function withHouseholdScope<T extends PostgrestFilterBuilder<any, any, any>>(
  query: T,
  memberUserIds: string[],
  enabled: boolean,
  currentUserId?: string | null,
): T {
  if (!enabled || memberUserIds.length === 0) {
    if (currentUserId) {
      return query.eq('user_id', currentUserId) as T;
    }
    return query;
  }
  const scopedIds = currentUserId
    ? Array.from(new Set([...memberUserIds, currentUserId])).filter(Boolean)
    : memberUserIds;
  return query.in('user_id', scopedIds) as T;
}
