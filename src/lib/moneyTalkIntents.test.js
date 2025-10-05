import { describe, expect, it } from "vitest";
import { resolveMoneyTalkIntent } from "./moneyTalkIntents";

describe("resolveMoneyTalkIntent", () => {
  const baseValues = {
    amount: "Rp50.000",
    category: "Makan",
    type: "expense",
    title: "Ngopi di Starbucks",
  };

  it("detects coffee outings in Indonesian", () => {
    const result = resolveMoneyTalkIntent({
      lang: "id",
      category: "Makan",
      title: "Ngopi di Starbucks",
      values: baseValues,
    });
    expect(result).toBeTruthy();
    expect(result?.message).toContain("Ngopi");
    expect(result?.tip).toContain("kopi");
  });

  it("supports category aliases and English copy", () => {
    const result = resolveMoneyTalkIntent({
      lang: "en",
      category: "Food & Drinks",
      title: "Latte run",
      values: {
        ...baseValues,
        category: "Food & Drinks",
        title: "Latte run",
      },
    });
    expect(result).toBeTruthy();
    expect(result?.message).toContain("Coffee run");
    expect(result?.tip).toContain("home");
  });

  it("matches streaming keywords", () => {
    const result = resolveMoneyTalkIntent({
      lang: "id",
      category: "Hiburan",
      title: "Bayar Netflix Premium",
      values: {
        amount: "Rp150.000",
        category: "Hiburan",
        type: "expense",
        title: "Bayar Netflix Premium",
      },
    });
    expect(result).toBeTruthy();
    expect(result?.message).toContain("Netflix");
  });

  it("returns null when no keyword matches", () => {
    const result = resolveMoneyTalkIntent({
      lang: "id",
      category: "Transport",
      title: "Meeting dengan klien",
      values: {
        amount: "Rp75.000",
        category: "Transport",
        type: "expense",
        title: "Meeting dengan klien",
      },
    });
    expect(result).toBeNull();
  });
});
