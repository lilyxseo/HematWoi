import { useEffect, useState } from "react";
import EventBus from "../lib/eventBus";
import { evaluateChallenge } from "../lib/challenges.js";
import { useToast } from "../context/ToastContext.jsx";

const STORAGE_KEY = "hematwoi:v3:challenges";

export default function useChallenges(txs = []) {
  const [challenges, setChallenges] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  });
  const { addToast } = useToast();

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(challenges));
  }, [challenges]);

  useEffect(() => {
    setChallenges((prev) =>
      prev.map((c) => {
        if (c.status !== "active") return c;
        const { status, progress } = evaluateChallenge(c, txs);
        let updated = { ...c, status, progress, completed: status === "completed" };
        if (c.status === "active" && status === "completed" && c.rewardXP) {
          EventBus.emit("xp:add", { code: "challenge", amount: c.rewardXP });
        }
        return updated;
      })
    );
  }, [txs]);

  useEffect(() => {
    const todayStr = new Date().toDateString();
    setChallenges((prev) =>
      prev.map((c) => {
        if (!c.reminder || c.status !== "active") return c;
        if (c.lastReminder === todayStr) return c;
        addToast({ message: `Jangan lupa challenge: ${c.title}` });
        return { ...c, lastReminder: todayStr };
      })
    );
  }, [addToast]);

  const addChallenge = (challenge) => {
    setChallenges((prev) => [...prev, challenge]);
  };

  const updateChallenge = (id, updates) => {
    setChallenges((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const removeChallenge = (id) => {
    setChallenges((prev) => prev.filter((c) => c.id !== id));
  };

  return { challenges, addChallenge, updateChallenge, removeChallenge };
}
