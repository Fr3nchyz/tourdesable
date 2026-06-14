// ============================================================================
// tour-de-sable — AI bot personalities (v3: A→B coastal courses, Rapier)
// Each archetype returns a Launch { dir: Vector2D, power: 0..1 } for the
// active racer. dir is in ground-plane coords (x=worldX, y=worldZ).
// Pure + deterministic given an Rng.
// ============================================================================

import type { Racer, Track, GameState, Launch, Vector2D, BotType } from "./types";
import * as V from "./vector";
import { pathPointAt } from "./track";
import type { Rng } from "./rng";
import { randRange } from "./rng";

// Fraction of path progress to look ahead when computing aim point.
const LOOKAHEAD_T = 0.14;
// Maximum opponent search radius (world metres).
const BULLY_RANGE = 18;
// Path-clear margin for the sniper (metres).
const SAFE_MARGIN = 4;

export { BULLY_RANGE };

// --- shared helpers --------------------------------------------------------

/** A point on the course centerline ahead of the racer by dt progress. */
function aheadPoint(track: Track, self: Racer, dt = LOOKAHEAD_T): Vector2D {
  return pathPointAt(track, Math.min(1, self.progress + dt));
}

const dirTo = (from: Vector2D, to: Vector2D): Vector2D =>
  V.normalize(V.sub(to, from));

/** Angles ordered by increasing |deviation|: 0, +5, -5, +10, -10, … */
function sweepOrder(maxDeg: number, step: number): number[] {
  const out = [0];
  for (let d = step; d <= maxDeg; d += step) out.push(d, -d);
  return out;
}

/** Nearest active opponent within `range` metres, or null. */
function nearestOpponent(self: Racer, racers: Racer[], range: number): Racer | null {
  let best: Racer | null = null;
  let bestD = range;
  for (const r of racers) {
    if (r.id === self.id) continue;
    if (r.state === "tipped" || r.state === "finished") continue;
    const d = V.dist(self.pos, r.pos);
    if (d < bestD) { bestD = d; best = r; }
  }
  return best;
}

/** 1-based placement by progress (1 = leader). */
export function placement(self: Racer, racers: Racer[]): number {
  const myProg = self.progress;
  let rank = 1;
  for (const r of racers) {
    if (r.id === self.id) continue;
    if (r.progress > myProg) rank++;
  }
  return rank;
}

/**
 * Ray-march the intended shot; returns false if a rock or rival marble is in
 * the way within `margin` metres.
 */
function pathClear(
  self: Racer,
  dir: Vector2D,
  distance: number,
  track: Track,
  racers: Racer[],
  margin: number,
): boolean {
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    const p = V.add(self.pos, V.scale(dir, (distance * i) / steps));
    for (const rock of track.rocks) {
      if (V.dist(p, rock.pos) < rock.radius + margin) return false;
    }
    for (const r of racers) {
      if (r.id === self.id) continue;
      if (r.state === "finished") continue;
      if (V.dist(p, r.pos) < margin) return false;
    }
  }
  return true;
}

// --- personalities ---------------------------------------------------------

/** Bully: ram the nearest opponent within range; otherwise charge ahead. */
function bully(self: Racer, state: GameState): Launch {
  const target = nearestOpponent(self, state.racers, BULLY_RANGE);
  if (target) return { dir: dirTo(self.pos, target.pos), power: 0.95 };
  return { dir: dirTo(self.pos, aheadPoint(state.track!, self)), power: 0.85 };
}

/** Sniper: sweep candidate angles to find a rock-clear line; precise power. */
function sniper(self: Racer, state: GameState): Launch {
  const track = state.track!;
  const base = aheadPoint(track, self);
  const baseAngle = V.angle(V.sub(base, self.pos));
  const distance = V.dist(self.pos, base);

  for (const deg of sweepOrder(35, 5)) {
    const dir = V.fromAngle(baseAngle + (deg * Math.PI) / 180);
    if (pathClear(self, dir, distance, track, state.racers, SAFE_MARGIN)) {
      return { dir, power: 0.72 };
    }
  }
  return { dir: V.fromAngle(baseAngle), power: 0.6 };
}

/** Beach-comber: erratic power (0.4–1.0) + aim wobble up to ±15°. */
function beachcomber(self: Racer, state: GameState, rng: Rng): Launch {
  const track = state.track!;
  const target = aheadPoint(track, self);
  const baseAngle = V.angle(V.sub(target, self.pos));
  const jitter = randRange(rng, -15, 15) * (Math.PI / 180);
  const power = randRange(rng, 0.4, 1.0);
  return { dir: V.fromAngle(baseAngle + jitter), power };
}

/** Navigator: sniper when leading (1st/2nd), bully when trailing. */
function navigator(self: Racer, state: GameState): Launch {
  return placement(self, state.racers) <= 2 ? sniper(self, state) : bully(self, state);
}

/** Coast-Glider: hug the racing line at efficient, low power. */
function coastGlider(self: Racer, state: GameState): Launch {
  const track = state.track!;
  return { dir: dirTo(self.pos, aheadPoint(track, self, 0.2)), power: 0.5 };
}

/** Daredevil: 100% power, aimed straight at the finish. */
function daredevil(self: Racer, state: GameState): Launch {
  const track = state.track!;
  const toFinish = dirTo(self.pos, track.finish);
  const toAhead = dirTo(self.pos, aheadPoint(track, self, 0.2));
  // Blend finish direction with immediate path direction.
  const blended = V.normalize(V.add(toFinish, toAhead));
  return { dir: blended, power: 1.0 };
}

// --- dispatcher ------------------------------------------------------------

const TABLE: Record<BotType, (self: Racer, state: GameState, rng: Rng) => Launch> = {
  bully,
  sniper,
  beachcomber,
  navigator,
  coastglider: coastGlider,
  daredevil,
};

/** Compute a bot's launch for the current state. */
export function computeLaunch(self: Racer, state: GameState, rng: Rng): Launch {
  const fn = TABLE[self.botType ?? "sniper"];
  const launch = fn(self, state, rng);
  return {
    dir: V.len(launch.dir) === 0 ? { x: 0, y: 1 } : V.normalize(launch.dir),
    power: Math.max(0.05, Math.min(1, launch.power)),
  };
}
