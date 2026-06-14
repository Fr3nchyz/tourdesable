import { describe, it, expect } from "vitest";
import { generateTrack, centerlineXAt } from "./track";
import { zoneAt, frictionForZone } from "./friction";
import { isStopped, integrate, rippleEffect, advanceVelocity } from "./physics";
import {
  BASE_FRICTION,
  SHOULDER_FRICTION,
  STOP_THRESHOLD,
  RIPPLE_WITH_DRAG_MULT,
  RIPPLE_AGAINST_DRAG_MULT,
} from "./constants";
import type { WaveState } from "./types";

const noWave: WaveState = { phase: "none", aftermathRoundsLeft: 0, zoneTopY: 0 };

describe("friction zones", () => {
  const t = generateTrack(123);
  const midY = t.height / 2;
  const cx = centerlineXAt(t, midY);

  it("centerline is the racing lane (baseline friction)", () => {
    expect(zoneAt(t, { x: cx, y: midY }, noWave)).toBe("lane");
    expect(frictionForZone("lane")).toBe(BASE_FRICTION);
  });

  it("just outside the lane is the dry shoulder (2x)", () => {
    const p = { x: cx + t.laneHalfWidth + 5, y: midY };
    expect(zoneAt(t, p, noWave)).toBe("shoulder");
    expect(frictionForZone("shoulder")).toBe(SHOULDER_FRICTION);
    expect(SHOULDER_FRICTION).toBe(BASE_FRICTION * 2);
  });

  it("beyond the corridor is out", () => {
    const p = { x: cx + t.corridorHalfWidth + 50, y: midY };
    expect(zoneAt(t, p, noWave)).toBe("out");
  });

  it("waterlogged zone applies during aftermath in the lower band", () => {
    const wave: WaveState = {
      phase: "aftermath",
      aftermathRoundsLeft: 2,
      zoneTopY: t.height * 0.6,
    };
    const low = { x: centerlineXAt(t, t.height * 0.8), y: t.height * 0.8 };
    expect(zoneAt(t, low, wave)).toBe("waterlogged");
  });
});

describe("sand drag", () => {
  it("isStopped respects the threshold", () => {
    expect(isStopped({ x: STOP_THRESHOLD / 2, y: 0 })).toBe(true);
    expect(isStopped({ x: 1, y: 0 })).toBe(false);
  });

  it("integrate advances position", () => {
    expect(integrate({ x: 1, y: 2 }, { x: 3, y: -1 })).toEqual({ x: 4, y: 1 });
  });

  it("velocity decays toward zero in the lane and eventually stops", () => {
    const t = generateTrack(50);
    const midY = t.height / 2;
    let pos = { x: centerlineXAt(t, midY), y: midY };
    let vel = { x: 0, y: -10 }; // straight up the lane
    let frames = 0;
    while (vel.x !== 0 || vel.y !== 0) {
      const r = advanceVelocity(t, pos, vel, noWave);
      vel = r.vel;
      pos = integrate(pos, vel);
      if (++frames > 10000) break;
    }
    expect(frames).toBeLessThan(10000);
    expect(vel).toEqual({ x: 0, y: 0 });
  });

  it("kelp contact stops the marble instantly", () => {
    const t = generateTrack(7);
    const kelp = t.obstacles.find((o) => o.kind === "kelp");
    if (!kelp) return; // seed-dependent; skip if absent
    const r = advanceVelocity(t, kelp.pos, { x: 8, y: 0 }, noWave);
    expect(r.zone).toBe("kelp");
    expect(r.vel).toEqual({ x: 0, y: 0 });
  });
});

describe("ripple modifiers", () => {
  it("moving along the ripple reduces drag", () => {
    const eff = rippleEffect({ x: 1, y: 0 }, 0); // velocity parallel to ripple
    expect(eff.dragMult).toBe(RIPPLE_WITH_DRAG_MULT);
    expect(eff.wobble).toBe(0);
  });

  it("moving across the ripple increases drag and adds wobble", () => {
    const eff = rippleEffect({ x: 0, y: 1 }, 0); // perpendicular
    expect(eff.dragMult).toBe(RIPPLE_AGAINST_DRAG_MULT);
    expect(eff.wobble).toBeGreaterThan(0);
  });

  it("opposite direction still counts as aligned (bidirectional lines)", () => {
    const eff = rippleEffect({ x: -1, y: 0 }, 0);
    expect(eff.dragMult).toBe(RIPPLE_WITH_DRAG_MULT);
  });
});
