import { IRepo, ICrud, IGoalsRepo, IProfileRepo } from '../interfaces/IRepo';
import { dummySeed } from '../lib/dummySeed';

const LS_KEY = 'hw:localRepo';

export class LocalRepo implements IRepo {
  db: any;
  constructor() {
    const raw = globalThis.localStorage?.getItem(LS_KEY);
    this.db = raw
      ? JSON.parse(raw)
      : {
          transactions: [],
          budgets: [],
          categories: [],
          subscriptions: [],
          goals: [],
          profile: {},
          challenges: [],
        };
  }

  private save() {
    globalThis.localStorage?.setItem(LS_KEY, JSON.stringify(this.db));
  }

  private table<T extends { id: string | number }>(key: keyof LocalRepo['db']): ICrud<T> {
    return {
      list: async () => this.db[key] as T[],
      add: async (item: T) => {
        (this.db[key] as T[]).push(item);
        this.save();
        return item;
      },
      update: async (id: string | number, data: Partial<T>) => {
        this.db[key] = (this.db[key] as T[]).map((i: any) =>
          i.id === id ? { ...i, ...data } : i
        );
        this.save();
      },
      remove: async (id: string | number) => {
        this.db[key] = (this.db[key] as T[]).filter((i: any) => i.id !== id);
        this.save();
      },
    };
  }

  transactions = this.table('transactions');
  budgets = this.table('budgets');
  categories = this.table('categories');
  subscriptions = this.table('subscriptions');
  challenges = this.table('challenges');

  profile: IProfileRepo = {
    get: async () => this.db.profile,
    update: async (data: any) => {
      this.db.profile = { ...this.db.profile, ...data };
      this.save();
    },
  };

  goals: IGoalsRepo = {
    ...this.table('goals'),
    addSaving: async (id: string | number, amount: number) => {
      this.db.goals = this.db.goals.map((g: any) =>
        g.id === id
          ? {
              ...g,
              saved: (g.saved || 0) + amount,
              history: [
                ...(g.history || []),
                { amount, date: new Date().toISOString() },
              ],
            }
          : g
      );
      this.save();
      return this.db.goals.find((g: any) => g.id === id).saved;
    },
  };

  seedDummy() {
    const data = dummySeed();
    Object.assign(this.db, data);
    this.save();
  }
}
