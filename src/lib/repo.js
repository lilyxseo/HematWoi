export class CloudRepo {
  constructor(client) {
    this.client = client;
  }
  profile = {
    get: async () => {
      const { data } = await this.client.auth.getUser();
      const user = data?.user;
      if (!user) return {};
      const { data: profile } = await this.client
        .from("profile")
        .select("name,bio,avatarUrl")
        .eq("id", user.id)
        .single();
      return { email: user.email, ...(profile || {}) };
    },
    update: async (data) => {
      const { data: userData } = await this.client.auth.getUser();
      const user = userData?.user;
      if (!user) throw new Error("Not authenticated");
      const { error } = await this.client
        .from("profile")
        .upsert({ id: user.id, ...data });
      if (error) throw error;
      return { ...data };
    },
  };
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
    addSaving: async (id, amount) => {
      const { data } = await this.client.from('goals').select('saved').eq('id', id).single();
      const saved = (data?.saved || 0) + amount;
      await this.client.from('goals').update({ saved }).eq('id', id);
      return saved;
    },
  };
}

const LS_KEY = 'hw:localRepo';

export class LocalRepo {
  constructor() {
    const raw = localStorage.getItem(LS_KEY);
    this.db = raw
      ? JSON.parse(raw)
      : { goals: [], transactions: [], budgets: [], categories: [], subscriptions: [], challenges: [], profile: { badges: [], stats: {} } };
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
    addSaving: async (id, amount) => {
      this.db.goals = this.db.goals.map((g) =>
        g.id === id
          ? {
              ...g,
              saved: (g.saved || 0) + amount,
              history: [...(g.history || []), { amount, date: new Date().toISOString() }],
            }
          : g
      );
      this._save();
      return this.db.goals.find((g) => g.id === id).saved;
    },
  };
  profile = {
    get: async () => this.db.profile,
    update: async (data) => {
      this.db.profile = { ...this.db.profile, ...data };
      this._save();
      return this.db.profile;
    },
  };
  seedDummy() {
    if (this.db.goals.length) return;
    this.db.goals = [
      { id: crypto.randomUUID(), name: 'Dana Darurat', target: 1000000, saved: 200000, history: [] },
    ];
    this._save();
  }
}
