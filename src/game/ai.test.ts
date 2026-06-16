import { describe, it, expect } from "vitest";
import { computeLaunch, placement } from "./ai";
import { generateTrack, pathPointAt } from "./track";
import { mulberry32 } from "./rng";
import type { Racer, GameState, BotType } from "./types";
import * as V from "./vector";

const track = generateTrack(2024, "le-minou");

/** Point on the course path at progress t. */
const P = (t: number) => pathPointAt(track, t);

function racer(id: string, progress: number, opts: Partial<Racer> = {}): Racer {
  const pos = P(progress);
  return {
    id,
    name: id,
    isHuman: false,
    botType: "sniper",
    pos,
    color: "#fff",
    state: "idle",
    skipNextTurn: false,
    lastInBoundsPos: pos,
    progress,
    ...opts,
  };
}

function makeState(racers: Racer[]): GameState {
  return {
    phase: "TURN_CYCLE",
    turnSubPhase: "INPUT",
    track,
    lobbyTracks: [],
    racers,
    activeTurn: 0,
    turnOrder: racers.map((r) => r.id),
    round: 1,
    winnerId: null,
    seed: 1,
    finishedCount: 0,
    trails: [],
  };
}

const rng = () => mulberry32(1);

/** Is the launch heading roughly toward the finish? */
const forwardish = (l: { dir: { x: number; y: number } }, pos: { x: number; y: number }) => {
  const toFinish = V.normalize(V.sub(track.finish, pos));
  return V.dot(l.dir, toFinish) > 0.2;
};

describe("placement", () => {
  it("ranks by progress (higher = better)", () => {
    const a = racer("a", 0.5);
    const b = racer("b", 0.2);
    expect(placement(a, [a, b])).toBe(1);
    expect(placement(b, [a, b])).toBe(2);
  });
});

describe("bully", () => {
  it("aims at the nearest opponent within range, high power", () => {
    const self = racer("bully", 0.3, { botType: "bully" });
    // Place prey 10m away (within BULLY_RANGE=18)
    const prey = racer("prey", 0.35, {
      pos: V.add(self.pos, { x: 10, y: 0 }),
    });
    const l = computeLaunch(self, makeState([self, prey]), rng());
    const toPrey = V.normalize(V.sub(prey.pos, self.pos));
    expect(V.dot(l.dir, toPrey)).toBeGreaterThan(0.8);
    expect(l.power).toBeGreaterThan(0.9);
  });

  it("aims forward along the path when no opponent is in range", () => {
    const self = racer("bully", 0.3, { botType: "bully" });
    const far = racer("far", 0.9); // far ahead
    const l = computeLaunch(self, makeState([self, far]), rng());
    expect(forwardish(l, self.pos)).toBe(true);
  });
});

describe("sniper", () => {
  it("aims generally forward when the path is clear", () => {
    const self = racer("snipe", 0.3, { botType: "sniper" });
    const l = computeLaunch(self, makeState([self]), rng());
    expect(forwardish(l, self.pos)).toBe(true);
    expect(l.power).toBeGreaterThan(0.4);
  });
});

describe("daredevil", () => {
  it("always fires at 100% power", () => {
    const self = racer("dd", 0.3, { botType: "daredevil" });
    const l = computeLaunch(self, makeState([self]), rng());
    expect(l.power).toBe(1);
  });
});

describe("navigator", () => {
  it("switches to bully logic when trailing (3rd+)", () => {
    const self = racer("nav", 0.1, { botType: "navigator" });
    const o1 = racer("o1", 0.6);
    const o2 = racer("o2", 0.7);
    // prey is nearby (9m)
    const prey = racer("prey", 0.12, {
      pos: V.add(self.pos, { x: 9, y: 0 }),
    });
    const rs = [self, o1, o2, prey];
    expect(placement(self, rs)).toBeGreaterThanOrEqual(3);
    const l = computeLaunch(self, makeState(rs), rng());
    const toPrey = V.normalize(V.sub(prey.pos, self.pos));
    expect(V.dot(l.dir, toPrey)).toBeGreaterThan(0.5);
  });

  it("uses sniper logic (forward) when leading", () => {
    const self = racer("nav", 0.7, { botType: "navigator" });
    const trailer = racer("t", 0.1);
    const l = computeLaunch(self, makeState([self, trailer]), rng());
    expect(forwardish(l, self.pos)).toBe(true);
  });
});

describe("beachcomber", () => {
  it("is seed-deterministic", () => {
    const self = racer("bc", 0.3, { botType: "beachcomber" });
    const s = makeState([self]);
    const l1 = computeLaunch(self, s, mulberry32(99));
    const l2 = computeLaunch(self, s, mulberry32(99));
    expect(l1).toEqual(l2);
  });

  it("keeps power within 0.4–1.0", () => {
    const self = racer("bc", 0.3, { botType: "beachcomber" });
    const l = computeLaunch(self, makeState([self]), mulberry32(77));
    expect(l.power).toBeGreaterThanOrEqual(0.4);
    expect(l.power).toBeLessThanOrEqual(1.0);
  });
});

describe("coast-glider", () => {
  it("uses low efficient power, heading forward", () => {
    const self = racer("cg", 0.3, { botType: "coastglider" });
    const l = computeLaunch(self, makeState([self]), rng());
    expect(l.power).toBeLessThanOrEqual(0.55);
    expect(forwardish(l, self.pos)).toBe(true);
  });
});

describe("computeLaunch contract", () => {
  it("returns a unit direction and clamped power for every archetype", () => {
    const types: BotType[] = [
      "bully", "sniper", "beachcomber", "navigator", "coastglider", "daredevil",
    ];
    for (const bt of types) {
      const self = racer(bt, 0.3, { botType: bt });
      const l = computeLaunch(self, makeState([self]), mulberry32(7));
      expect(V.len(l.dir)).toBeCloseTo(1, 6);
      expect(l.power).toBeGreaterThanOrEqual(0.05);
      expect(l.power).toBeLessThanOrEqual(1);
    }
  });
});
