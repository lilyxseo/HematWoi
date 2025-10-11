const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);

export function dummySeed() {
  const categories = [
    { id: uid(), name: 'Gaji', type: 'income' },
    { id: uid(), name: 'Bonus', type: 'income' },
    { id: uid(), name: 'Makanan', type: 'expense' },
    { id: uid(), name: 'Minuman', type: 'expense' },
    { id: uid(), name: 'Jajan', type: 'expense' },
    { id: uid(), name: 'Bensin', type: 'expense' },
    { id: uid(), name: 'Perawatan Motor', type: 'expense' },
    { id: uid(), name: 'Transport', type: 'expense' },
    { id: uid(), name: 'Kuota', type: 'expense' },
    { id: uid(), name: 'Belanja', type: 'expense' },
    { id: uid(), name: 'Belanja Online', type: 'expense' },
    { id: uid(), name: 'Tagihan', type: 'expense' },
    { id: uid(), name: 'Baju', type: 'expense' },
    { id: uid(), name: 'Celana', type: 'expense' },
    { id: uid(), name: 'Kesehatan', type: 'expense' },
    { id: uid(), name: 'Hiburan', type: 'expense' },
    { id: uid(), name: 'Tabungan', type: 'expense' },
    { id: uid(), name: 'Lainnya', type: 'expense' },
  ];

  const budgets = categories
    .filter((c) => c.type === 'expense')
    .map((c) => ({ id: uid(), categoryId: c.id, limit: 1000000 }));

  const goals = [
    { id: uid(), name: 'Dana Darurat', target: 5000000, saved: 0, history: [] },
    { id: uid(), name: 'Liburan', target: 3000000, saved: 0, history: [] },
  ];

  const transactions = Array.from({ length: 30 }).map((_, i) => {
    const cat = categories[i % categories.length];
    const amount = 50000 + (i % 5) * 10000;
    const type = cat.type === 'income' ? 'income' : 'expense';
    return {
      id: uid(),
      amount,
      type,
      categoryId: cat.id,
      date: new Date().toISOString(),
      note: `Dummy ${i + 1}`,
    };
  });

  return {
    transactions,
    budgets,
    categories,
    goals,
    subscriptions: [],
    profile: {},
    challenges: [],
  };
}
