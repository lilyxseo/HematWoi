import { useContext, useEffect, useRef, useCallback } from "react";
import { UserProfileContext, LEVEL_BASE } from "../context/UserProfileContext.jsx";
import EventBus from "../lib/eventBus";

export default function useLeveling({ transactions = [], insights = {}, challenges = [] } = {}) {
  const { profile, addXP } = useContext(UserProfileContext);
  const txnRef = useRef(transactions.length);
  const challengeRef = useRef(challenges.filter((c) => c.completed).length);

  const manualAddXP = useCallback(
    (code, amount = 0) => {
      addXP(amount);
    },
    [addXP]
  );

  useEffect(() => {
    const handler = ({ code, amount }) => manualAddXP(code, amount);
    const unsubscribe = EventBus.on("xp:add", handler);
    return unsubscribe;
  }, [manualAddXP]);

  useEffect(() => {
    if (transactions.length > txnRef.current) {
      const diff = transactions.length - txnRef.current;
      manualAddXP("transaction", diff * 5);
      txnRef.current = transactions.length;
    }
  }, [transactions, manualAddXP]);

  useEffect(() => {
    if (insights?.weeklySavingDelta >= 0.1) {
      manualAddXP("weekly_saving", 20);
    }
  }, [insights?.weeklySavingDelta, manualAddXP]);

  useEffect(() => {
    const completed = challenges.filter((c) => c.completed).length;
    if (completed > challengeRef.current) {
      const diff = completed - challengeRef.current;
      manualAddXP("challenge", diff * 50);
      challengeRef.current = completed;
    }
  }, [challenges, manualAddXP]);

  const nextLevelXP = Math.pow(profile.level, 2) * LEVEL_BASE;
  const currentLevelBaseXP = Math.pow(profile.level - 1, 2) * LEVEL_BASE;
  const progress = profile.xp - currentLevelBaseXP;
  const needed = nextLevelXP - currentLevelBaseXP;

  return {
    xp: profile.xp,
    level: profile.level,
    progress,
    needed,
    nextLevelXP,
    addXP: manualAddXP,
  };
}
