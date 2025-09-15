import { useDailyQuote } from "../hooks/useDailyQuote";
import "./Animations.css";

export default function DailyQuote({ lang = "id" }) {
  const { quote } = useDailyQuote({ lang });
  if (!quote) return null;
  const icons = { motivasi: "💡", humor: "😄", tips: "🛟" };
  return (
    <div className="card" role="region" aria-label="Daily quote">
      <p key={quote.id} className="text-center animate-fade">
        <span className="mr-2" aria-hidden>
          {icons[quote.category]}
        </span>
        {quote.text}
      </p>
    </div>
  );
}
