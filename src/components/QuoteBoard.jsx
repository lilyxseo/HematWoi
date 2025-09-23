import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { getDashboardSignals, generateQuotes } from "../lib/quoteEngine";
import { loadSubscriptions } from "../lib/subscriptions";

const GROUP_LABELS = {
  "#1": "Belanja Berulang",
  "#2": "Anggaran Waspada",
  "#3": "Anggaran Jebol",
  "#4": "Transaksi Jumbo",
  "#5": "Streak Keren",
  "#6": "No-Spend Day",
  "#7": "Progress Goal",
  "#8": "Langganan",
  "#9": "Auto Nabung",
  "#10": "Highlight Mingguan",
  "#11": "Budget Sepi",
  "#12": "Arus Kas",
  "#13": "Saldo Rendah",
  "#14": "Humor Finansial",
};

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function useLocalSubscriptions(initial) {
  const [subs, setSubs] = useState(initial ?? []);

  useEffect(() => {
    if (Array.isArray(initial) && initial.length) {
      setSubs(initial);
      return;
    }
    try {
      const loaded = loadSubscriptions?.();
      if (Array.isArray(loaded)) {
        setSubs(loaded);
      }
    } catch (error) {
      console.warn("[HW][quotes] gagal baca subscriptions", error);
    }
  }, [initial]);

  return subs;
}

function useDashboardQuotes({ transactions, budgets, goals, subscriptions, accounts }) {
  const subs = useLocalSubscriptions(subscriptions);

  const signals = useMemo(() => {
    try {
      return getDashboardSignals({
        fromTx: Array.isArray(transactions) ? transactions : [],
        budgets: Array.isArray(budgets) ? budgets : [],
        goals: Array.isArray(goals) ? goals : [],
        subs: Array.isArray(subs) ? subs : [],
        accounts: Array.isArray(accounts) ? accounts : [],
      });
    } catch (error) {
      console.error("[HW][quotes] gagal hitung sinyal", error);
      return getDashboardSignals({ fromTx: Array.isArray(transactions) ? transactions : [] });
    }
  }, [transactions, budgets, goals, subs, accounts]);

  const refresh = useCallback(() => generateQuotes(signals), [signals]);

  return { signals, refresh };
}

function HighlightedText({ text, emphasis }) {
  const safeText = typeof text === "string" ? text : String(text ?? "");
  const highlightTokens = useMemo(() => {
    if (!Array.isArray(emphasis) || emphasis.length === 0) return [];
    return Array.from(new Set(emphasis.filter((token) => typeof token === "string" && token.trim())));
  }, [emphasis]);

  const parts = useMemo(() => {
    if (!highlightTokens.length) return [{ type: "text", value: safeText }];
    const pattern = new RegExp(highlightTokens.map(escapeRegex).join("|"), "g");
    const nodes = [];
    let lastIndex = 0;
    let match;
    while ((match = pattern.exec(safeText)) !== null) {
      const index = match.index;
      if (index > lastIndex) {
        nodes.push({ type: "text", value: safeText.slice(lastIndex, index) });
      }
      nodes.push({ type: "bold", value: match[0], index });
      lastIndex = pattern.lastIndex;
    }
    if (lastIndex < safeText.length) {
      nodes.push({ type: "text", value: safeText.slice(lastIndex) });
    }
    return nodes;
  }, [highlightTokens, safeText]);

  return parts.map((part, idx) => {
    if (part.type === "bold") {
      return (
        <span key={`bold-${idx}`} className="font-semibold text-text">
          {part.value}
        </span>
      );
    }
    return <span key={`text-${idx}`}>{part.value}</span>;
  });
}

export default function QuoteBoard({
  transactions = [],
  budgets = [],
  goals = [],
  subscriptions = [],
  accounts = [],
}) {
  const { refresh } = useDashboardQuotes({ transactions, budgets, goals, subscriptions, accounts });
  const [quotes, setQuotes] = useState(() => refresh() || []);
  const [activeIndex, setActiveIndex] = useState(0);
  const pointerStart = useRef(null);

  useEffect(() => {
    const next = refresh();
    setQuotes(next || []);
    setActiveIndex(0);
  }, [refresh]);

  const handleRefresh = useCallback(() => {
    const next = refresh();
    setQuotes(next || []);
    setActiveIndex(0);
  }, [refresh]);

  const handlePointerDown = useCallback((event) => {
    pointerStart.current = event.clientX ?? 0;
  }, []);

  const handlePointerUp = useCallback(
    (event) => {
      if (pointerStart.current == null) return;
      const delta = (event.clientX ?? 0) - pointerStart.current;
      if (Math.abs(delta) > 48) {
        setActiveIndex((prev) => {
          if (delta < 0) {
            return Math.min(prev + 1, Math.max(0, quotes.length - 1));
          }
          return Math.max(prev - 1, 0);
        });
      }
      pointerStart.current = null;
    },
    [quotes.length],
  );

  const sliderStyle = useMemo(
    () => ({ transform: `translateX(-${activeIndex * 100}%)` }),
    [activeIndex],
  );

  if (!quotes?.length) {
    return (
      <div className="rounded-3xl border border-border bg-surface p-4 text-center text-sm text-muted shadow-sm">
        Tidak ada quote hari ini.
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold text-text">Quote Cerdas</h2>
          <p className="text-sm text-muted">Update ringan dari transaksi teranyar.</p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text shadow-sm transition hover:border-brand hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          Refresh
        </button>
      </div>

      <div className="md:hidden" onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}>
        <div className="overflow-hidden">
          <div className="flex transition-transform duration-300 ease-out" style={sliderStyle}>
            {quotes.map((quote, index) => (
              <article key={`${quote.group}-${index}`} className="min-w-full shrink-0 px-0.5">
                <div className="rounded-3xl border border-border bg-surface shadow-sm shadow-black/5">
                  <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {GROUP_LABELS[quote.group] ?? "Info"}
                    </span>
                    <span className="text-xs text-muted">{index + 1} / {quotes.length}</span>
                  </div>
                  <p className="px-4 pb-5 pt-4 text-base leading-relaxed text-text">
                    <HighlightedText text={quote.text} emphasis={quote.emphasis} />
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
        {quotes.length > 1 && (
          <div className="mt-2 flex justify-center gap-1.5">
            {quotes.map((_, idx) => (
              <span
                key={`dot-${idx}`}
                className={clsx(
                  "h-2.5 w-2.5 rounded-full transition",
                  idx === activeIndex ? "bg-brand" : "bg-border",
                )}
              />
            ))}
          </div>
        )}
      </div>

      <div className="hidden md:grid md:grid-cols-2 md:gap-4 lg:grid-cols-3">
        {quotes.map((quote, index) => (
          <article key={`${quote.group}-desktop-${index}`} className="h-full">
            <div className="flex h-full flex-col rounded-3xl border border-border bg-surface shadow-sm shadow-black/5">
              <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {GROUP_LABELS[quote.group] ?? "Info"}
                </span>
              </div>
              <p className="px-4 pb-5 pt-4 text-base leading-relaxed text-text">
                <HighlightedText text={quote.text} emphasis={quote.emphasis} />
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
