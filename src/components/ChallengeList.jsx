import ChallengeCard from "./ChallengeCard.jsx";

export default function ChallengeList({ challenges = [], onView, onEdit, onEnd }) {
  if (!challenges.length)
    return <p className="text-sm text-center text-muted">Belum ada challenge</p>;
  return (
    <div className="space-y-4">
      {challenges.map((c) => (
        <ChallengeCard
          key={c.id}
          challenge={c}
          onView={onView}
          onEdit={onEdit}
          onEnd={onEnd}
        />
      ))}
    </div>
  );
}
