import { describe, it, expect } from "vitest";
import {
  generateTrack,
  nearestOnLoop,
  loopPointAt,
  tangentAt,
  offsetFromCenter,
  progressFor,
  isPastBerm,
  isOffBoard,
} from "./track";
import * as V from "./vector";
import { RACER_COUNT } from "./constants";

describe("circuit generation", () => {
  it("is deterministic for a seed", () => {
    expect(generateTrack(777)).toEqual(generateTrack(777));
  });

  it("different seeds produce different loops", () => {
    expect(generateTrack(1).loop).not.toEqual(generateTrack(2).loop);
  });

  it("builds a closed loop with monotonic arc lengths", () => {
    const t = generateTrack(33);
    expect(t.loop.length).toBeGreaterThan(16);
    expect(t.cumLen).toHaveLength(t.loop.length + 1);
    expect(t.cumLen[0]).toBe(0);
    for (let i = 1; i < t.cumLen.length; i++) {
      expect(t.cumLen[i]).toBeGreaterThan(t.cumLen[i - 1]);
    }
    expect(t.loopLength).toBeCloseTo(t.cumLen[t.cumLen.length - 1], 6);
  });

  it("keeps the channel inside the board", () => {
    const t = generateTrack(8);
    for (const p of t.loop) {
      expect(p.x - t.trackHalfWidth).toBeGreaterThanOrEqual(0);
      expect(p.y - t.trackHalfWidth).toBeGreaterThanOrEqual(0);
      expect(p.x + t.trackHalfWidth).toBeLessThanOrEqual(t.width);
      expect(p.y + t.trackHalfWidth).toBeLessThanOrEqual(t.height);
    }
  });

  it("spawns one start position per racer", () => {
    expect(generateTrack(5).startGrid).toHaveLength(RACER_COUNT);
  });
});

describe("loop geometry", () => {
  const t = generateTrack(123);

  it("nearestOnLoop puts a centerline point at ~0 lateral", () => {
    const v = t.loop[10];
    const proj = nearestOnLoop(t, v);
    expect(Math.abs(proj.lateral)).toBeLessThan(1e-6);
    expect(proj.t).toBeGreaterThanOrEqual(0);
    expect(proj.t).toBeLessThan(1);
  });

  it("loopPointAt(0) is the start vertex and wraps at 1", () => {
    expect(loopPointAt(t, 0)).toEqual(t.loop[0]);
    expect(loopPointAt(t, 1)).toEqual(loopPointAt(t, 0));
  });

  it("tangentAt returns a unit vector", () => {
    expect(V.len(tangentAt(t, 0.3))).toBeCloseTo(1, 6);
  });

  it("offsetFromCenter is ~0 on the centerline", () => {
    expect(offsetFromCenter(t, t.loop[20])).toBeLessThan(1e-6);
  });

  it("progress (loop param) advances as you move forward along the loop", () => {
    const early = loopPointAt(t, 0.2);
    const later = loopPointAt(t, 0.5);
    expect(progressFor(t, later)).toBeGreaterThan(progressFor(t, early));
  });

  it("detects a marble pushed past the berm", () => {
    const center = loopPointAt(t, 0.4);
    const leftN = V.perp(tangentAt(t, 0.4));
    const inside = V.add(center, V.scale(leftN, t.laneHalfWidth * 0.5));
    const beyond = V.add(center, V.scale(leftN, t.trackHalfWidth + 12));
    expect(isPastBerm(t, inside)).toBe(false);
    expect(isPastBerm(t, beyond)).toBe(true);
  });

  it("detects leaving the board", () => {
    expect(isOffBoard(t, { x: -5, y: 100 })).toBe(true);
    expect(isOffBoard(t, loopPointAt(t, 0.1))).toBe(false);
  });
});
