import { describe, it, expect } from "vitest";
import { createMoneyTalkLimiter } from "./moneyTalkQueue";

describe("moneyTalk limiter", () => {
  it("limits messages per minute", () => {
    const limiter = createMoneyTalkLimiter("normal"); // max 2 per minute
    const base = 0;
    expect(limiter.tryConsume(base).allowed).toBe(true);
    expect(limiter.tryConsume(base + 1000).allowed).toBe(true);
    // third within same minute should be blocked and return wait time
    const thirdAttempt = limiter.tryConsume(base + 2000);
    expect(thirdAttempt.allowed).toBe(false);
    expect(thirdAttempt.wait).toBeGreaterThan(0);
    // after a minute it should allow again
    expect(limiter.tryConsume(base + 61000).allowed).toBe(true);
  });
});
