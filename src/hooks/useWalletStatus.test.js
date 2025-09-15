import { describe, it, expect } from "vitest";
import { getWalletStatus } from "./useWalletStatus";

describe("getWalletStatus", () => {
  it("returns FAT status", () => {
    const res = getWalletStatus({ balance: 1500, avgMonthlyExpense: 500, weeklyTrend: 0 });
    expect(res.status).toBe("FAT");
    expect(res.expression).toBe("😄");
    expect(res.tip).toMatch(/Saldo sehat/);
  });

  it("returns NORMAL status", () => {
    const res = getWalletStatus({ balance: 900, avgMonthlyExpense: 1000, weeklyTrend: 10 });
    expect(res.status).toBe("NORMAL");
    expect(res.expression).toBe("🙂");
    expect(res.tip).toMatch(/pengeluaran naik 10%/);
  });

  it("returns THIN status", () => {
    const res = getWalletStatus({ balance: 300, avgMonthlyExpense: 600, weeklyTrend: -5 });
    expect(res.status).toBe("THIN");
    expect(res.expression).toBe("😟");
    expect(res.tip).toMatch(/Jaga pengeluaran/);
  });

  it("returns FLAT status", () => {
    const res = getWalletStatus({ balance: 100, avgMonthlyExpense: 500, weeklyTrend: 0 });
    expect(res.status).toBe("FLAT");
    expect(res.expression).toBe("😢");
    expect(res.tip).toMatch(/Dompet kempes/);
  });
});

