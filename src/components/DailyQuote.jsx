import { useDailyQuote } from "../hooks/useDailyQuote";
import "./Animations.css";

export default function DailyQuote({ lang = "id" }) {
  const { quote, shuffle, category, setCategory } = useDailyQuote({ lang });
  if (!quote) return null;
  const icons = { motivasi: "💡", humor: "😄", tips: "🛟" };
  return (
    <div className="card space-y-3" role="region" aria-label="Daily quote">
      <div className="flex items-start justify-between gap-4">
        <p key={quote.id} className="flex-1 animate-fade">
          <span className="mr-2" aria-hidden>{icons[quote.category]}</span>
          {quote.text}
        </p>
        <button onClick={shuffle} className="btn btn-secondary text-sm">
          Ulangi
        </button>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="quote-category" className="sr-only">
          Kategori
        </label>
        <select
          id="quote-category"
          className="input w-auto"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">Semua</option>
          <option value="motivasi">Motivasi</option>
          <option value="humor">Humor</option>
          <option value="tips">Tips</option>
        </select>
      </div>
    </div>
  );
}
