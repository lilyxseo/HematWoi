import { createContext, useCallback, useContext, useRef, useState, useEffect } from "react";
import MoneyTalkBubble from "../components/MoneyTalkBubble";
import { quotes, tips, special, amountReactions } from "../lib/moneyTalkContent";
import { createMoneyTalkLimiter } from "../lib/moneyTalkQueue";
import { formatCurrency } from "../lib/format";

const amountThresholds = [
  { level: "huge", min: 2_000_000 },
  { level: "large", min: 500_000 },
  { level: "medium", min: 200_000 },
  { level: "small", min: 50_000 },
  { level: "tiny", min: 0 },
];

const typeLabels = {
  expense: { id: "pengeluaran", en: "spending" },
  income: { id: "pemasukan", en: "income" },
  transfer: { id: "transfer", en: "transfer" },
};

const typeEmojis = {
  expense: "💸",
  income: "🪄",
  transfer: "🔁",
};

function determineAmountLevel(amount) {
  const value = Math.abs(Number(amount) || 0);
  for (const band of amountThresholds) {
    if (value >= band.min) return band.level;
  }
  return "tiny";
}

function resolveTypeLabel(type, lang) {
  const normalized = typeLabels[type] ?? typeLabels.expense;
  return normalized[lang] ?? normalized.id;
}

function resolveTypeEmoji(type) {
  return typeEmojis[type] ?? typeEmojis.expense;
}

function applyTemplate(template = "", replacements) {
  return Object.entries(replacements).reduce((acc, [token, value]) => {
    return acc.split(token).join(value);
  }, template);
}

const MoneyTalkContext = createContext({ speak: () => {} });

// eslint-disable-next-line react-refresh/only-export-components
export function useMoneyTalk() {
  return useContext(MoneyTalkContext);
}

export default function MoneyTalkProvider({ prefs = {}, children }) {
  const [current, setCurrent] = useState(null);
  const queue = useRef([]);
  const limiter = useRef(createMoneyTalkLimiter(prefs.moneyTalkIntensity));

  useEffect(() => {
    limiter.current = createMoneyTalkLimiter(prefs.moneyTalkIntensity);
  }, [prefs.moneyTalkIntensity]);

  const handleDismiss = useCallback(() => {
    setCurrent(null);
  }, []);

  const process = useCallback(() => {
    if (current || !queue.current.length) return;
    if (!limiter.current.tryConsume()) return;
    const next = queue.current.shift();
    setCurrent(next);
    setTimeout(() => {
      handleDismiss();
      process();
    }, next.duration || 5000);
  }, [current, handleDismiss]);

  const speak = useCallback(
    ({ category, amount = 0, type = "expense", context = {} }) => {
      if (!prefs.moneyTalkEnabled) return;
      const chanceMap = { jarang: 0.3, normal: 0.7, ramai: 1 };
      if (Math.random() > (chanceMap[prefs.moneyTalkIntensity] || 0.7)) return;
      const lang = prefs.moneyTalkLang || "id";
      const formattedAmount = formatCurrency(Math.abs(amount) || 0, "IDR");
      const categoryLabel = category || (lang === "en" ? "misc" : "lain-lain");
      const typeLabel = resolveTypeLabel(type, lang);
      const typeEmoji = resolveTypeEmoji(type);
      const replacements = {
        "{amount}": formattedAmount,
        "{category}": categoryLabel,
        "{type}": typeLabel,
        "{emoji}": typeEmoji,
      };

      const selectRandom = (list = []) =>
        list.length ? list[Math.floor(Math.random() * list.length)] : "";

      let template = "";
      if (context.isSavings) template = special[lang].savings;
      else if (context.isOverBudget) template = special[lang].overbudget;
      else if (context.isHigh) template = special[lang].high;
      else {
        const list = quotes[lang]?.[category] || quotes[lang]?.default || [];
        if (!list.length) return;
        template = selectRandom(list);
      }

      let message = applyTemplate(template, replacements);

      const level = determineAmountLevel(amount);
      const reactionPool =
        amountReactions[lang]?.[type]?.[level] ||
        amountReactions[lang]?.default?.[level] ||
        [];
      const reaction = applyTemplate(selectRandom(reactionPool), replacements);
      if (reaction) {
        message = `${message} ${reaction}`.trim();
      }

      const tipList = tips[lang]?.[category] || tips[lang]?.default || [];
      const tip = applyTemplate(selectRandom(tipList), replacements);
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
