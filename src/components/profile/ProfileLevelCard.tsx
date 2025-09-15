import AvatarLevel from '../AvatarLevel.jsx';

export default function ProfileLevelCard() {
  return (
    <section className="p-4 border rounded space-y-2">
      <h2 className="font-semibold">Level & XP</h2>
      <AvatarLevel transactions={[]} insights={{}} challenges={[]} />
      <p className="text-xs text-slate-500">
        Gain XP from transactions, savings, and challenges.
      </p>
    </section>
  );
}
