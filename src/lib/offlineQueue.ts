import localforage from 'localforage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { MovementInput } from './types';
import { createMovement } from './api';

type OfflineQueueState = {
  queue: MovementInput[];
  enqueue: (movement: MovementInput) => Promise<void>;
  flush: () => Promise<{ success: number; failure: number; total: number }>;
};

export const useOfflineQueueStore = create(
  persist<OfflineQueueState>(
    (set, get) => ({
      queue: [],
      enqueue: async (movement) => {
        set((state) => ({ queue: [...state.queue, movement] }));
      },
      flush: async () => {
        const { queue } = get();
        if (!queue.length) {
          return { success: 0, failure: 0, total: 0 };
        }
        let success = 0;
        let failure = 0;
        const remaining: MovementInput[] = [];
        for (const movement of queue) {
          try {
            await createMovement(movement);
            success += 1;
          } catch (error) {
            console.error('Failed to flush movement', error);
            failure += 1;
            remaining.push(movement);
          }
        }
        set({ queue: remaining });
        return { success, failure, total: queue.length };
      }
    }),
    {
      name: 'wms-offline-queue',
      storage: createJSONStorage(() => localforage)
    }
  )
);

export const enqueueMovement = async (movement: MovementInput) => {
  const payload: MovementInput = {
    ...movement,
    id: movement.id ?? crypto.randomUUID(),
    ts: movement.ts ?? new Date().toISOString()
  };
  await useOfflineQueueStore.getState().enqueue(payload);
};

export const flushQueue = () => useOfflineQueueStore.getState().flush();
