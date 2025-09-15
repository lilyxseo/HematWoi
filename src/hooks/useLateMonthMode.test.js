import { describe, it, expect } from "vitest";
import { shouldActivateLateMonthMode } from "./useLateMonthMode";

describe("shouldActivateLateMonthMode", () => {
  it("activates when late date and low balance", () => {
    const date = new Date(2024, 0, 25);
    const res = shouldActivateLateMonthMode(
      { date, balance: 100, avgMonthlyExpense: 1000 },
      { lateMode: "auto", lateModeDay: 24, lateModeBalance: 0.2 }
    );
    expect(res).toBe(true);
  });

  it("respects manual off override", () => {
    const date = new Date(2024, 0, 25);
    const res = shouldActivateLateMonthMode(
      { date, balance: 10, avgMonthlyExpense: 1000 },
      { lateMode: "off" }
    );
    expect(res).toBe(false);
  });

  it("respects manual on override", () => {
    const date = new Date(2024, 0, 1);
    const res = shouldActivateLateMonthMode(
      { date, balance: 900, avgMonthlyExpense: 1000 },
      { lateMode: "on" }
    );
    expect(res).toBe(true);
  });
});
