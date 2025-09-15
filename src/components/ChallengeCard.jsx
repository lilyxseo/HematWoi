import { remainingDays } from "../lib/challenges.js";

export default function ChallengeCard({ challenge, onView, onEdit, onEnd }) {
  const daysLeft = remainingDays(challenge);
  const percent = Math.round((challenge.progress || 0) * 100);
  return (
    <div className="card flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">{challenge.title}</h3>
        {challenge.status === "active" && (
          <span className="text-xs text-muted">{daysLeft} hari lagi</span>
        )}
      </div>
      <div className="w-full bg-surface-2 rounded h-2">
        <div className="bg-success h-2 rounded" style={{ width: `${percent}%` }} />
      </div>
      <div className="flex gap-2 text-xs">
        <button type="button" onClick={() => onView(challenge)} className="underline">
          View
        </button>
        {challenge.status === "active" && (
          <>
            <button type="button" onClick={() => onEdit(challenge)} className="underline">
              Edit
            </button>
            <button type="button" onClick={() => onEnd(challenge)} className="underline">
              End
            </button>
          </>
        )}
      </div>
    </div>
  );
}
