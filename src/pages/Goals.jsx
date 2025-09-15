import GoalList from '../components/GoalList';
import useGoals from '../hooks/useGoals';

export default function GoalsPage() {
  const { goals, addGoal, updateGoal, deleteGoal } = useGoals();
  return (
    <div className="p-4">
      <GoalList
        goals={goals}
        onAdd={addGoal}
        onUpdate={updateGoal}
        onDelete={deleteGoal}
      />
    </div>
  );
}
