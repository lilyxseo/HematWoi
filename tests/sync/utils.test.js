import { describe, it, expect } from "vitest";
import { calcBackoff, normalize } from "../../src/lib/sync/utils.js";

describe("calcBackoff", () => {
  it("doubles delay", () => {
    expect(calcBackoff(0)).toBe(500);
    expect(calcBackoff(1)).toBe(1000);
    expect(calcBackoff(2)).toBe(2000);
  });
});

describe("normalize", () => {
  it("adds id and rev", () => {
    const rec = normalize("transactions", { amount: 1 });
    expect(rec.id).toBeTruthy();
    expect(rec.rev).toBe(0);
  });
  it("keeps existing", () => {
    const rec = normalize("transactions", { id: "x", rev: 2 });
    expect(rec.id).toBe("x");
    expect(rec.rev).toBe(2);
  });
});
