import { describe, it, expect } from "vitest";
import {
  generateTrack,
  centerlineXAt,
  offsetFromCenter,
  progressFor,
  isOutOfBounds,
  hasCrossedFinish,
} from "./track";
import { RACER_COUNT } from "./constants";

describe("track generation", () => {
  it("is deterministic for a seed", () => {
    expect(generateTrack(777)).toEqual(generateTrack(777));
  });

  it("different seeds produce different tracks", () => {
    const a = generateTrack(1);
    const b = generateTrack(2);
    expect(a.centerline).not.toEqual(b.centerline);
  });

  it("centerline runs start(bottom) -> finish(top) with finish near top", () => {
    const t = generateTrack(33);
    const first = t.centerline[0];
    const last = t.centerline[t.centerline.length - 1];
    expect(first.y).toBeGreaterThan(last.y); // bottom has larger y
    expect(last.y).toBe(t.finishY);
  });

  it("corridor stays within the board horizontally", () => {
    const t = generateTrack(8);
    for (const wp of t.centerline) {
      expect(wp.x - t.corridorHalfWidth).toBeGreaterThanOrEqual(0);
      expect(wp.x + t.corridorHalfWidth).toBeLessThanOrEqual(t.width);
    }
  });

  it("spawns one start position per racer", () => {
    const t = generateTrack(5);
    expect(t.startGrid).toHaveLength(RACER_COUNT);
  });

  it("centerlineXAt clamps beyond the ends", () => {
    const t = generateTrack(11);
    expect(centerlineXAt(t, t.height + 500)).toBe(t.centerline[0].x);
    expect(centerlineXAt(t, -500)).toBe(t.centerline[t.centerline.length - 1].x);
  });

  it("offsetFromCenter is ~0 on the centerline", () => {
    const t = generateTrack(4);
    const y = t.height / 2;
    const onLine = { x: centerlineXAt(t, y), y };
    expect(offsetFromCenter(t, onLine)).toBeCloseTo(0, 6);
  });

  it("progress increases toward the finish", () => {
    const t = generateTrack(9);
    const low = progressFor(t, { x: 0, y: t.centerline[0].y }); // start
    const high = progressFor(t, { x: 0, y: t.finishY }); // finish
    expect(high).toBeGreaterThan(low);
  });

  it("detects out-of-bounds past the corridor wall", () => {
    const t = generateTrack(2);
    const y = t.height / 2;
    const cx = centerlineXAt(t, y);
    expect(isOutOfBounds(t, { x: cx, y })).toBe(false);
    expect(isOutOfBounds(t, { x: cx + t.corridorHalfWidth + 5, y })).toBe(true);
  });

  it("detects finish crossing", () => {
    const t = generateTrack(6);
    expect(hasCrossedFinish(t, { x: 100, y: t.finishY - 1 })).toBe(true);
    expect(hasCrossedFinish(t, { x: 100, y: t.finishY + 50 })).toBe(false);
  });
});
