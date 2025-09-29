import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type HouseholdRole = 'owner' | 'editor' | 'viewer';
export type HouseholdMemberStatus = 'pending' | 'accepted';

export interface HouseholdContextInfo {
  householdId: string;
  householdName: string | null;
  role: HouseholdRole;
  memberUserIds: string[];
  memberCount: number;
}

export interface HouseholdMember {
  id: string;
  householdId: string;
  userId: string | null;
  username: string | null;
  role: HouseholdRole;
  status: HouseholdMemberStatus;
  createdAt: string | null;
}

interface InviteResult {
  status: HouseholdMemberStatus;
  member?: HouseholdMember | null;
}

function normalizeRole(value: unknown): HouseholdRole {
  if (value === 'owner' || value === 'editor' || value === 'viewer') {
    return value;
  }
  return 'viewer';
}

function normalizeStatus(value: unknown): HouseholdMemberStatus {
  if (value === 'accepted') return 'accepted';
  return 'pending';
}

function normalizeUuid(value: unknown): string | null {
  if (typeof value === 'string' && value) {
    return value;
  }
  return null;
}

function normalizeUsername(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return null;
}

function toFriendlyError(error: PostgrestError | Error | unknown, fallback: string): Error {
  if (error && typeof error === 'object') {
    const postgrest = error as Partial<PostgrestError>;
    if (typeof postgrest.message === 'string' && postgrest.message.trim()) {
      return new Error(postgrest.message);
    }
    if (typeof postgrest.hint === 'string' && postgrest.hint.trim()) {
      return new Error(postgrest.hint);
    }
    if (typeof postgrest.details === 'string' && postgrest.details.trim()) {
      return new Error(postgrest.details);
    }
  }
  if (error instanceof Error && error.message) {
    return error;
  }
  return new Error(fallback);
}

export async function getHouseholdContext(): Promise<HouseholdContextInfo | null> {
  try {
    const { data, error } = await supabase.rpc('get_household_context');
    if (error) throw error;
    if (!data) return null;

    const payload = Array.isArray(data) ? data[0] : data;
    if (!payload) return null;

    const householdId = normalizeUuid(payload.household_id ?? payload.householdId ?? payload.id);
    if (!householdId) return null;

    const memberUserIds: string[] = Array.isArray(payload.member_user_ids ?? payload.memberUserIds)
      ? (payload.member_user_ids ?? payload.memberUserIds).map((item: unknown) =>
          typeof item === 'string' ? item : item ? String(item) : '',
        )
      : [];

    const cleanedMemberIds = memberUserIds.filter(Boolean);

    return {
      householdId,
      householdName:
        typeof payload.household_name === 'string'
          ? payload.household_name
          : typeof payload.householdName === 'string'
            ? payload.householdName
            : typeof payload.name === 'string'
              ? payload.name
              : null,
      role: normalizeRole(payload.role),
      memberUserIds: cleanedMemberIds,
      memberCount:
        typeof payload.member_count === 'number' && Number.isFinite(payload.member_count)
          ? payload.member_count
          : cleanedMemberIds.length,
    };
  } catch (error) {
    throw toFriendlyError(error, 'Gagal memuat data household.');
  }
}

async function fetchMembersFrom(table: string, householdId: string) {
  const { data, error } = await supabase
    .from(table)
    .select('id, household_id, user_id, username, role, status, created_at')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true });

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  if (!data) return [];

  return data.map((row: any) => ({
    id: String(row.id ?? row.member_id ?? crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)),
    householdId: String(row.household_id ?? householdId),
    userId: normalizeUuid(row.user_id ?? row.member_user_id ?? row.userId),
    username: normalizeUsername(row.username ?? row.member_username),
    role: normalizeRole(row.role),
    status: normalizeStatus(row.status),
    createdAt: typeof row.created_at === 'string' ? row.created_at : null,
  }));
}

export async function listMembers(householdId: string): Promise<HouseholdMember[]> {
  if (!householdId) return [];
  try {
    const fromView = await fetchMembersFrom('household_members_view', householdId);
    if (fromView) {
      return fromView;
    }
  } catch (error) {
    if ((error as PostgrestError)?.code !== 'PGRST116') {
      throw toFriendlyError(error, 'Gagal memuat anggota household.');
    }
  }

  try {
    const fallback = await fetchMembersFrom('household_members', householdId);
    if (fallback) {
      return fallback;
    }
  } catch (error) {
    throw toFriendlyError(error, 'Gagal memuat anggota household.');
  }

  return [];
}

export async function inviteByUsername(
  householdId: string,
  username: string,
  role: HouseholdRole,
): Promise<InviteResult> {
  if (!householdId) {
    throw new Error('Household belum dipilih.');
  }
  if (!username) {
    throw new Error('Username wajib diisi.');
  }
  try {
    const normalizedUsername = username.trim().toLowerCase();
    const { data, error } = await supabase.rpc('create_or_invite_member_by_username', {
      household_id: householdId,
      username: normalizedUsername,
      role,
    });
    if (error) throw error;

    const payload = Array.isArray(data) ? data[0] : data;
    const status = normalizeStatus(payload?.status);
    let member: HouseholdMember | null = null;
    if (payload) {
      member = {
        id: normalizeUuid(payload.id) ?? crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
        householdId,
        userId: normalizeUuid(payload.user_id),
        username: normalizeUsername(payload.username) ?? normalizedUsername,
        role: normalizeRole(payload.role ?? role),
        status,
        createdAt: typeof payload.created_at === 'string' ? payload.created_at : null,
      };
    }

    return { status, member };
  } catch (error) {
    throw toFriendlyError(error, 'Gagal mengundang anggota.');
  }
}

export async function updateMemberRole(memberId: string, role: HouseholdRole): Promise<void> {
  if (!memberId) {
    throw new Error('Anggota tidak ditemukan.');
  }
  try {
    const { error } = await supabase
      .from('household_members')
      .update({ role })
      .eq('id', memberId);
    if (error) throw error;
  } catch (error) {
    throw toFriendlyError(error, 'Gagal memperbarui peran anggota.');
  }
}

export async function removeMember(memberId: string): Promise<void> {
  if (!memberId) {
    throw new Error('Anggota tidak ditemukan.');
  }
  try {
    const { error } = await supabase
      .from('household_members')
      .delete()
      .eq('id', memberId);
    if (error) throw error;
  } catch (error) {
    throw toFriendlyError(error, 'Gagal menghapus anggota.');
  }
}

export async function leaveHousehold(): Promise<void> {
  try {
    const { error } = await supabase.rpc('leave_household');
    if (error) throw error;
  } catch (error) {
    throw toFriendlyError(error, 'Gagal keluar dari household.');
  }
}

export async function deleteHousehold(householdId: string): Promise<void> {
  if (!householdId) {
    throw new Error('Household tidak ditemukan.');
  }
  try {
    const { error } = await supabase.rpc('delete_household', {
      household_id: householdId,
    });
    if (error) throw error;
  } catch (error) {
    throw toFriendlyError(error, 'Gagal menghapus household.');
  }
}
