import { describe, it, expect } from "vitest";
import { computeLaunch, placement } from "./ai";
import { generateTrack, loopPointAt, tangentAt, nearestOnLoop } from "./track";
import { mulberry32 } from "./rng";
import type { Racer, GameState, BotType, WaveState, Vector2D } from "./types";
import * as V from "./vector";

const track = generateTrack(2024);

/** Centerline point at loop param t. */
const P = (t: number) => loopPointAt(track, t);

function racer(id: string, pos: Vector2D, opts: Partial<Racer> = {}): Racer {
  const loopT = nearestOnLoop(track, pos).t;
  const lap = opts.lap ?? 0;
  return {
    id,
    name: id,
    isHuman: false,
    botType: "sniper",
    pos,
    vel: { x: 0, y: 0 },
    radius: 16,
    mass: 1,
    color: "#fff",
    state: "idle",
    skipNextTurn: false,
    lastInBoundsPos: pos,
    progress: lap + loopT,
    lap,
    loopT,
    passedHalf: false,
    ...opts,
  };
}

function state(racers: Racer[], wavePhase: WaveState["phase"] = "none"): GameState {
  return {
    phase: "TURN_CYCLE",
    turnSubPhase: "INPUT",
    track,
    lobbyTracks: [],
    racers,
    activeTurn: 0,
    turnOrder: racers.map((r) => r.id),
    round: 1,
    wave: { phase: wavePhase, aftermathRoundsLeft: 0, zoneTopY: track.height * 0.6 },
    winnerId: null,
    seed: 1,
    finishedCount: 0,
  };
}

const rng = () => mulberry32(1);

/** Is the launch heading roughly forward along the loop at the racer's spot? */
const forwardish = (l: { dir: Vector2D }, r: Racer) =>
  V.dot(l.dir, tangentAt(track, r.loopT)) > 0;

describe("placement", () => {
  it("ranks by progress (lap + loopT)", () => {
    const a = racer("a", P(0.5));
    const b = racer("b", P(0.2));
    const rs = [a, b];
    expect(placement(a, rs)).toBe(1);
    expect(placement(b, rs)).toBe(2);
  });
});

describe("bully", () => {
  it("aims at the nearest opponent within range, high power", () => {
    const self = racer("bully", P(0.3), { botType: "bully" });
    const prey = racer("prey", V.add(self.pos, { x: 120, y: 0 }));
    const l = computeLaunch(self, state([self, prey]), rng());
    const toPrey = V.normalize(V.sub(prey.pos, self.pos));
    expect(V.dot(l.dir, toPrey)).toBeGreaterThan(0.8);
    expect(l.power).toBeGreaterThan(0.9);
  });

  it("aims forward along the loop when no opponent is in range", () => {
    const self = racer("bully", P(0.3), { botType: "bully" });
    const far = racer("far", P(0.6)); // > 300px away
    const l = computeLaunch(self, state([self, far]), rng());
    expect(forwardish(l, self)).toBe(true);
  });
});

describe("sniper", () => {
  it("caps power at 45% under a wave warning", () => {
    const self = racer("snipe", P(0.3), { botType: "sniper" });
    const l = computeLaunch(self, state([self], "warning"), rng());
    expect(l.power).toBeLessThanOrEqual(0.45);
  });

  it("aims generally forward when clear", () => {
    const self = racer("snipe", P(0.3), { botType: "sniper" });
    const l = computeLaunch(self, state([self]), rng());
    expect(forwardish(l, self)).toBe(true);
    expect(l.power).toBeGreaterThan(0.4);
  });
});

describe("daredevil", () => {
  it("always fires at 100% power", () => {
    const self = racer("dd", P(0.3), { botType: "daredevil" });
    const l = computeLaunch(self, state([self]), rng());
    expect(l.power).toBe(1);
  });
});

describe("navigator", () => {
  it("switches to bully logic when trailing", () => {
    const self = racer("nav", P(0.1), { botType: "navigator" });
    const o1 = racer("o1", P(0.6));
    const o2 = racer("o2", P(0.7));
    const prey = racer("prey", V.add(self.pos, { x: 90, y: 0 }));
    const rs = [self, o1, o2, prey];
    expect(placement(self, rs)).toBeGreaterThanOrEqual(3);
    const l = computeLaunch(self, state(rs), rng());
    const toPrey = V.normalize(V.sub(prey.pos, self.pos));
    expect(V.dot(l.dir, toPrey)).toBeGreaterThan(0.5);
  });

  it("uses sniper logic (forward) when leading", () => {
    const self = racer("nav", P(0.7), { botType: "navigator" });
    const trailer = racer("t", P(0.1));
    const l = computeLaunch(self, state([self, trailer]), rng());
    expect(forwardish(l, self)).toBe(true);
  });
});

describe("beachcomber", () => {
  it("keeps power within the erratic band and is seed-deterministic", () => {
    const self = racer("bc", P(0.3), { botType: "beachcomber" });
    const l1 = computeLaunch(self, state([self]), mulberry32(99));
    const l2 = computeLaunch(self, state([self]), mulberry32(99));
    expect(l1).toEqual(l2);
    expect(l1.power).toBeGreaterThanOrEqual(0.4);
    expect(l1.power).toBeLessThanOrEqual(1.0);
  });
});

describe("coast-glider", () => {
  it("uses low efficient power, heading forward", () => {
    const self = racer("cg", P(0.3), { botType: "coastglider" });
    const l = computeLaunch(self, state([self]), rng());
    expect(l.power).toBeLessThanOrEqual(0.6);
    expect(forwardish(l, self)).toBe(true);
  });
});

describe("computeLaunch contract", () => {
  it("returns a unit direction and clamped power for every archetype", () => {
    const types: BotType[] = [
      "bully",
      "sniper",
      "beachcomber",
      "navigator",
      "coastglider",
      "daredevil",
    ];
    for (const bt of types) {
      const self = racer(bt, P(0.3), { botType: bt });
      const l = computeLaunch(self, state([self]), mulberry32(7));
      expect(V.len(l.dir)).toBeCloseTo(1, 6);
      expect(l.power).toBeGreaterThanOrEqual(0.05);
      expect(l.power).toBeLessThanOrEqual(1);
    }
  });
});
