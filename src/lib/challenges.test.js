import { describe, it, expect } from "vitest";
import { evaluateChallenge } from "./challenges.js";

const today = new Date().toISOString().split("T")[0];

describe("evaluateChallenge", () => {
  it("fails avoid challenge when violation occurs", () => {
    const challenge = {
      type: "avoid",
      rules: { category: "Makan" },
      durationDays: 7,
      startDate: today,
      endDate: new Date(Date.now() + 6 * 86400000).toISOString(),
      status: "active",
    };
    const txs = [
      { id: 1, category: "Makan", date: today, type: "expense", amount: 10000 },
    ];
    const { status } = evaluateChallenge(challenge, txs, new Date());
    expect(status).toBe("failed");
  });

  it("fails limit challenge when exceeding limit", () => {
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + 2);
    const challenge = {
      type: "limit",
      rules: { category: "Transport", limit: 5000, period: "day" },
      durationDays: 3,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      status: "active",
    };
    const txs = [
      { id: 1, category: "Transport", date: start.toISOString(), type: "expense", amount: 6000 },
    ];
    const { status } = evaluateChallenge(challenge, txs, start);
    expect(status).toBe("failed");
  });

  it("completes target challenge when target reached", () => {
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const challenge = {
      type: "target",
      rules: { category: "Tabungan", target: 10000 },
      durationDays: 7,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      status: "active",
    };
    const txs = [
      { id: 1, category: "Tabungan", date: start.toISOString(), type: "income", amount: 10000 },
    ];
    const { status } = evaluateChallenge(challenge, txs, end);
    expect(status).toBe("completed");
  });
});
