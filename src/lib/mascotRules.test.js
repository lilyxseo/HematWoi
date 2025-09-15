import { describe, expect, it } from "vitest";
import { generateMascotComment } from "./mascotRules";

describe("generateMascotComment", () => {
  const baseSummary = {
    today: { income: 0, expense: 20000 },
    thisWeek: { income: 0, expense: 0 },
    thisMonth: {
      income: 0,
      expense: 0,
      dailyAverageExpense: 10000,
      topCategoriesByDay: ["transport", "transport", "transport"],
    },
  };

  it("komentar hemat saat pengeluaran hari ini di bawah rata-rata", () => {
    const summary = {
      ...baseSummary,
      today: { ...baseSummary.today, expense: 5000 },
    };
    const comment = generateMascotComment(summary, []);
    expect(comment).toBe("Wih, kamu hemat hari ini 👍");
  });

  it("komentar boba saat kategori makan tertinggi 3 hari", () => {
    const summary = {
      ...baseSummary,
      thisMonth: {
        ...baseSummary.thisMonth,
        topCategoriesByDay: ["makan/jajan", "makan/jajan", "makan/jajan"],
      },
    };
    const comment = generateMascotComment(summary, []);
    expect(comment).toBe("Boba lagi? 😅");
  });

  it("peringatkan jika budget hampir habis", () => {
    const budgets = [{ category: "makan/jajan", limit: 100000, spent: 95000 }];
    const comment = generateMascotComment(baseSummary, budgets);
    expect(comment).toBe("Inget ya, budget hampir habis!");
  });
});
