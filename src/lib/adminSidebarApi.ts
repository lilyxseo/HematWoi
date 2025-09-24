import type { PostgrestSingleResponse } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type SidebarAccessLevel = 'public' | 'user' | 'admin';

export type SidebarItemRecord = {
  id: string;
  title: string;
  route: string;
  access_level: SidebarAccessLevel;
  is_enabled: boolean;
  icon_name: string | null;
  position: number;
};

export type CreateSidebarItemInput = {
  title: string;
  route: string;
  access_level: SidebarAccessLevel;
  is_enabled: boolean;
  icon_name?: string | null;
  position?: number;
};

export type UpdateSidebarItemInput = Partial<
  Pick<SidebarItemRecord, 'title' | 'route' | 'access_level' | 'is_enabled' | 'icon_name' | 'position'>
>;

type Nullable<T> = T | null | undefined;

type SidebarRow = {
  id?: Nullable<string>;
  title?: Nullable<string>;
  route?: Nullable<string>;
  access_level?: Nullable<SidebarAccessLevel>;
  is_enabled?: Nullable<boolean | string | number>;
  icon_name?: Nullable<string>;
  position?: Nullable<number | string>;
};

function ensureResponse<T>(response: PostgrestSingleResponse<T>): T {
  if (response.error) {
    throw response.error;
  }
  return response.data as T;
}

function toBoolean(value: Nullable<boolean | string | number>, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value === 'true' || value === '1';
  return fallback;
}

function toNumber(value: Nullable<number | string>, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function normalizeRoute(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const withoutLeadingSlash = trimmed.replace(/^\/+/, '');
  return `/${withoutLeadingSlash}`;
}

function mapSidebarRow(row: SidebarRow): SidebarItemRecord {
  const id = row.id ?? row.route ?? crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
  const route = row.route ? normalizeRoute(String(row.route)) : '/';
  return {
    id: String(id),
    title: String(row.title ?? '').trim(),
    route,
    access_level: (row.access_level as SidebarAccessLevel) ?? 'public',
    is_enabled: toBoolean(row.is_enabled, true),
    icon_name: row.icon_name ? String(row.icon_name).trim() || null : null,
    position: toNumber(row.position, 0),
  };
}

export async function listSidebarItems(): Promise<SidebarItemRecord[]> {
  const { data, error } = await supabase
    .from('app_sidebar_items')
    .select('id, title, route, access_level, is_enabled, icon_name, position')
    .order('position', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapSidebarRow(row)).sort((a, b) => a.position - b.position);
}

export async function createSidebarItem(payload: CreateSidebarItemInput): Promise<SidebarItemRecord> {
  const insertPayload = {
    title: payload.title,
    route: normalizeRoute(payload.route),
    access_level: payload.access_level,
    is_enabled: payload.is_enabled,
    icon_name: payload.icon_name ?? null,
    position: payload.position ?? null,
  };

  const response = await supabase
    .from('app_sidebar_items')
    .insert(insertPayload)
    .select('id, title, route, access_level, is_enabled, icon_name, position')
    .single();

  const data = ensureResponse(response);
  return mapSidebarRow(data as SidebarRow);
}

export async function updateSidebarItem(
  id: string,
  patch: UpdateSidebarItemInput
): Promise<SidebarItemRecord> {
  const updatePayload: Record<string, unknown> = {};
  if (typeof patch.title === 'string') {
    updatePayload.title = patch.title;
  }
  if (typeof patch.route === 'string') {
    updatePayload.route = normalizeRoute(patch.route);
  }
  if (typeof patch.access_level === 'string') {
    updatePayload.access_level = patch.access_level;
  }
  if (typeof patch.is_enabled === 'boolean') {
    updatePayload.is_enabled = patch.is_enabled;
  }
  if ('icon_name' in patch) {
    updatePayload.icon_name = patch.icon_name ?? null;
  }
  if (typeof patch.position === 'number') {
    updatePayload.position = patch.position;
  }

  const response = await supabase
    .from('app_sidebar_items')
    .update(updatePayload)
    .eq('id', id)
    .select('id, title, route, access_level, is_enabled, icon_name, position')
    .single();

  const data = ensureResponse(response);
  return mapSidebarRow(data as SidebarRow);
}

export async function deleteSidebarItem(id: string): Promise<void> {
  const { error } = await supabase.from('app_sidebar_items').delete().eq('id', id);
  if (error) {
    throw error;
  }
}

export async function moveSidebarItem(
  id: string,
  direction: 'up' | 'down'
): Promise<SidebarItemRecord[] | null> {
  const { data, error } = await supabase
    .from('app_sidebar_items')
    .select('id, position')
    .order('position', { ascending: true });

  if (error) {
    throw error;
  }

  const rows = data ?? [];
  const index = rows.findIndex((item) => String(item.id) === id);
  if (index === -1) {
    return null;
  }

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= rows.length) {
    return null;
  }

  const current = rows[index];
  const neighbor = rows[targetIndex];

  const currentPosition = toNumber(current.position, index + 1);
  const neighborPosition = toNumber(neighbor.position, targetIndex + 1);

  const { error: updateCurrentError } = await supabase
    .from('app_sidebar_items')
    .update({ position: neighborPosition })
    .eq('id', current.id);

  if (updateCurrentError) {
    throw updateCurrentError;
  }

  const { error: updateNeighborError } = await supabase
    .from('app_sidebar_items')
    .update({ position: currentPosition })
    .eq('id', neighbor.id);

  if (updateNeighborError) {
    throw updateNeighborError;
  }

  return await listSidebarItems();
}
