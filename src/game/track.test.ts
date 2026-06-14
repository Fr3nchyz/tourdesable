import { describe, it, expect } from "vitest";
import {
  generateTrack,
  heightAt,
  progressAlongPath,
  pathPointAt,
  atFinish,
  isOffCourse,
} from "./track";
import { createInitialState } from "./stateMachine";
import * as V from "./vector";
import { RACER_COUNT, THEMES } from "./constants";

describe("track generation", () => {
  it("is deterministic for the same seed + theme", () => {
    const a = generateTrack(777, "trez-hir");
    const b = generateTrack(777, "trez-hir");
    expect(a).toEqual(b);
  });

  it("different seeds produce different paths", () => {
    const a = generateTrack(1, "trez-hir");
    const b = generateTrack(2, "trez-hir");
    expect(a.path).not.toEqual(b.path);
  });

  it("different themes produce different elevation params", () => {
    const flat = generateTrack(42, "trez-hir");
    const cliff = generateTrack(42, "bertheaume");
    expect(flat.elevation.cliffAmp).toBe(0);
    expect(cliff.elevation.cliffAmp).toBeGreaterThan(0);
  });

  it("generates one theme per THEMES entry in lobby", () => {
    const s = createInitialState(1);
    const themeSet = new Set(s.lobbyTracks.map((t) => t.theme));
    expect(themeSet.size).toBe(THEMES.length);
  });

  it("spawns one start position per racer", () => {
    const t = generateTrack(5, "le-minou");
    expect(t.startGrid).toHaveLength(RACER_COUNT);
  });

  it("start and finish are within course bounds", () => {
    for (const theme of THEMES) {
      const t = generateTrack(99, theme);
      expect(Math.abs(t.start.x)).toBeLessThan(t.width / 2);
      expect(t.start.y).toBeGreaterThanOrEqual(0);
      expect(t.start.y).toBeLessThanOrEqual(t.length);
      expect(Math.abs(t.finish.x)).toBeLessThan(t.width / 2);
      expect(t.finish.y).toBeGreaterThanOrEqual(0);
      expect(t.finish.y).toBeLessThanOrEqual(t.length);
    }
  });
});

describe("heightAt", () => {
  it("trez-hir stays nearly flat (small amplitude)", () => {
    const t = generateTrack(1, "trez-hir");
    const heights: number[] = [];
    for (let x = -20; x <= 20; x += 5)
      for (let z = 0; z <= 90; z += 10)
        heights.push(heightAt(t, x, z));
    const range = Math.max(...heights) - Math.min(...heights);
    expect(range).toBeLessThan(6);
  });

  it("bertheaume has much larger elevation range than trez-hir", () => {
    const flat = generateTrack(1, "trez-hir");
    const cliff = generateTrack(1, "bertheaume");
    const sampleH = (track: typeof flat) => {
      let lo = Infinity, hi = -Infinity;
      for (let x = -20; x <= 20; x += 5)
        for (let z = 0; z <= 90; z += 10) {
          const h = heightAt(track, x, z);
          if (h < lo) lo = h;
          if (h > hi) hi = h;
        }
      return hi - lo;
    };
    expect(sampleH(cliff)).toBeGreaterThan(sampleH(flat));
  });
});

describe("progressAlongPath", () => {
  const t = generateTrack(123, "le-minou");

  it("start position has near-zero progress", () => {
    const p = progressAlongPath(t, t.path[0]);
    expect(p).toBeCloseTo(0, 2);
  });

  it("finish position has near-1 progress", () => {
    const p = progressAlongPath(t, t.path[t.path.length - 1]);
    expect(p).toBeCloseTo(1, 2);
  });

  it("increases monotonically along the path", () => {
    let prev = -1;
    for (let i = 0; i < t.path.length; i++) {
      const p = progressAlongPath(t, t.path[i]);
      expect(p).toBeGreaterThan(prev);
      prev = p;
    }
  });
});

describe("pathPointAt", () => {
  const t = generateTrack(7, "trez-hir");

  it("t=0 returns a point near the start", () => {
    const p = pathPointAt(t, 0);
    expect(V.dist(p, t.start)).toBeLessThan(2);
  });

  it("t=1 returns a point near the finish", () => {
    const p = pathPointAt(t, 1);
    expect(V.dist(p, t.finish)).toBeLessThan(2);
  });
});

describe("atFinish / isOffCourse", () => {
  const t = generateTrack(42, "trez-hir");

  it("finish zone detects marbles at the finish", () => {
    expect(atFinish(t, t.finish)).toBe(true);
    expect(atFinish(t, { x: t.finish.x, y: t.finish.y - 2 })).toBe(true);
  });

  it("does not trigger finish at the start", () => {
    expect(atFinish(t, t.start)).toBe(false);
  });

  it("isOffCourse catches marbles that have left the beach", () => {
    expect(isOffCourse(t, { x: t.width, y: t.length / 2 })).toBe(true);
    expect(isOffCourse(t, { x: 0, y: -5 })).toBe(true);
  });

  it("does not flag the centerline as off course", () => {
    for (const p of t.path) {
      expect(isOffCourse(t, p)).toBe(false);
    }
  });
});
