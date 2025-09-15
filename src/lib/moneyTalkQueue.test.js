import { describe, it, expect } from "vitest";
import { createMoneyTalkLimiter } from "./moneyTalkQueue";

describe("moneyTalk limiter", () => {
  it("limits messages per minute", () => {
    const limiter = createMoneyTalkLimiter("normal"); // max 2 per minute
    const base = 0;
    expect(limiter.tryConsume(base)).toBe(true);
    expect(limiter.tryConsume(base + 1000)).toBe(true);
    // third within same minute should be blocked
    expect(limiter.tryConsume(base + 2000)).toBe(false);
    // after a minute it should allow again
    expect(limiter.tryConsume(base + 61000)).toBe(true);
  });
});
