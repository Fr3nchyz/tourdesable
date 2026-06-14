import { describe, it, expect } from "vitest";
import { mulberry32, randRange, randInt, pick, shuffle } from "./rng";

describe("seeded rng", () => {
  it("is deterministic for a given seed", () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("different seeds diverge", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });

  it("returns values in [0,1)", () => {
    const r = mulberry32(99);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("randRange stays within bounds", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 500; i++) {
      const v = randRange(r, 10, 20);
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThan(20);
    }
  });

  it("randInt is inclusive and integral", () => {
    const r = mulberry32(3);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = randInt(r, 1, 6);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect(seen.size).toBe(6); // all faces hit
  });

  it("pick returns an element of the array", () => {
    const r = mulberry32(42);
    const arr = ["a", "b", "c"];
    for (let i = 0; i < 50; i++) expect(arr).toContain(pick(r, arr));
  });

  it("shuffle preserves multiset and is deterministic per seed", () => {
    const arr = [1, 2, 3, 4, 5];
    const s1 = shuffle(mulberry32(5), arr);
    const s2 = shuffle(mulberry32(5), arr);
    expect(s1).toEqual(s2);
    expect([...s1].sort()).toEqual(arr);
  });
});
