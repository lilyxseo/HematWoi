import { IRepo, ICrud, IGoalsRepo, IProfileRepo } from '../interfaces/IRepo';

export class CloudRepo implements IRepo {
  client: any;
  private userScopedTables = new Set([
    'transactions',
    'budgets',
    'categories',
    'subscriptions',
    'challenges',
    'goals',
  ]);
  constructor(client: any) {
    this.client = client;
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
    return { ...item, user_id: item.user_id ?? userId };
  }

  private table<T>(name: string): ICrud<T> {
    return {
      list: async () => {
        let query = this.client.from(name).select('*');
        query = await this.withUserScope(query, name);
        const { data } = await query;
        return (data || []) as T[];
      },
      add: async (item: T) => {
        const payload = await this.ensureUserPayload(name, item);
        const { data } = await this.client.from(name).insert(payload).select().single();
        return (data as T) || (payload as T);
      },
      update: async (id: string | number, data: Partial<T>) => {
        let query = this.client.from(name).update(data).eq('id', id);
        query = await this.withUserScope(query, name);
        await query;
      },
      remove: async (id: string | number) => {
        let query = this.client.from(name).delete().eq('id', id);
        query = await this.withUserScope(query, name);
        await query;
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
      const { data } = await this.client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      return data || {};
    },
    update: async (data: any) => {
      const userId = await this.getUserId();
      if (!userId) return;
      await this.client.from('profiles').update(data).eq('id', userId);
    },
  };

  goals: IGoalsRepo = {
    ...this.table('goals'),
    addSaving: async (id: string | number, amount: number) => {
      const userId = await this.getUserId();
      if (!userId) throw new Error('User not authenticated');
      const { data } = await this.client
        .from('goals')
        .select('saved')
        .eq('id', id)
        .eq('user_id', userId)
        .single();
      const saved = (data?.saved || 0) + amount;
      await this.client
        .from('goals')
        .update({ saved })
        .eq('id', id)
        .eq('user_id', userId);
      return saved;
    },
  };
}
