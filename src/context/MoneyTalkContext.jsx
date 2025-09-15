import { createContext, useCallback, useContext, useRef, useState } from "react";
import MoneyTalkBubble from "../components/MoneyTalkBubble";
import { quotes, tips, special } from "../lib/moneyTalkContent";

const MoneyTalkContext = createContext({ speak: () => {} });

export function useMoneyTalk() {
  return useContext(MoneyTalkContext);
}

export default function MoneyTalkProvider({ prefs = {}, children }) {
  const [current, setCurrent] = useState(null);
  const queue = useRef([]);
  const lastShown = useRef([]);

  const handleDismiss = useCallback(() => {
    setCurrent(null);
  }, []);

  const process = useCallback(() => {
    if (current || !queue.current.length) return;
    const now = Date.now();
    lastShown.current = lastShown.current.filter((t) => now - t < 60000);
    const maxPerMin =
      prefs.moneyTalkIntensity === "jarang"
        ? 1
        : prefs.moneyTalkIntensity === "ramai"
        ? 3
        : 2;
    if (lastShown.current.length >= maxPerMin) return;
    const next = queue.current.shift();
    setCurrent(next);
    lastShown.current.push(now);
    setTimeout(() => {
      handleDismiss();
      process();
    }, next.duration || 5000);
  }, [current, prefs.moneyTalkIntensity, handleDismiss]);

  const speak = useCallback(
    ({ category, amount, context = {} }) => {
      if (!prefs.moneyTalkEnabled) return;
      const chanceMap = { jarang: 0.3, normal: 0.7, ramai: 1 };
      if (Math.random() > (chanceMap[prefs.moneyTalkIntensity] || 0.7)) return;
      const lang = prefs.moneyTalkLang || "id";
      let message = "";
      if (context.isSavings) message = special[lang].savings;
      else if (context.isOverBudget) message = special[lang].overbudget;
      else if (context.isHigh) message = special[lang].high;
      else {
        const list = quotes[lang]?.[category] || [];
        if (!list.length) return;
        message = list[Math.floor(Math.random() * list.length)];
      }
      const tipList = tips[lang]?.[category] || [];
      const tip = tipList.length
        ? tipList[Math.floor(Math.random() * tipList.length)]
        : "";
      queue.current.push({
        id:
          globalThis.crypto?.randomUUID?.() ||
          Math.random().toString(36).slice(2),
        message,
        tip,
        avatar: Math.random() > 0.5 ? "bill" : "coin",
        duration: 4000 + Math.random() * 2000,
      });
      if (queue.current.length > 3) queue.current.splice(3);
      process();
    },
    [prefs.moneyTalkEnabled, prefs.moneyTalkIntensity, prefs.moneyTalkLang, process]
  );

  return (
    <MoneyTalkContext.Provider value={{ speak }}>
      {children}
      {current && (
        <MoneyTalkBubble
          key={current.id}
          message={current.message}
          tip={current.tip}
          avatar={current.avatar}
          onDismiss={() => {
            handleDismiss();
            process();
          }}
        />
      )}
    </MoneyTalkContext.Provider>
  );
}
