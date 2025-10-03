import { IRepo, ICrud, IGoalsRepo, IProfileRepo } from '../interfaces/IRepo';

export class CloudRepo implements IRepo {
  client: any;
  private userScopedTables = new Set([
    'transactions',
    'accounts',
    'budgets',
    'categories',
    'subscriptions',
    'challenges',
    'goals',
  ]);
  constructor(client: any) {
    this.client = client;
  }

  private async runQuery<T>(
    query: Promise<{ data: T; error: any }>,
    table: string,
    action: string
  ): Promise<T> {
    const { data, error } = await query;
    if (error) {
      console.error(`[CloudRepo] Failed to ${action} ${table}`, error);
      throw error;
    }
    return data;
  }

  private async getUserId(): Promise<string | null> {
    const { data, error } = await this.client.auth.getUser();
    if (error) throw error;
    return data.user?.id ?? null;
  }

  private async withUserScope(query: any, name: string) {
    if (!this.userScopedTables.has(name)) return query;
    const userId = await this.getUserId();
    if (!userId) return query.eq('user_id', '__none__');
    return query.eq('user_id', userId);
  }

  private async ensureUserPayload(name: string, item: any) {
    if (!this.userScopedTables.has(name)) return item;
    const userId = await this.getUserId();
    if (!userId) throw new Error('User not authenticated');
    const payload = { ...item, user_id: item.user_id ?? userId };
    if (name === 'accounts') {
      if (Object.prototype.hasOwnProperty.call(payload, 'name')) {
        const trimmed = typeof payload.name === 'string' ? payload.name.trim() : '';
        if (!trimmed) {
          delete payload.name;
        } else {
          payload.name = trimmed;
        }
      }
    }
    return payload;
  }

  private table<T>(name: string): ICrud<T> {
    return {
      list: async () => {
        let query = this.client.from(name).select('*');
        query = await this.withUserScope(query, name);
        const data = await this.runQuery<any>(query, name, 'list');
        return (data || []) as T[];
      },
      add: async (item: T) => {
        const payload = await this.ensureUserPayload(name, item);
        const data = await this.runQuery<any>(
          this.client.from(name).insert(payload).select().single(),
          name,
          'insert into'
        );
        return (data as T) || (payload as T);
      },
      update: async (id: string | number, data: Partial<T>) => {
        const payload = await this.ensureUserPayload(name, data);
        const updates = Object.fromEntries(
          Object.entries(payload).filter(([, value]) => value !== undefined),
        );
        if (Object.keys(updates).length === 0) {
          return;
        }
        let query = this.client.from(name).update(updates).eq('id', id);
        query = await this.withUserScope(query, name);
        await this.runQuery<any>(query, name, 'update');
      },
      remove: async (id: string | number) => {
        let query = this.client.from(name).delete().eq('id', id);
        query = await this.withUserScope(query, name);
        await this.runQuery<any>(query, name, 'delete from');
      },
    };
  }

  transactions = this.table('transactions');
  budgets = this.table('budgets');
  categories = this.table('categories');
  subscriptions = this.table('subscriptions');
  challenges = this.table('challenges');

  profile: IProfileRepo = {
    get: async () => {
      const userId = await this.getUserId();
      if (!userId) return {};
      const data = await this.runQuery<any>(
        this.client.from('profiles').select('*').eq('id', userId).maybeSingle(),
        'profiles',
        'load'
      );
      return data || {};
    },
    update: async (data: any) => {
      const userId = await this.getUserId();
      if (!userId) return;
      await this.runQuery<any>(
        this.client.from('profiles').update(data).eq('id', userId),
        'profiles',
        'update'
      );
    },
  };

  goals: IGoalsRepo = {
    ...this.table('goals'),
    addSaving: async (id: string | number, amount: number) => {
      const userId = await this.getUserId();
      if (!userId) throw new Error('User not authenticated');
      const existing = await this.runQuery<any>(
        this.client.from('goals').select('saved').eq('id', id).eq('user_id', userId).single(),
        'goals',
        'fetch savings for'
      );
      const saved = (existing?.saved || 0) + amount;
      await this.runQuery<any>(
        this.client.from('goals').update({ saved }).eq('id', id).eq('user_id', userId),
        'goals',
        'update savings for'
      );
      return saved;
    },
  };
}
