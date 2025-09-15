import { describe, it, expect } from "vitest";
import {
  calcBackoff,
  groupOps,
  normalizeRecord,
  resolveConflict,
} from "./utils";

const fakeRand = () => 0; // deterministic jitter

describe("calcBackoff", () => {
  it("doubles delay with cap", () => {
    expect(calcBackoff(0, fakeRand)).toBe(800);
    expect(calcBackoff(1, fakeRand)).toBe(1600);
    expect(calcBackoff(5, fakeRand)).toBe(15000);
  });
});

describe("groupOps", () => {
  it("groups by entity and type", () => {
    const ops = [
      { entity: "transactions", type: "UPSERT", ts: 2 },
      { entity: "transactions", type: "UPSERT", ts: 1 },
      { entity: "categories", type: "DELETE", ts: 3 },
    ];
    const groups = groupOps(ops);
    expect(groups.length).toBe(2);
    expect(groups[0].items[0].ts).toBe(1);
    expect(groups[0].items[1].ts).toBe(2);
  });
});

describe("normalizeRecord", () => {
  it("ensures id and updated_at", () => {
    const n = normalizeRecord({});
    expect(n.id).toBeTypeOf("string");
    expect(n.updated_at).toBeTypeOf("string");
  });
});

describe("resolveConflict", () => {
  it("prefers local by default", () => {
    const server = { rev: 1 };
    const local = { rev: 2 };
    expect(resolveConflict(server, local)).toBe(local);
  });
  it("can prefer server", () => {
    const server = { updated_at: "2024-01-02" };
    const local = { updated_at: "2024-01-03" };
    expect(resolveConflict(server, local, "server")).toBe(server);
  });
});
