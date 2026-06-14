import { describe, it, expect } from "vitest";
import { materialFor, sinkToStop, surfaceAt } from "./surface";
import { generateTrack } from "./track";
import { SAND_MATERIAL } from "./constants";

const track = generateTrack(2024, "blancs-sablons");

describe("sinkToStop", () => {
  it("is near zero at launch speed", () => {
    expect(sinkToStop(9)).toBeLessThan(0.01);
  });

  it("peaks at the sink gain when at rest", () => {
    expect(sinkToStop(0)).toBeCloseTo(SAND_MATERIAL.baseFriction * 0 + 2.6, 5);
  });

  it("increases monotonically as speed decreases", () => {
    let prev = -1;
    for (let speed = 8; speed >= 0; speed -= 0.5) {
      const d = sinkToStop(speed);
      expect(d).toBeGreaterThan(prev);
      prev = d;
    }
  });
});

describe("materialFor", () => {
  it("returns the sand material on Blancs-Sablons", () => {
    expect(materialFor(track, { x: 0, y: 40 })).toEqual(SAND_MATERIAL);
  });
});

describe("surfaceAt (P0: material + sink)", () => {
  it("damping ≈ baseFriction when moving fast", () => {
    const s = surfaceAt(track, { x: 0, y: 40 }, { x: 7, y: 0 });
    expect(s.damping).toBeGreaterThan(SAND_MATERIAL.baseFriction);
    expect(s.damping).toBeLessThan(SAND_MATERIAL.baseFriction + 0.05);
  });

  it("damping ramps well above baseFriction at rest (thud)", () => {
    const s = surfaceAt(track, { x: 0, y: 40 }, { x: 0, y: 0 });
    expect(s.damping).toBeGreaterThan(SAND_MATERIAL.baseFriction + 2);
  });

  it("applies no lateral force at rest (settle-safe)", () => {
    const s = surfaceAt(track, { x: 5, y: 40 }, { x: 0, y: 0 });
    expect(s.lateral).toEqual({ x: 0, y: 0 });
  });
});
