import { IRepo, ICrud, IGoalsRepo, IProfileRepo } from '../interfaces/IRepo';

export class CloudRepo implements IRepo {
  client: any;
  constructor(client: any) {
    this.client = client;
  }

  private table<T>(name: string): ICrud<T> {
    return {
      list: async () => {
        const { data } = await this.client.from(name).select('*');
        return data || [];
      },
      add: async (item: T) => {
        await this.client.from(name).insert(item);
        return item;
      },
      update: async (id: string | number, data: Partial<T>) => {
        await this.client.from(name).update(data).eq('id', id);
      },
      remove: async (id: string | number) => {
        await this.client.from(name).delete().eq('id', id);
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
      const { data } = await this.client.from('profiles').select('*').single();
      return data || {};
    },
    update: async (data: any) => {
      await this.client.from('profiles').update(data).eq('id', data.id);
    },
  };

  goals: IGoalsRepo = {
    ...this.table('goals'),
    addSaving: async (id: string | number, amount: number) => {
      const { data } = await this.client.from('goals').select('saved').eq('id', id).single();
      const saved = (data?.saved || 0) + amount;
      await this.client.from('goals').update({ saved }).eq('id', id);
      return saved;
    },
  };
}
