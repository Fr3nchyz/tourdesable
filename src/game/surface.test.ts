import { describe, it, expect } from "vitest";
import {
  materialFor,
  zoneAt,
  sinkToStop,
  surfaceAt,
  valueNoise2D,
  grainAt,
  onTrail,
  trailFrictionMultiplier,
  camberLateral,
} from "./surface";
import { recordTrail } from "./engine";
import { decayTrails } from "./stateMachine";
import { createInitialState } from "./stateMachine";
import { generateTrack, pathPointAt } from "./track";
import {
  SAND_MATERIAL,
  LOOSE_SAND_BERM_MATERIAL,
  GRANITE_ROCK_MATERIAL,
  CAMBER_GAIN,
  SINK_GAIN,
  TRAIL_LIFETIME,
} from "./constants";
import type { GameState, TrailSegment } from "./types";

const track = generateTrack(2024, "trez-hir");

/** A point on the carved channel (sand zone) at progress fraction t. */
const onChannel = (t: number) => pathPointAt(track, t);

describe("sinkToStop", () => {
  it("is near zero at launch speed", () => {
    expect(sinkToStop(9)).toBeLessThan(0.01);
  });

  it("peaks at the sink gain when at rest", () => {
    expect(sinkToStop(0)).toBeCloseTo(SINK_GAIN, 5);
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

describe("valueNoise2D", () => {
  it("is deterministic for the same inputs", () => {
    expect(valueNoise2D(3.2, 7.8, 99)).toBe(valueNoise2D(3.2, 7.8, 99));
  });

  it("stays within [-1, 1]", () => {
    for (let i = 0; i < 500; i++) {
      const v = valueNoise2D(i * 0.37, i * 0.91 + 0.5, 12345);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("varies across positions (not constant)", () => {
    const a = valueNoise2D(1.5, 2.5, 7);
    const b = valueNoise2D(40.5, 80.5, 7);
    expect(a).not.toBe(b);
  });
});

describe("grainAt", () => {
  it("is bounded by [-1, 1] across the course", () => {
    for (let x = -20; x <= 20; x += 4)
      for (let z = 0; z <= 90; z += 9) {
        const g = grainAt(track, { x, y: z });
        expect(Math.abs(g)).toBeLessThanOrEqual(1);
      }
  });
});

describe("zones (B3)", () => {
  it("classifies the carved channel as sand", () => {
    const c = onChannel(0.4);
    expect(zoneAt(track, c)).toBe("sand");
    expect(materialFor(track, c)).toEqual(SAND_MATERIAL);
  });

  it("classifies sand well off the channel as loose_sand_berm", () => {
    const c = onChannel(0.4);
    // Push far to the side of the centreline, still inside the course width.
    const wide = { x: c.x + (c.x >= 0 ? -8 : 8), y: c.y };
    expect(zoneAt(track, wide)).toBe("loose_sand_berm");
    expect(materialFor(track, wide)).toEqual(LOOSE_SAND_BERM_MATERIAL);
  });

  it("classifies the apron around a rock as granite_rock", () => {
    const rock = track.rocks[0];
    expect(zoneAt(track, { x: rock.pos.x, y: rock.pos.y })).toBe("granite_rock");
    expect(materialFor(track, { x: rock.pos.x, y: rock.pos.y })).toEqual(
      GRANITE_ROCK_MATERIAL,
    );
  });

  it("loose berm has higher base drag than the sand channel", () => {
    expect(LOOSE_SAND_BERM_MATERIAL.baseFriction).toBeGreaterThan(
      SAND_MATERIAL.baseFriction,
    );
  });

  it("a wide line bogs down: berm damping > channel damping at speed", () => {
    const c = onChannel(0.4);
    const vel = { x: 0, y: 6 };
    const onLine = surfaceAt(track, [], c, vel).damping;
    const wide = { x: c.x + (c.x >= 0 ? -8 : 8), y: c.y };
    const offLine = surfaceAt(track, [], wide, vel).damping;
    expect(offLine).toBeGreaterThan(onLine);
  });
});

describe("trails", () => {
  const seg: TrailSegment = { a: { x: 0, y: 10 }, b: { x: 0, y: 30 }, turnsLeft: 2 };

  it("onTrail is true on the channel, false off it", () => {
    expect(onTrail([seg], { x: 0, y: 20 })).toBe(true);
    expect(onTrail([seg], { x: 10, y: 20 })).toBe(false);
  });

  it("ignores expired segments", () => {
    expect(onTrail([{ ...seg, turnsLeft: 0 }], { x: 0, y: 20 })).toBe(false);
  });

  it("trailFrictionMultiplier < 1 on a channel, == 1 off it", () => {
    expect(trailFrictionMultiplier(track, [seg], { x: 0, y: 20 })).toBeLessThan(1);
    expect(trailFrictionMultiplier(track, [seg], { x: 10, y: 20 })).toBe(1);
  });

  it("recordTrail appends down-sampled segments", () => {
    const s = createInitialState(1);
    const path = Array.from({ length: 60 }, (_, i) => ({ x: 0, y: i }));
    recordTrail(s, path);
    expect(s.trails.length).toBeGreaterThan(0);
    expect(s.trails.every((t) => t.turnsLeft === TRAIL_LIFETIME)).toBe(true);
  });

  it("recordTrail ignores too-short paths", () => {
    const s = createInitialState(1);
    recordTrail(s, [{ x: 0, y: 0 }]);
    expect(s.trails).toHaveLength(0);
  });

  it("decayTrails decrements turnsLeft and prunes expired", () => {
    const s = createInitialState(1) as GameState;
    s.trails = [
      { a: { x: 0, y: 0 }, b: { x: 0, y: 5 }, turnsLeft: 1 },
      { a: { x: 1, y: 0 }, b: { x: 1, y: 5 }, turnsLeft: 3 },
    ];
    decayTrails(s);
    expect(s.trails).toHaveLength(1);
    expect(s.trails[0].turnsLeft).toBe(2);
  });
});

describe("camberLateral", () => {
  const vel = { x: 0, y: 5 };

  // Camber is deliberately disabled (CAMBER_GAIN = 0 in constants.ts — it read as
  // sideways gravity on sloped terrain). These tests pin the current contract and
  // still exercise the side/offset direction logic whenever it is re-enabled.
  it("is disabled by default → zero force everywhere", () => {
    expect(CAMBER_GAIN).toBe(0);
    expect(Math.abs(camberLateral(track, { x: 6, y: 40 }, vel).x)).toBe(0);
    expect(Math.abs(camberLateral(track, { x: -6, y: 40 }, vel).x)).toBe(0);
  });

  it("when enabled, pushes toward the nearer shoulder and grows with offset", () => {
    if (CAMBER_GAIN === 0) return; // contract above; nothing to check while disabled
    expect(camberLateral(track, { x: 6, y: 40 }, vel).x).toBeGreaterThan(0);
    expect(camberLateral(track, { x: -6, y: 40 }, vel).x).toBeLessThan(0);
    const near = Math.abs(camberLateral(track, { x: 2, y: 40 }, vel).x);
    const far = Math.abs(camberLateral(track, { x: 8, y: 40 }, vel).x);
    expect(far).toBeGreaterThan(near);
  });

  it("is zero exactly at the lane centre", () => {
    expect(camberLateral(track, { x: 0, y: 40 }, vel)).toEqual({ x: 0, y: 0 });
  });

  it("vanishes at rest (settle-safe)", () => {
    expect(camberLateral(track, { x: 8, y: 40 }, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });
});

describe("surfaceAt", () => {
  it("damping stays within grain bounds on the channel when moving fast", () => {
    const base = SAND_MATERIAL.baseFriction;
    for (let t = 0.1; t <= 0.9; t += 0.1) {
      const s = surfaceAt(track, [], onChannel(t), { x: 7, y: 0 });
      expect(s.damping).toBeGreaterThan(base - SAND_MATERIAL.grainResistance - 0.01);
      expect(s.damping).toBeLessThan(base + SAND_MATERIAL.grainResistance + 0.05);
    }
  });

  it("damping ramps above baseFriction at rest (thud)", () => {
    const s = surfaceAt(track, [], onChannel(0.4), { x: 0, y: 0 });
    // sinkToStop(0) = SINK_GAIN; allow grain to subtract a little.
    expect(s.damping).toBeGreaterThan(
      SAND_MATERIAL.baseFriction + SINK_GAIN - SAND_MATERIAL.grainResistance,
    );
  });

  it("applies no lateral force at rest (settle-safe)", () => {
    const s = surfaceAt(track, [], { x: 5, y: 40 }, { x: 0, y: 0 });
    expect(s.lateral).toEqual({ x: 0, y: 0 });
  });

  it("a carved channel lowers damping vs bare sand at the same spot", () => {
    const pos = onChannel(0.2);
    const vel = { x: 0, y: 5 };
    const bare = surfaceAt(track, [], pos, vel).damping;
    const seg: TrailSegment = {
      a: { x: pos.x, y: pos.y - 10 },
      b: { x: pos.x, y: pos.y + 10 },
      turnsLeft: 2,
    };
    const carved = surfaceAt(track, [seg], pos, vel).damping;
    expect(carved).toBeLessThan(bare);
  });

  it("produces a lateral wobble while rolling fast", () => {
    // at least one sampled position yields a non-zero lateral nudge
    let sawWobble = false;
    for (let t = 0; t <= 0.9 && !sawWobble; t += 0.02) {
      const s = surfaceAt(track, [], onChannel(t), { x: 0, y: 5 });
      if (s.lateral.x !== 0 || s.lateral.y !== 0) sawWobble = true;
    }
    expect(sawWobble).toBe(true);
  });
});
