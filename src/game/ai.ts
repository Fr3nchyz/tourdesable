// ============================================================================
// tour-de-sable — AI bot personality architectures
// Each archetype evaluates the board during its INPUT phase and returns a
// Launch { dir (unit), power (0..1) }. Pure + deterministic given an Rng.
// ============================================================================

import type { Racer, Track, GameState, Launch, Vector2D, BotType } from "./types";
import * as V from "./vector";
import { centerlineXAt } from "./track";
import type { Rng } from "./rng";
import { randRange } from "./rng";

const LOOKAHEAD = 360; // how far up the corridor bots aim by default
const SAFE_MARGIN = 50; // sniper avoidance radius
const BULLY_RANGE = 300; // bully target scan radius

// --- shared helpers --------------------------------------------------------

/** A point on the centerline a fixed distance up-track from the marble. */
function aheadPoint(track: Track, self: Racer, lookahead = LOOKAHEAD): Vector2D {
  const targetY = Math.max(track.finishY, self.pos.y - lookahead);
  return { x: centerlineXAt(track, targetY), y: targetY };
}

const dirTo = (from: Vector2D, to: Vector2D): Vector2D =>
  V.normalize(V.sub(to, from));

/** Angles ordered by increasing |deviation|: 0, +5, -5, +10, -10, ... */
function sweepOrder(maxDeg: number, step: number): number[] {
  const out = [0];
  for (let d = step; d <= maxDeg; d += step) out.push(d, -d);
  return out;
}

/** Nearest other racer within `range`, or null. Ignores tipped/finished. */
function nearestOpponent(
  self: Racer,
  racers: Racer[],
  range: number,
): Racer | null {
  let best: Racer | null = null;
  let bestD = range;
  for (const r of racers) {
    if (r.id === self.id) continue;
    if (r.state === "tipped" || r.state === "finished") continue;
    const d = V.dist(self.pos, r.pos);
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best;
}

/** 1-based race placement by progress (1 = leader). */
export function placement(self: Racer, racers: Racer[]): number {
  const myProg = self.progress;
  let rank = 1;
  for (const r of racers) {
    if (r.id === self.id) continue;
    if (r.progress > myProg) rank++;
  }
  return rank;
}

/** True if a straight ray clears all kelp + other marbles by `margin`. */
function pathClear(
  self: Racer,
  dir: Vector2D,
  distance: number,
  track: Track,
  racers: Racer[],
  margin: number,
): boolean {
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    const p = V.add(self.pos, V.scale(dir, (distance * i) / steps));
    for (const o of track.obstacles) {
      if (o.kind === "kelp" || o.kind === "clamshell") {
        if (V.dist(p, o.pos) < o.radius + margin) return false;
      }
    }
    for (const r of racers) {
      if (r.id === self.id) continue;
      if (V.dist(p, r.pos) < r.radius + margin) return false;
    }
  }
  return true;
}

/** True while a rogue wave is threatening or active. */
const waveActive = (state: GameState): boolean =>
  state.wave.phase === "warning" ||
  state.wave.phase === "impact" ||
  state.wave.phase === "aftermath";

// --- personalities ---------------------------------------------------------

/** Bully: ram the nearest opponent inside 300px; ignore wave alerts. */
function bully(self: Racer, state: GameState): Launch {
  const target = nearestOpponent(self, state.racers, BULLY_RANGE);
  if (target) {
    return { dir: dirTo(self.pos, target.pos), power: 0.95 };
  }
  return { dir: dirTo(self.pos, aheadPoint(state.track!, self)), power: 0.85 };
}

/**
 * Sniper: precise pathfinding, avoid kelp + marbles by 50px. Under a wave
 * warning, cap power at 45% and fire up-track toward safety.
 */
function sniper(self: Racer, state: GameState): Launch {
  const track = state.track!;
  if (waveActive(state)) {
    // Retreat upward (away from the bottom wave zone) at reduced power.
    return { dir: dirTo(self.pos, aheadPoint(track, self)), power: 0.45 };
  }
  const base = aheadPoint(track, self);
  const baseAngle = V.angle(V.sub(base, self.pos));
  const distance = V.dist(self.pos, base);

  // Sweep candidate angles outward from the ideal line; the first clear one is
  // the straightest (smallest deviation), so take it.
  for (const deg of sweepOrder(35, 5)) {
    const dir = V.fromAngle(baseAngle + (deg * Math.PI) / 180);
    if (pathClear(self, dir, distance, track, state.racers, SAFE_MARGIN)) {
      return { dir, power: 0.72 };
    }
  }
  return { dir: V.fromAngle(baseAngle), power: 0.6 };
}

/** Beach-comber: erratic power (0.4-1.0) and +/-15deg aim wobble. */
function beachcomber(self: Racer, state: GameState, rng: Rng): Launch {
  const track = state.track!;
  let target = aheadPoint(track, self);
  // Chaotically chase the waterlogged hydroplane zone when one exists.
  if (
    (state.wave.phase === "impact" || state.wave.phase === "aftermath") &&
    rng() < 0.5
  ) {
    const zy = Math.min(track.height - 20, state.wave.zoneTopY + 80);
    target = { x: centerlineXAt(track, zy), y: zy };
  }
  const baseAngle = V.angle(V.sub(target, self.pos));
  const jitter = randRange(rng, -15, 15) * (Math.PI / 180);
  const power = randRange(rng, 0.4, 1.0);
  return { dir: V.fromAngle(baseAngle + jitter), power };
}

/** Navigator: Sniper while leading (1st/2nd), Bully when trailing (3rd/4th). */
function navigator(self: Racer, state: GameState): Launch {
  return placement(self, state.racers) <= 2 ? sniper(self, state) : bully(self, state);
}

/**
 * Coast-Glider: ride the low-friction ruts. We approximate the optimal rut as
 * the corridor centerline (the natural racing line) and snake along it with
 * low, efficient power.
 */
function coastGlider(self: Racer, state: GameState): Launch {
  const track = state.track!;
  return { dir: dirTo(self.pos, aheadPoint(track, self, 260)), power: 0.5 };
}

/**
 * Daredevil: always 100% power. Bias the aim toward the wind-ripple direction
 * to chain speed stacks, ignoring kelp + ledges entirely.
 */
function daredevil(self: Racer, state: GameState): Launch {
  const track = state.track!;
  const toFinish = V.sub(aheadPoint(track, self), self.pos);
  const finishAngle = V.angle(toFinish);
  // Pick whichever ripple direction (angle or angle+PI) points more up-track.
  const rA = track.ripple.angle;
  const candA = V.angleDiff(finishAngle, rA);
  const candB = V.angleDiff(finishAngle, rA + Math.PI);
  const rippleAngle = candA <= candB ? rA : rA + Math.PI;
  // Blend the finish heading with the ripple heading for a speed line.
  const blended = V.add(V.fromAngle(finishAngle), V.scale(V.fromAngle(rippleAngle), 0.6));
  return { dir: V.normalize(blended), power: 1.0 };
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
  // Safety clamp.
  return {
    dir: V.len(launch.dir) === 0 ? { x: 0, y: -1 } : V.normalize(launch.dir),
    power: Math.max(0.05, Math.min(1, launch.power)),
  };
}

export { BULLY_RANGE };
