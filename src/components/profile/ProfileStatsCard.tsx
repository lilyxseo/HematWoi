interface Stats {
  transactions?: number;
  savings?: number;
  goalsCompleted?: number;
  challengesCompleted?: number;
  dailyStreak?: number;
}

export default function ProfileStatsCard({ stats = {} }: { stats: Stats }) {
  const items = [
    { label: 'Total Transaksi', value: stats.transactions || 0 },
    { label: 'Total Tabungan', value: stats.savings || 0 },
    { label: 'Goals Completed', value: stats.goalsCompleted || 0 },
    { label: 'Challenges Completed', value: stats.challengesCompleted || 0 },
    { label: 'Streak Harian', value: stats.dailyStreak || 0 },
  ];

  return (
    <section className="p-4 border rounded">
      <h2 className="font-semibold mb-2">Activity Stats</h2>
      <ul className="grid grid-cols-2 gap-2 text-sm">
        {items.map((item) => (
          <li key={item.label} className="flex justify-between">
            <span>{item.label}</span>
            <span className="font-semibold">{item.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
