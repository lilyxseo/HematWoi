import type { SupabaseClient } from '@supabase/supabase-js';
import { idbGet, idbGetAll, idbPut, idbStores } from './idb';

export type EntityName =
  | 'transactions'
  | 'categories'
  | 'accounts'
  | 'budgets'
  | 'goals'
  | 'debts'
  | 'subscriptions'
  | 'tags';

export interface DataDriver<T = any> {
  readonly mode: 'guest' | 'online';
  list(entity: EntityName): Promise<T[]>;
  get(entity: EntityName, clientId: string): Promise<T | null>;
  insert(entity: EntityName, payload: Partial<T> & Record<string, any>): Promise<T>;
  update(
    entity: EntityName,
    clientId: string,
    payload: Partial<T> & Record<string, any>,
  ): Promise<T>;
  softDelete(entity: EntityName, clientId: string): Promise<void>;
}

const SOFT_DELETE_TABLES = new Set<EntityName>([
  'transactions',
  'categories',
  'accounts',
  'budgets',
  'goals',
  'debts',
  'subscriptions',
]);

function nowISO() {
  return new Date().toISOString();
}

function ensureClientRecord(payload: Record<string, any>) {
  const clientId = payload.client_id ?? globalThis.crypto?.randomUUID?.();
  const result = {
    ...payload,
    client_id: clientId ?? Math.random().toString(36).slice(2),
  };
  if (!result.id) {
    result.id = result.client_id;
  }
  result.updated_at = payload.updated_at ?? nowISO();
  return result;
}

export class LocalDriver implements DataDriver {
  readonly mode = 'guest' as const;

  async list<T = any>(entity: EntityName): Promise<T[]> {
    if (!idbStores().includes(entity)) {
      return [];
    }
    const rows = await idbGetAll(entity);
    return rows.filter((row) => !row.deleted_at).map((row) => ({ ...row })) as T[];
  }

  async get<T = any>(entity: EntityName, clientId: string): Promise<T | null> {
    const value = await idbGet(entity, clientId);
    if (!value || value.deleted_at) return null;
    return { ...value } as T;
  }

  async insert<T = any>(
    entity: EntityName,
    payload: Partial<T> & Record<string, any>,
  ): Promise<T> {
    const value = ensureClientRecord({ ...payload });
    await idbPut(entity, value);
    return { ...value } as T;
  }

  async update<T = any>(
    entity: EntityName,
    clientId: string,
    payload: Partial<T> & Record<string, any>,
  ): Promise<T> {
    const existing = (await idbGet(entity, clientId)) ?? { client_id: clientId };
    const value = ensureClientRecord({ ...existing, ...payload, client_id: clientId });
    await idbPut(entity, value);
    return { ...value } as T;
  }

  async softDelete(entity: EntityName, clientId: string): Promise<void> {
    const existing = await idbGet(entity, clientId);
    if (!existing) {
      return;
    }
    const value = {
      ...existing,
      deleted_at: nowISO(),
      updated_at: nowISO(),
    };
    await idbPut(entity, value);
  }
}

export class CloudDriver implements DataDriver {
  readonly mode = 'online' as const;
  private client: SupabaseClient;
  private userId: string;

  constructor(client: SupabaseClient, userId: string) {
    this.client = client;
    this.userId = userId;
  }

  private ensureClientPayload(payload: Record<string, any>) {
    const result = ensureClientRecord(payload);
    result.user_id = this.userId;
    if (!result.updated_at) {
      result.updated_at = nowISO();
    }
    return result;
  }

  async list<T = any>(entity: EntityName): Promise<T[]> {
    let query = this.client
      .from(entity)
      .select('*')
      .eq('user_id', this.userId)
      .order('updated_at', { ascending: false });
    if (SOFT_DELETE_TABLES.has(entity)) {
      query = query.is('deleted_at', null);
    }
    const { data, error } = await query;
    if (error) {
      console.error(`[CloudDriver] Failed to list ${entity}`, error);
      throw error;
    }
    return (data ?? []) as T[];
  }

  async get<T = any>(entity: EntityName, clientId: string): Promise<T | null> {
    const { data, error } = await this.client
      .from(entity)
      .select('*')
      .eq('user_id', this.userId)
      .eq('client_id', clientId)
      .maybeSingle();
    if (error) {
      console.error(`[CloudDriver] Failed to get ${entity}`, error);
      throw error;
    }
    if (!data || (SOFT_DELETE_TABLES.has(entity) && data.deleted_at)) {
      return null;
    }
    return data as T;
  }

  async insert<T = any>(
    entity: EntityName,
    payload: Partial<T> & Record<string, any>,
  ): Promise<T> {
    const record = this.ensureClientPayload(payload);
    const { data, error } = await this.client
      .from(entity)
      .upsert(record, { onConflict: 'user_id,client_id' })
      .select()
      .maybeSingle();
    if (error) {
      console.error(`[CloudDriver] Failed to upsert ${entity}`, error);
      throw error;
    }
    return (data ?? record) as T;
  }

  async update<T = any>(
    entity: EntityName,
    clientId: string,
    payload: Partial<T> & Record<string, any>,
  ): Promise<T> {
    const record = this.ensureClientPayload({ ...payload, client_id: clientId });
    const { data, error } = await this.client
      .from(entity)
      .upsert(record, { onConflict: 'user_id,client_id' })
      .select()
      .maybeSingle();
    if (error) {
      console.error(`[CloudDriver] Failed to update ${entity}`, error);
      throw error;
    }
    return (data ?? record) as T;
  }

  async softDelete(entity: EntityName, clientId: string): Promise<void> {
    if (!SOFT_DELETE_TABLES.has(entity)) {
      const { error: deleteError } = await this.client
        .from(entity)
        .delete()
        .eq('user_id', this.userId)
        .eq('client_id', clientId);
      if (deleteError) {
        console.error(`[CloudDriver] Failed to delete ${entity}`, deleteError);
        throw deleteError;
      }
      return;
    }
    const { error } = await this.client
      .from(entity)
      .upsert(
        {
          user_id: this.userId,
          client_id: clientId,
          deleted_at: nowISO(),
          updated_at: nowISO(),
        },
        { onConflict: 'user_id,client_id' },
      );
    if (error) {
      console.error(`[CloudDriver] Failed to soft delete ${entity}`, error);
      throw error;
    }
  }
}

