import { useState, useEffect, useCallback } from "react";
import { fetchQuotes } from "../lib/dailyQuote";

export function useDailyQuote({ lang = "id" } = {}) {
  const [allQuotes, setAllQuotes] = useState([]);
  const [quote, setQuote] = useState(null);
  const [category, setCategory] = useState("all");
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchQuotes().then(setAllQuotes);
  }, []);

  const shuffle = useCallback(() => {
    if (!allQuotes.length) return;
    const filtered = allQuotes.filter(
      (q) => category === "all" || q.category === category
    );
    if (!filtered.length) return;
    const candidates = filtered.filter((q) => !history.includes(q.id));
    const pool = candidates.length ? candidates : filtered;
    const next = pool[Math.floor(Math.random() * pool.length)];
    setQuote({ ...next, text: next.text[lang] || next.text.id });
    setHistory((prev) => [next.id, ...prev].slice(0, 5));
  }, [allQuotes, category, history, lang]);

  useEffect(() => {
    if (allQuotes.length) shuffle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allQuotes, category, lang]);

  return { quote, shuffle, category, setCategory };
}
