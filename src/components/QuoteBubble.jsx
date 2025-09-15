import { useDailyQuote } from "../hooks/useDailyQuote";

export default function QuoteBubble({ lang = "id" }) {
  const { quote } = useDailyQuote({ lang });

  if (!quote?.text) {
    return (
      <div className="text-center text-sm text-muted">Tidak ada kutipan hari ini.</div>
    );
  }

  return (
    <figure className="mx-auto w-full max-w-3xl">
      <blockquote className="relative w-full rounded-xl border border-brand/20 bg-brand/5 p-4 text-left shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <span className="absolute -top-2 left-4 text-2xl text-brand" aria-hidden>
          “
        </span>
        <p className="px-4 text-sm leading-relaxed line-clamp-3">{quote.text}</p>
        <span className="absolute -bottom-2 right-4 text-2xl text-brand" aria-hidden>
          ”
        </span>
      </blockquote>
      {quote.author && (
        <figcaption className="mt-2 text-right text-xs text-muted">
          — {quote.author}
        </figcaption>
      )}
    </figure>
  );
}
