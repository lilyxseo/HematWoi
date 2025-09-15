import { useState } from "react";
import ChallengeList from "../components/ChallengeList.jsx";
import ChallengeCreatorModal from "../components/ChallengeCreatorModal.jsx";
import ChallengeDetail from "../components/ChallengeDetail.jsx";

export default function ChallengesPage({ challenges, onAdd, onUpdate, txs }) {
  const [tab, setTab] = useState("active");
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [detail, setDetail] = useState(null);

  const actives = challenges.filter((c) => c.status === "active");
  const completed = challenges.filter((c) => c.status !== "active");

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-lg font-semibold">Challenges</h1>
      <div className="flex gap-2">
        <button
          type="button"
          className={`px-3 py-1 rounded ${tab === "active" ? "bg-brand-var text-brand-foreground" : "bg-surface-2"}`}
          onClick={() => setTab("active")}
        >
          Active
        </button>
        <button
          type="button"
          className={`px-3 py-1 rounded ${tab === "completed" ? "bg-brand-var text-brand-foreground" : "bg-surface-2"}`}
          onClick={() => setTab("completed")}
        >
          Completed
        </button>
        <button
          type="button"
          className="ml-auto btn"
          onClick={() => setCreatorOpen(true)}
        >
          +
        </button>
      </div>
      {tab === "active" ? (
        <ChallengeList
          challenges={actives}
          onView={(c) => setDetail(c)}
          onEdit={(c) => setDetail(c)}
          onEnd={(c) => onUpdate(c.id, { status: "failed" })}
        />
      ) : (
        <ChallengeList
          challenges={completed}
          onView={(c) => setDetail(c)}
          onEdit={() => {}}
          onEnd={() => {}}
        />
      )}
      <ChallengeCreatorModal
        open={creatorOpen}
        onClose={() => setCreatorOpen(false)}
        onSave={onAdd}
      />
      <ChallengeDetail
        challenge={detail}
        txs={txs}
        onClose={() => setDetail(null)}
      />
    </main>
  );
}
