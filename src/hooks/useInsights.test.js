import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { aggregateInsights } from "./useInsights";

describe("aggregateInsights", () => {
  beforeAll(() => {
    vi.setSystemTime(new Date("2024-06-15"));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const txs = [
    { id: 1, date: "2024-06-01", type: "income", amount: 1000 },
    {
      id: 2,
      date: "2024-06-02",
      type: "expense",
      amount: 200,
      category: "Food",
      category_color: "#ff0000",
      note: "A",
    },
    {
      id: 3,
      date: "2024-06-03",
      type: "expense",
      amount: 300,
      category: "Transport",
      category_color: "#00ff00",
      note: "B",
    },
    {
      id: 4,
      date: "2024-06-04",
      type: "expense",
      amount: 400,
      category: "Food",
      category_color: "#ff0000",
      note: "C",
    },
    { id: 5, date: "2024-05-10", type: "income", amount: 1000 },
    { id: 6, date: "2024-05-11", type: "expense", amount: 500 },
    { id: 7, date: "2024-04-10", type: "income", amount: 1000 },
    { id: 8, date: "2024-04-11", type: "expense", amount: 900 },
    { id: 9, date: "2024-03-10", type: "income", amount: 1000 },
    { id: 10, date: "2024-03-11", type: "expense", amount: 300 },
    { id: 11, date: "2024-02-10", type: "income", amount: 1000 },
    { id: 12, date: "2024-02-11", type: "expense", amount: 700 },
    { id: 13, date: "2024-01-10", type: "income", amount: 1000 },
    { id: 14, date: "2024-01-11", type: "expense", amount: 1200 },
  ];

  it("calculates kpis", () => {
    const res = aggregateInsights(txs);
    expect(res.kpis.income).toBe(1000);
    expect(res.kpis.expense).toBe(900);
    expect(res.kpis.net).toBe(100);
    expect(res.kpis.avgDaily).toBeCloseTo(60, 0);
  });

  it("builds 6 month trend", () => {
    const res = aggregateInsights(txs);
    expect(res.trend).toHaveLength(6);
    expect(res.trend[5]).toEqual({ month: "2024-06", net: 100 });
  });

  it("aggregates categories", () => {
    const res = aggregateInsights(txs);
    const food = res.categories.find((c) => c.name === "Food");
    const transport = res.categories.find((c) => c.name === "Transport");
    expect(food.value).toBe(600);
    expect(food.color).toBe("#ff0000");
    expect(transport.value).toBe(300);
    expect(transport.color).toBe("#00ff00");
  });

  it("lists top spends", () => {
    const res = aggregateInsights(txs);
    expect(res.topSpends.map((t) => t.amount)).toEqual([400, 300, 200]);
  });

  it("uses calendar month starting from the 1st in Asia/Jakarta", () => {
    const baseTime = new Date("2024-06-15T00:00:00.000Z");
    vi.setSystemTime(new Date("2024-07-15T12:00:00+07:00"));

    const julyTxs = [
      { id: 100, date: "2024-07-01T00:00:00+07:00", type: "expense", amount: 500 },
      { id: 101, date: "2024-06-30T23:00:00+07:00", type: "expense", amount: 250 },
    ];

    const res = aggregateInsights(julyTxs);
    expect(res.kpis.expense).toBe(500);

    vi.setSystemTime(baseTime);
  });
});
