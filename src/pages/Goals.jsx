import GoalList from "../components/GoalList";
import EnvelopeManager from "../components/EnvelopeManager";
import AutoAllocationRules from "../components/AutoAllocationRules";

export default function Goals({
  goals,
  envelopes,
  rules,
  onAddGoal,
  onAddEnvelope,
  onSaveRules,
}) {
  return (
    <div className="p-4 space-y-8">
      <GoalList goals={goals} onSave={onAddGoal} />
      <EnvelopeManager envelopes={envelopes} onSave={onAddEnvelope} />
      <AutoAllocationRules
        goals={goals}
        envelopes={envelopes}
        rules={rules}
        onSave={onSaveRules}
      />
    </div>
  );
}
