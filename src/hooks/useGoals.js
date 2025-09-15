import { useCallback, useEffect, useState } from 'react';
import { useRepo } from '../context/DataContext';

export default function useGoals() {
  const repo = useRepo();
  const [goals, setGoals] = useState([]);

  useEffect(() => {
    repo.goals.list().then(setGoals);
  }, [repo]);

  const addGoal = useCallback(async (goal) => {
    await repo.goals.add(goal);
    setGoals((g) => [...g, goal]);
  }, [repo]);

  const updateGoal = useCallback(async (id, data) => {
    await repo.goals.update(id, data);
    setGoals((g) => g.map((it) => (it.id === id ? { ...it, ...data } : it)));
  }, [repo]);

  const deleteGoal = useCallback(async (id) => {
    await repo.goals.remove(id);
    setGoals((g) => g.filter((it) => it.id !== id));
  }, [repo]);

  const addSaving = useCallback(async (id, amount) => {
    const saved = await repo.goals.addSaving(id, amount);
    setGoals((g) => g.map((it) =>
      it.id === id
        ? {
            ...it,
            saved,
            history: [...(it.history || []), { amount, date: new Date().toISOString() }],
          }
        : it
    ));
  }, [repo]);

  return { goals, addGoal, updateGoal, deleteGoal, addSaving };
}
