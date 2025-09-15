export const SMALL_TALK = [
  "Semangat nabung ya!",
  "Jangan lupa cek transaksi hari ini.",
  "Tetap semangat mengelola uang!"
];

export function generateMascotComment(summary, budgets) {
  if (!summary || !budgets) return "";

  const todayExpense = summary.today?.expense ?? 0;
  const avg = summary.thisMonth?.dailyAverageExpense ?? 0;
  if (todayExpense < avg) {
    return "Wih, kamu hemat hari ini 👍";
  }

  const lastThree = summary.thisMonth?.topCategoriesByDay?.slice(-3) || [];
  if (lastThree.length === 3 && lastThree.every((c) => c === "makan/jajan")) {
    return "Boba lagi? 😅";
  }

  const near = budgets.find((b) => b.spent / b.limit >= 0.9);
  if (near) {
    return "Inget ya, budget hampir habis!";
  }

  return SMALL_TALK[Math.floor(Math.random() * SMALL_TALK.length)];
}

export const exampleSummary = {
  today: { income: 50000, expense: 20000, topCategory: "makan/jajan" },
  thisWeek: { income: 150000, expense: 100000 },
  thisMonth: {
    income: 600000,
    expense: 500000,
    dailyAverageExpense: 16000,
    topCategoriesByDay: ["makan/jajan", "makan/jajan", "makan/jajan"],
  },
};

export const exampleBudgets = [
  { category: "makan/jajan", limit: 300000, spent: 280000 },
  { category: "transport", limit: 150000, spent: 50000 },
];
