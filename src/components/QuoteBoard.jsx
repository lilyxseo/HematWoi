import { useCallback, useEffect, useMemo, useState } from 'react';
import { generateQuotes, highlightKeys, loadQuoteEngine } from '../lib/quoteEngine';

const GROUP_META = {
  'over-budget': { label: 'Anggaran Jebol', emoji: '🚨' },
  'near-budget': { label: 'Hampir Batas', emoji: '🛑' },
  'weekly-repeats': { label: 'Belanja Berulang', emoji: '🧋' },
  'large-transaction': { label: 'Transaksi Besar', emoji: '💳' },
  'net-cashflow': { label: 'Arus Kas Bulanan', emoji: '📈' },
  'weekly-top': { label: 'Kategori Top Minggu Ini', emoji: '📝' },
  fallback: { label: 'Santai Dulu', emoji: '☕️' },
};

const DEFAULT_META = { label: 'Quote Cerdas', emoji: '💡' };

function renderQuoteNodes(template, vars, text) {
  if (!template || !vars) return text;
  const nodes = [];
  let lastIndex = 0;
  const pattern = /\{(\w+)\}/g;
  let match = pattern.exec(template);
  while (match) {
    const [placeholder, key] = match;
    if (match.index > lastIndex) {
      nodes.push(template.slice(lastIndex, match.index));
    }
    const value = vars[key] ?? '';
    nodes.push(
      <span
        key={`${key}-${match.index}`}
        className={highlightKeys.has(key) ? 'font-semibold text-text' : 'text-text'}
      >
        {value}
      </span>,
    );
    lastIndex = match.index + placeholder.length;
    match = pattern.exec(template);
  }
  if (lastIndex < template.length) {
    nodes.push(template.slice(lastIndex));
  }
  if (!nodes.length) {
    nodes.push(text);
  }
  return nodes;
}

function QuoteCard({ quote }) {
  const meta = GROUP_META[quote.group] ?? DEFAULT_META;
  const content = useMemo(
    () => renderQuoteNodes(quote.template, quote.vars, quote.text),
    [quote.template, quote.vars, quote.text],
  );

  return (
    <article className="rounded-3xl border border-border bg-surface shadow-sm p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2 text-sm text-muted">
        <span aria-hidden className="text-xl leading-none">
          {meta.emoji}
        </span>
        <span className="font-semibold">{meta.label}</span>
      </div>
      <p className="text-base leading-relaxed text-text">{content}</p>
    </article>
  );
}

function QuoteSkeleton() {
  return (
    <div className="rounded-3xl border border-border bg-surface shadow-sm p-4 sm:p-5">
      <div className="mb-3 h-4 w-24 animate-pulse rounded-full bg-border/70" />
      <div className="space-y-2">
        <div className="h-3.5 w-full animate-pulse rounded-full bg-border/70" />
        <div className="h-3.5 w-4/5 animate-pulse rounded-full bg-border/60" />
        <div className="h-3.5 w-3/5 animate-pulse rounded-full bg-border/50" />
      </div>
    </div>
  );
}

export default function QuoteBoard() {
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState([]);
  const [signals, setSignals] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadQuoteEngine()
      .then((payload) => {
        if (cancelled) return;
        setSignals(payload.signals);
        setQuotes(generateQuotes(payload.signals));
        setError(null);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSignals(null);
        setQuotes(generateQuotes(null));
        setError('Tidak bisa memuat data terbaru.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRefresh = useCallback(() => {
    setQuotes(generateQuotes(signals ?? null));
  }, [signals]);

  const cards = useMemo(() => {
    if (loading) {
      return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <QuoteSkeleton key={key} />
          ))}
        </div>
      );
    }
    if (!quotes.length) {
      return (
        <div className="rounded-3xl border border-border bg-surface shadow-sm p-4 text-sm text-muted sm:p-5">
          Belum ada aktivitas yang bisa dianalisis. Coba catat transaksi dulu, ya!
        </div>
      );
    }
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {quotes.map((quote) => (
          <QuoteCard key={`${quote.group}-${quote.text}`} quote={quote} />
        ))}
      </div>
    );
  }, [loading, quotes]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text sm:text-xl">Quote Cerdas</h2>
          <p className="text-sm text-muted">Insight singkat dari transaksi teranyar.</p>
        </div>
        <div className="flex items-center gap-3">
          {error && !loading && <span className="text-xs text-amber-500">{error}</span>}
          <button
            type="button"
            onClick={handleRefresh}
            className="rounded-full border border-border px-3 py-1 text-sm font-medium text-text transition hover:bg-surface-2"
            aria-label="Muat ulang quote"
          >
            Refresh
          </button>
        </div>
      </div>
      {cards}
    </section>
  );
}
