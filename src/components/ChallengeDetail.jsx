import { evaluateChallenge } from "../lib/challenges.js";

export default function ChallengeDetail({ challenge, txs = [], onClose }) {
  if (!challenge) return null;
  const related = txs.filter((t) => {
    const d = new Date(t.date);
    return (
      d >= new Date(challenge.startDate) &&
      d <= new Date(challenge.endDate) &&
      t.category === challenge.rules?.category
    );
  });
  const { status, progress } = evaluateChallenge(challenge, txs);
  const percent = Math.round(progress * 100);

  return (
    <div className="p-4 space-y-4">
      <button type="button" className="underline text-sm" onClick={onClose}>
        Close
      </button>
      <h2 className="text-lg font-semibold">{challenge.title}</h2>
      <p className="text-sm">Status: {status}</p>
      <div className="w-full bg-surface-2 rounded h-2">
        <div className="bg-success h-2 rounded" style={{ width: `${percent}%` }} />
      </div>
      <div>
        <h3 className="font-semibold">Log</h3>
        {related.length ? (
          <ul className="text-sm list-disc pl-4">
            {related.map((t) => (
              <li key={t.id}>
                {t.date}: {t.type} {t.amount}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm">Belum ada transaksi terkait</p>
        )}
      </div>
      {status === "completed" && (
        <p className="text-sm">Mascot: Mantap! Challenge selesai.</p>
      )}
      {status === "failed" && (
        <p className="text-sm">Mascot: Yah, coba lagi besok.</p>
      )}
    </div>
  );
}
