import type { PostgrestError } from '@supabase/supabase-js';
import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';
import { supabase } from './supabase';
import { getCurrentUserId } from './session';
import { getHouseholdScopeSnapshot } from './householdScope';

export type HouseholdRole = 'owner' | 'editor' | 'viewer';
export type HouseholdStatus = 'accepted' | 'pending' | 'revoked';

export interface HouseholdMember {
  id: string;
  userId: string | null;
  username: string | null;
  role: HouseholdRole;
  status: HouseholdStatus;
  invitedAt: string | null;
  joinedAt: string | null;
}

export interface HouseholdSummary {
  householdId: string | null;
  householdName: string | null;
  role: HouseholdRole | null;
  members: HouseholdMember[];
  memberUserIds: string[];
  currentUserId: string | null;
}

function toFriendlyError(error: unknown, fallback: string): Error {
  if (error instanceof Error) {
    return new Error(error.message);
  }
  if (error && typeof error === 'object') {
    const typed = error as Partial<PostgrestError>;
    if (typed.message) {
      return new Error(typed.message);
    }
  }
  return new Error(fallback);
}

async function fetchHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
  if (!householdId) return [];
  const { data, error } = await supabase
    .from('household_members')
    .select('id, household_id, user_id, username, role, status, created_at, accepted_at, updated_at')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true });
  if (error) {
    throw toFriendlyError(error, 'Gagal memuat anggota rumah tangga.');
  }

  const rows = data ?? [];
  const userIds = rows
    .map((row) => row.user_id as string | null)
    .filter((value): value is string => Boolean(value));

  let profileMap = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: profileRows, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, username')
      .in('id', userIds);
    if (!profileError && Array.isArray(profileRows)) {
      profileMap = new Map(
        profileRows.map((row) => [String(row.id), row.username ? String(row.username) : null]),
      );
    }
  }

  return rows.map((row) => ({
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : null,
    username:
      typeof row.username === 'string' && row.username.trim()
        ? row.username.trim()
        : row.user_id && profileMap.get(String(row.user_id))
          ? profileMap.get(String(row.user_id)) ?? null
          : null,
    role: (row.role as HouseholdRole) ?? 'viewer',
    status: (row.status as HouseholdStatus) ?? 'pending',
    invitedAt: row.created_at ?? null,
    joinedAt: row.accepted_at ?? row.updated_at ?? null,
  }));
}

export async function getHouseholdContext(): Promise<HouseholdSummary> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return {
      householdId: null,
      householdName: null,
      role: null,
      members: [],
      memberUserIds: [],
      currentUserId: null,
    };
  }

  const { data: membership, error: membershipError } = await supabase
    .from('household_members')
    .select('household_id, role, status')
    .eq('user_id', userId)
    .order('accepted_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membershipError && membershipError.code !== 'PGRST116') {
    throw toFriendlyError(membershipError, 'Gagal memuat data household.');
  }

  const householdId = membership?.household_id ? String(membership.household_id) : null;
  if (!householdId) {
    return {
      householdId: null,
      householdName: null,
      role: null,
      members: [],
      memberUserIds: [userId],
      currentUserId: userId,
    };
  }

  const [householdRow, members] = await Promise.all([
    supabase.from('households').select('id, name').eq('id', householdId).maybeSingle(),
    fetchHouseholdMembers(householdId),
  ]);

  if (householdRow.error && householdRow.error.code !== 'PGRST116') {
    throw toFriendlyError(householdRow.error, 'Gagal memuat household aktif.');
  }

  const memberUserIds = Array.from(
    new Set(
      members
        .map((member) => member.userId)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  if (!memberUserIds.includes(userId)) {
    memberUserIds.push(userId);
  }

  return {
    householdId,
    householdName: householdRow.data?.name ?? null,
    role: (membership?.role as HouseholdRole) ?? null,
    members,
    memberUserIds,
    currentUserId: userId,
  };
}

export async function listMembers(householdId: string): Promise<HouseholdMember[]> {
  if (!householdId) return [];
  return fetchHouseholdMembers(householdId);
}

export async function inviteByUsername(
  householdId: string,
  username: string,
  role: HouseholdRole,
) {
  if (!householdId) throw new Error('Household tidak ditemukan.');
  const normalized = username.trim().toLowerCase();
  if (!normalized) throw new Error('Username wajib diisi.');

  const { data, error } = await supabase.rpc('create_or_invite_member_by_username', {
    household_id: householdId,
    username: normalized,
    role,
  });
  if (error) {
    throw toFriendlyError(error, 'Gagal mengundang anggota.');
  }
  return data;
}

export async function updateMemberRole(memberId: string, role: HouseholdRole) {
  if (!memberId) throw new Error('Anggota tidak ditemukan.');
  const { error } = await supabase
    .from('household_members')
    .update({ role })
    .eq('id', memberId);
  if (error) {
    throw toFriendlyError(error, 'Gagal memperbarui peran.');
  }
}

export async function removeMember(memberId: string) {
  if (!memberId) throw new Error('Anggota tidak ditemukan.');
  const { error } = await supabase.from('household_members').delete().eq('id', memberId);
  if (error) {
    throw toFriendlyError(error, 'Gagal menghapus anggota.');
  }
}

export async function leaveHousehold(householdId?: string) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Tidak bisa keluar household tanpa login.');
  let query = supabase.from('household_members').delete().eq('user_id', userId);
  if (householdId) {
    query = query.eq('household_id', householdId);
  }
  const { error } = await query;
  if (error) {
    throw toFriendlyError(error, 'Gagal keluar dari household.');
  }
}

export function withHouseholdScope<T extends PostgrestFilterBuilder<any, any, any>>(
  query: T,
  memberUserIds: string[],
  enabled: boolean,
  fallbackUserId?: string | null,
): T {
  if (enabled && Array.isArray(memberUserIds) && memberUserIds.length > 0) {
    return query.in('user_id', memberUserIds) as T;
  }
  if (fallbackUserId) {
    return query.eq('user_id', fallbackUserId) as T;
  }
  return query;
}

export function applyHouseholdScope<T extends PostgrestFilterBuilder<any, any, any>>(
  query: T,
  fallbackUserId?: string | null,
  overrideEnabled?: boolean,
): T {
  const snapshot = getHouseholdScopeSnapshot();
  const enabled = overrideEnabled ?? snapshot.enabled;
  const fallback = fallbackUserId ?? snapshot.currentUserId ?? null;
  return withHouseholdScope(query, snapshot.memberUserIds, enabled, fallback);
}
