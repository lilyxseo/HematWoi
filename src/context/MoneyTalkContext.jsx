import { createContext, useCallback, useContext, useRef, useState } from "react";
import MoneyTalkBubble from "../components/MoneyTalkBubble";
import { quotes, tips, special, amountReactions } from "../lib/moneyTalkContent";
import { formatCurrency } from "../lib/format";

const AMOUNT_BUCKETS = [
  { key: "zero", check: (value) => value === 0 },
  { key: "tiny", check: (value) => value < 20_000 },
  { key: "small", check: (value) => value < 150_000 },
  { key: "medium", check: (value) => value < 1_000_000 },
  { key: "large", check: (value) => value < 5_000_000 },
  { key: "mega", check: () => true },
];

const TYPE_NORMALIZER = {
  income: "income",
  transfer: "transfer",
};

const TYPE_LABELS = {
  id: {
    expense: "pengeluaran",
    income: "pemasukan",
    transfer: "transfer",
  },
  en: {
    expense: "expense",
    income: "income",
    transfer: "transfer",
  },
};

function pickRandom(list = []) {
  if (!list.length) return null;
  return list[Math.floor(Math.random() * list.length)];
}

function flattenQuotes(collection) {
  if (!collection) return [];
  return Object.values(collection).flatMap((value) =>
    Array.isArray(value) ? value : []
  );
}

function fillTemplate(template, values) {
  if (!template) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = values[key];
    return value != null ? String(value) : "";
  });
}

function getBucket(amount) {
  const value = Number.isFinite(amount) ? amount : 0;
  const normalized = value < 0 ? 0 : value;
  const bucket = AMOUNT_BUCKETS.find((item) => item.check(normalized));
  return bucket ? bucket.key : "small";
}

function resolveLangBlock(collection, lang) {
  return collection[lang] || collection.id || Object.values(collection)[0] || {};
}

const DURATION_MAP = {
  jarang: 6000,
  normal: 5000,
  ramai: 4000,
};

function createDynamicMessage({ lang, type, amount, values }) {
  const normalizedType = TYPE_NORMALIZER[type] || "expense";
  const langBlock = resolveLangBlock(amountReactions, lang);
  const bucket = getBucket(amount);
  const templates = langBlock?.[normalizedType]?.[bucket] || [];
  const template = pickRandom(templates);
  return fillTemplate(template, values);
}

const MoneyTalkContext = createContext({ speak: () => {} });

// eslint-disable-next-line react-refresh/only-export-components
export function useMoneyTalk() {
  return useContext(MoneyTalkContext);
}

export default function MoneyTalkProvider({ prefs = {}, children }) {
  const [current, setCurrent] = useState(null);
  const queue = useRef([]);

  const handleDismiss = useCallback(() => {
    setCurrent(null);
  }, []);

  const process = useCallback(() => {
    if (current || !queue.current.length) return;
    const next = queue.current.shift();
    setCurrent(next);
    setTimeout(() => {
      handleDismiss();
      process();
    }, next.duration || 5000);
  }, [current, handleDismiss]);

  const speak = useCallback(
    ({ category, amount = 0, type = "expense", currency, context = {} }) => {
      if (!prefs.moneyTalkEnabled) return;
      const lang = prefs.moneyTalkLang || "id";
      const langQuotes = resolveLangBlock(quotes, lang);
      const langTips = resolveLangBlock(tips, lang);
      const langSpecial = resolveLangBlock(special, lang);
      const langTypeLabels = TYPE_LABELS[lang] || TYPE_LABELS.id;
      const normalizedType = TYPE_NORMALIZER[type] || "expense";
      const currencyCode = currency || prefs.currency || "IDR";
      const rawAmount = Math.abs(Number(amount) || 0);
      const templateValues = {
        amount: formatCurrency(rawAmount, currencyCode),
        category:
          category || (lang === "en" ? "mystery category" : "kategori misterius"),
        type: langTypeLabels?.[normalizedType] || normalizedType,
      };
      let message = "";
      if (context.isSavings) message = fillTemplate(langSpecial.savings, templateValues);
      else if (context.isOverBudget)
        message = fillTemplate(langSpecial.overbudget, templateValues);
      else if (context.isHigh) message = fillTemplate(langSpecial.high, templateValues);
      else {
        message = createDynamicMessage({
          lang,
          type,
          amount: rawAmount,
          values: templateValues,
        });
        if (!message) {
          const categoryQuotes = langQuotes?.[category] || [];
          const fallbackQuotes = flattenQuotes(langQuotes);
          const options = categoryQuotes.length ? categoryQuotes : fallbackQuotes;
          if (!options.length) {
            message =
              lang === "en"
                ? "Another transaction logged! I'm keeping an eye on it."
                : "Transaksi tercatat! Aku tetap siaga mengawasinya.";
          } else {
            message = fillTemplate(pickRandom(options), templateValues);
          }
        }
      }
      const tipList = langTips?.[category] || [];
      const tip = tipList.length
        ? fillTemplate(pickRandom(tipList), templateValues)
        : "";
      const baseDuration = DURATION_MAP[prefs.moneyTalkIntensity] || DURATION_MAP.normal;
      queue.current.push({
        id:
          globalThis.crypto?.randomUUID?.() ||
          Math.random().toString(36).slice(2),
        message,
        tip,
        avatar: Math.random() > 0.5 ? "bill" : "coin",
        duration: baseDuration + Math.random() * 1500,
      });
      if (queue.current.length > 3) queue.current.splice(3);
      process();
    },
    [
      prefs.moneyTalkEnabled,
      prefs.moneyTalkIntensity,
      prefs.moneyTalkLang,
      prefs.currency,
      process,
    ]
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
