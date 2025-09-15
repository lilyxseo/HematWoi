import { useDailyQuote } from "../hooks/useDailyQuote";

export default function QuoteBubble({ lang = "id" }) {
  const { quote } = useDailyQuote({ lang });

  if (!quote?.text) {
    return (
      <div className="text-center text-sm text-muted">Tidak ada kutipan hari ini.</div>
    );
  }

  return (
    <figure className="mx-auto max-w-md">
      <blockquote className="relative bg-brand/5 border border-brand/20 text-left rounded-xl p-4 shadow-sm after:absolute after:-bottom-2 after:left-6 after:h-4 after:w-4 after:rotate-45 after:bg-inherit after:border-b after:border-r after:border-brand/20 dark:bg-slate-800 dark:border-slate-700 dark:after:border-slate-700">
        <span className="absolute -top-2 left-4 text-2xl text-brand" aria-hidden>
          “
        </span>
        <p className="pr-2 pl-2 text-sm leading-relaxed line-clamp-3">
          {quote.text}
        </p>
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
