import { describe, it, expect } from "vitest";
import * as V from "./vector";

describe("vector math", () => {
  it("add / sub / scale", () => {
    expect(V.add(V.vec(1, 2), V.vec(3, 4))).toEqual({ x: 4, y: 6 });
    expect(V.sub(V.vec(3, 4), V.vec(1, 2))).toEqual({ x: 2, y: 2 });
    expect(V.scale(V.vec(2, -3), 2)).toEqual({ x: 4, y: -6 });
  });

  it("len / lenSq / dist", () => {
    expect(V.len(V.vec(3, 4))).toBe(5);
    expect(V.lenSq(V.vec(3, 4))).toBe(25);
    expect(V.dist(V.vec(0, 0), V.vec(3, 4))).toBe(5);
  });

  it("normalize yields unit length and is safe at zero", () => {
    const n = V.normalize(V.vec(0, 10));
    expect(n).toEqual({ x: 0, y: 1 });
    expect(V.normalize(V.vec(0, 0))).toEqual({ x: 0, y: 0 });
  });

  it("dot", () => {
    expect(V.dot(V.vec(1, 0), V.vec(0, 1))).toBe(0);
    expect(V.dot(V.vec(2, 3), V.vec(4, 5))).toBe(23);
  });

  it("fromAngle / angle round-trip", () => {
    const a = Math.PI / 3;
    const v = V.fromAngle(a, 1);
    expect(V.angle(v)).toBeCloseTo(a, 10);
    expect(V.len(v)).toBeCloseTo(1, 10);
  });

  it("rotate by 90deg", () => {
    const r = V.rotate(V.vec(1, 0), Math.PI / 2);
    expect(r.x).toBeCloseTo(0, 10);
    expect(r.y).toBeCloseTo(1, 10);
  });

  it("reflect off a vertical wall (normal +x) flips x velocity", () => {
    const r = V.reflect(V.vec(-5, 3), V.vec(1, 0));
    expect(r.x).toBeCloseTo(5, 10);
    expect(r.y).toBeCloseTo(3, 10);
  });

  it("lerp midpoint", () => {
    expect(V.lerp(V.vec(0, 0), V.vec(10, 20), 0.5)).toEqual({ x: 5, y: 10 });
  });

  it("angleDiff wraps correctly", () => {
    expect(V.angleDiff(0.1, -0.1)).toBeCloseTo(0.2, 10);
    // 170deg vs -170deg => 20deg apart, not 340
    expect(V.angleDiff((170 * Math.PI) / 180, (-170 * Math.PI) / 180)).toBeCloseTo(
      (20 * Math.PI) / 180,
      10,
    );
  });
});
