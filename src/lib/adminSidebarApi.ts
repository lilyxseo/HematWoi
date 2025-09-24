import type { PostgrestSingleResponse } from '@supabase/supabase-js';
import { supabase } from './supabase';

type SidebarAccessLevel = 'public' | 'user' | 'admin';

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
  id?: string;
  title: string;
  route: string;
  access_level: SidebarAccessLevel;
  is_enabled: boolean;
  icon_name?: string | null;
  position: number;
};

export type UpdateSidebarItemInput = Partial<Omit<SidebarItemRecord, 'id'>>;

function ensureResponse<T>(response: PostgrestSingleResponse<T>): T {
  if (response.error) {
    throw response.error;
  }
  return response.data as T;
}

function sanitizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value == null) return fallback;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value === 'true' || value === '1';
  return fallback;
}

function sanitizeNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function normalizeIcon(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return null;
}

function mapSidebarRow(row: any): SidebarItemRecord {
  return {
    id:
      String(row?.id ?? row?.route ?? globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)),
    title: String(row?.title ?? ''),
    route: String(row?.route ?? ''),
    access_level:
      row?.access_level === 'admin'
        ? 'admin'
        : row?.access_level === 'user'
          ? 'user'
          : 'public',
    is_enabled: sanitizeBoolean(row?.is_enabled, true),
    icon_name: normalizeIcon(row?.icon_name),
    position: sanitizeNumber(row?.position, 0),
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

  return (data ?? []).map((item) => mapSidebarRow(item));
}

export async function createSidebarItem(
  input: CreateSidebarItemInput
): Promise<SidebarItemRecord> {
  const payload: Record<string, unknown> = {
    title: input.title,
    route: input.route,
    access_level: input.access_level,
    is_enabled: input.is_enabled,
    position: input.position,
    icon_name: normalizeIcon(input.icon_name),
  };

  if (input.id) {
    payload.id = input.id;
  }

  const response = await supabase
    .from('app_sidebar_items')
    .insert(payload)
    .select('id, title, route, access_level, is_enabled, icon_name, position')
    .single();

  const data = ensureResponse(response);
  return mapSidebarRow(data);
}

export async function updateSidebarItem(
  id: string,
  patch: UpdateSidebarItemInput
): Promise<SidebarItemRecord> {
  const payload: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(patch, 'title')) {
    payload.title = patch.title;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'route')) {
    payload.route = patch.route;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'access_level')) {
    payload.access_level = patch.access_level;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'is_enabled')) {
    payload.is_enabled = patch.is_enabled;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'position')) {
    payload.position = patch.position;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'icon_name')) {
    payload.icon_name = normalizeIcon(patch.icon_name);
  }

  const response = await supabase
    .from('app_sidebar_items')
    .update(payload)
    .eq('id', id)
    .select('id, title, route, access_level, is_enabled, icon_name, position')
    .single();

  const data = ensureResponse(response);
  return mapSidebarRow(data);
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
): Promise<SidebarItemRecord[]> {
  const { data: current, error: currentError } = await supabase
    .from('app_sidebar_items')
    .select('id, position')
    .eq('id', id)
    .maybeSingle();

  if (currentError) {
    throw currentError;
  }

  if (!current) {
    return listSidebarItems();
  }

  const query = supabase
    .from('app_sidebar_items')
    .select('id, position')
    .limit(1);

  const neighborQuery =
    direction === 'up'
      ? query.lt('position', current.position).order('position', { ascending: false })
      : query.gt('position', current.position).order('position', { ascending: true });

  const { data: neighbor, error: neighborError } = await neighborQuery.maybeSingle();

  if (neighborError) {
    throw neighborError;
  }

  if (!neighbor) {
    return listSidebarItems();
  }

  const firstUpdate = await supabase
    .from('app_sidebar_items')
    .update({ position: neighbor.position })
    .eq('id', current.id);

  if (firstUpdate.error) {
    throw firstUpdate.error;
  }

  const secondUpdate = await supabase
    .from('app_sidebar_items')
    .update({ position: current.position })
    .eq('id', neighbor.id);

  if (secondUpdate.error) {
    throw secondUpdate.error;
  }

  return listSidebarItems();
}
