import { describe, expect, it } from "vitest";
import {
  MONEY_TALK_TITLE_TRIGGERS,
  resolveMoneyTalkIntent,
} from "./moneyTalkIntents";

describe("resolveMoneyTalkIntent", () => {
  const baseValues = {
    amount: "Rp50.000",
    category: "Makanan",
    type: "expense",
    title: "Ngopi di Starbucks",
  };

  it("detects coffee outings in Indonesian without category info", () => {
    const result = resolveMoneyTalkIntent({
      lang: "id",
      title: "Ngopi di Starbucks",
      values: baseValues,
    });
    expect(result).toBeTruthy();
    expect(result?.message).toContain("Ngopi");
    expect(result?.tip).toContain("kopi");
  });

  it("responds to streaming spends even when category mismatches", () => {
    const result = resolveMoneyTalkIntent({
      lang: "en",
      category: "Transport",
      title: "Bayar Netflix Premium",
      values: {
        ...baseValues,
        category: "Transport",
        title: "Bayar Netflix Premium",
      },
    });
    expect(result).toBeTruthy();
    expect(result?.message).toContain("Netflix");
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
      title: "Meeting dengan klien",
      values: {
        amount: "Rp75.000",
        type: "expense",
        title: "Meeting dengan klien",
      },
    });
    expect(result).toBeNull();
  });

  it("exposes the compiled list of title triggers", () => {
    expect(Array.isArray(MONEY_TALK_TITLE_TRIGGERS)).toBe(true);
    expect(MONEY_TALK_TITLE_TRIGGERS.length).toBeGreaterThan(0);
    expect(MONEY_TALK_TITLE_TRIGGERS).toEqual(
      expect.arrayContaining(["kopi", "coffee", "sepatu"])
    );
    const uniqueCount = new Set(MONEY_TALK_TITLE_TRIGGERS).size;
    expect(uniqueCount).toBe(MONEY_TALK_TITLE_TRIGGERS.length);
  });
});
