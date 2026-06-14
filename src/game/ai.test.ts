import { describe, it, expect } from "vitest";
import { computeLaunch, placement } from "./ai";
import { generateTrack, centerlineXAt } from "./track";
import { mulberry32 } from "./rng";
import type { Racer, GameState, BotType, WaveState, Vector2D } from "./types";
import * as V from "./vector";

const track = generateTrack(2024);
const midY = track.height * 0.6;
const cx = centerlineXAt(track, midY);

function racer(
  id: string,
  pos: Vector2D,
  opts: Partial<Racer> = {},
): Racer {
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
    progress: track.centerline[0].y - pos.y,
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

describe("placement", () => {
  it("ranks by progress", () => {
    const a = racer("a", { x: cx, y: 400 }); // further up = more progress
    const b = racer("b", { x: cx, y: 900 });
    const rs = [a, b];
    expect(placement(a, rs)).toBe(1);
    expect(placement(b, rs)).toBe(2);
  });
});

describe("bully", () => {
  it("aims at the nearest opponent within range, high power", () => {
    const self = racer("bully", { x: cx, y: midY }, { botType: "bully" });
    const prey = racer("prey", { x: cx + 120, y: midY }); // 120px to the right
    const l = computeLaunch(self, state([self, prey]), rng());
    expect(l.dir.x).toBeGreaterThan(0.8); // pointing right at prey
    expect(l.power).toBeGreaterThan(0.9);
  });

  it("aims up-track when no opponent in range", () => {
    const self = racer("bully", { x: cx, y: midY }, { botType: "bully" });
    const far = racer("far", { x: cx, y: midY - 800 }); // >300px away
    const l = computeLaunch(self, state([self, far]), rng());
    expect(l.dir.y).toBeLessThan(0); // pointing up-track
  });
});

describe("sniper", () => {
  it("caps power at 45% under a wave warning", () => {
    const self = racer("snipe", { x: cx, y: midY }, { botType: "sniper" });
    const l = computeLaunch(self, state([self], "warning"), rng());
    expect(l.power).toBeLessThanOrEqual(0.45);
    expect(l.dir.y).toBeLessThan(0); // retreats up-track to safety
  });

  it("aims generally up-track when clear", () => {
    const self = racer("snipe", { x: cx, y: midY }, { botType: "sniper" });
    const l = computeLaunch(self, state([self]), rng());
    expect(l.dir.y).toBeLessThan(0);
    expect(l.power).toBeGreaterThan(0.4);
  });
});

describe("daredevil", () => {
  it("always fires at 100% power", () => {
    const self = racer("dd", { x: cx, y: midY }, { botType: "daredevil" });
    const l = computeLaunch(self, state([self]), rng());
    expect(l.power).toBe(1);
  });
});

describe("navigator", () => {
  it("switches to bully logic when trailing (3rd/4th)", () => {
    const self = racer("nav", { x: cx, y: 1000 }, { botType: "navigator" });
    // Two opponents ahead => self is last.
    const o1 = racer("o1", { x: cx, y: 300 });
    const o2 = racer("o2", { x: cx, y: 400 });
    const prey = racer("prey", { x: cx + 100, y: 1000 }); // nearby to ram
    const rs = [self, o1, o2, prey];
    expect(placement(self, rs)).toBeGreaterThanOrEqual(3);
    const l = computeLaunch(self, state(rs), rng());
    expect(l.dir.x).toBeGreaterThan(0.5); // ramming the nearby prey (bully)
  });

  it("uses sniper logic when leading", () => {
    const self = racer("nav", { x: cx, y: 300 }, { botType: "navigator" });
    const trailer = racer("t", { x: cx + 100, y: 1100 });
    const l = computeLaunch(self, state([self, trailer]), rng());
    expect(l.dir.y).toBeLessThan(0); // heads to finish, not at the far trailer
  });
});

describe("beachcomber", () => {
  it("keeps power within the erratic band and is seed-deterministic", () => {
    const self = racer("bc", { x: cx, y: midY }, { botType: "beachcomber" });
    const l1 = computeLaunch(self, state([self]), mulberry32(99));
    const l2 = computeLaunch(self, state([self]), mulberry32(99));
    expect(l1).toEqual(l2);
    expect(l1.power).toBeGreaterThanOrEqual(0.4);
    expect(l1.power).toBeLessThanOrEqual(1.0);
  });
});

describe("coast-glider", () => {
  it("uses low efficient power", () => {
    const self = racer("cg", { x: cx, y: midY }, { botType: "coastglider" });
    const l = computeLaunch(self, state([self]), rng());
    expect(l.power).toBeLessThanOrEqual(0.6);
    expect(l.dir.y).toBeLessThan(0);
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
      const self = racer(bt, { x: cx, y: midY }, { botType: bt });
      const l = computeLaunch(self, state([self]), mulberry32(7));
      expect(V.len(l.dir)).toBeCloseTo(1, 6);
      expect(l.power).toBeGreaterThanOrEqual(0.05);
      expect(l.power).toBeLessThanOrEqual(1);
    }
  });
});
