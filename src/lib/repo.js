export class CloudRepo {
  constructor(client) {
    this.client = client;
  }
  goals = {
    list: async () => {
      const { data } = await this.client.from('goals').select('*');
      return data || [];
    },
    add: async (goal) => {
      await this.client.from('goals').insert(goal);
      return goal;
    },
    update: async (id, data) => {
      await this.client.from('goals').update(data).eq('id', id);
    },
    remove: async (id) => {
      await this.client.from('goals').delete().eq('id', id);
    },
  };
}

const LS_KEY = 'hw:localRepo';

export class LocalRepo {
  constructor() {
    const raw = localStorage.getItem(LS_KEY);
    this.db = raw
      ? JSON.parse(raw)
      : { goals: [], transactions: [], budgets: [], categories: [], subscriptions: [], challenges: [], profile: {} };
  }
  _save() {
    localStorage.setItem(LS_KEY, JSON.stringify(this.db));
  }
  goals = {
    list: async () => this.db.goals,
    add: async (goal) => {
      this.db.goals.push(goal);
      this._save();
      return goal;
    },
    update: async (id, data) => {
      this.db.goals = this.db.goals.map((g) => (g.id === id ? { ...g, ...data } : g));
      this._save();
    },
    remove: async (id) => {
      this.db.goals = this.db.goals.filter((g) => g.id !== id);
      this._save();
    },
  };
  seedDummy() {
    if (this.db.goals.length) return;
    this.db.goals = [
      { id: crypto.randomUUID(), name: 'Dana Darurat', target: 1000000, allocated: 200000 },
    ];
    this._save();
  }
}
