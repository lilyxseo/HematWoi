import { describe, it, expect } from 'vitest';
import { LocalRepo } from '../repo/LocalRepo';

// simple in-memory localStorage polyfill
globalThis.localStorage = {
  store: {},
  getItem(k) {
    return this.store[k] || null;
  },
  setItem(k, v) {
    this.store[k] = String(v);
  },
  removeItem(k) {
    delete this.store[k];
  },
};

describe('LocalRepo', () => {
  it('seeds dummy goals', async () => {
    const repo = new LocalRepo();
    repo.seedDummy();
    const goals = await repo.goals.list();
    expect(goals.length).toBeGreaterThan(0);
    expect(goals[0].saved).toBeDefined();
  });
});
