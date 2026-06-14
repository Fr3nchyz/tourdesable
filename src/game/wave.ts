// ============================================================================
// tour-de-sable — The Blancs-Sablons Surge (rogue wave)
// Lifecycle: roll at round end (>=R3, 20%) -> warning -> impact (push caught
// marbles back) -> aftermath (2 rounds of waterlogged lower zone + temp kelp).
// Pure logic; the engine drives the warning/impact/aftermath timing + FX.
// ============================================================================

import type {
  Racer,
  Track,
  WaveState,
  CircleObstacle,
  Vector2D,
} from "./types";
import {
  nearestOnLoop,
  loopPointAt,
  tangentAt,
  isPastBerm,
  isOffBoard,
} from "./track";
import * as V from "./vector";
import type { Rng } from "./rng";
import { randRange, pick } from "./rng";
import {
  WAVE_START_ROUND,
  WAVE_CHANCE,
  WAVE_ZONE_FRACTION,
  WAVE_PUSHBACK,
  WAVE_AFTERMATH_ROUNDS,
  WAVE_AFTERMATH_OBSTACLES,
} from "./constants";

/** Top y of the wave-affected lower band (lower 40% => 0.6 * height). */
export const waveZoneTopY = (track: Track): number =>
  track.height * (1 - WAVE_ZONE_FRACTION);

/** Eligible from round 3, flat 20% chance. */
export function rollWave(round: number, rng: Rng): boolean {
  if (round < WAVE_START_ROUND) return false;
  return rng() < WAVE_CHANCE;
}

/**
 * Impact: every marble in the lower zone is shoved WAVE_PUSHBACK px *backward
 * along the loop* (against its forward tangent). Any marble forced over a berm
 * or off the board is tipped (misses its next turn). Returns a new racer array.
 */
export function applyWaveImpact(racers: Racer[], track: Track): Racer[] {
  const zoneTopY = waveZoneTopY(track);
  return racers.map((r) => {
    if (r.state === "finished") return r;
    if (r.pos.y < zoneTopY) return r; // outside the wave zone
    const proj = nearestOnLoop(track, r.pos);
    const pushed: Vector2D = V.add(r.pos, V.scale(proj.tangent, -WAVE_PUSHBACK));
    const next: Racer = {
      ...r,
      pos: pushed,
      vel: { x: 0, y: 0 },
      loopT: nearestOnLoop(track, pushed).t,
    };
    next.progress = next.lap + next.loopT;
    if (isPastBerm(track, pushed) || isOffBoard(track, pushed)) {
      next.state = "tipped";
      next.skipNextTurn = true;
    }
    return next;
  });
}

/** Spawn temporary kelp / clam-shell obstacles inside the lower wave zone. */
export function makeAftermathObstacles(
  track: Track,
  rng: Rng,
  count = WAVE_AFTERMATH_OBSTACLES,
): CircleObstacle[] {
  const zoneTopY = waveZoneTopY(track);
  const out: CircleObstacle[] = [];
  for (let i = 0; i < count; i++) {
    // Sample loop positions until one lands in the lower (waterlogged) zone.
    let pos: Vector2D | null = null;
    for (let tries = 0; tries < 8 && !pos; tries++) {
      const t = rng();
      const center = loopPointAt(track, t);
      const leftN = V.perp(tangentAt(track, t));
      const lateral = randRange(rng, -track.laneHalfWidth, track.laneHalfWidth);
      const cand = V.add(center, V.scale(leftN, lateral));
      if (cand.y >= zoneTopY) pos = cand;
    }
    if (!pos) continue;
    out.push({
      kind: pick(rng, ["kelp", "clamshell"] as const),
      pos,
      radius: randRange(rng, 18, 30),
      temporary: true,
    });
  }
  return out;
}

/** Begin the aftermath: waterlogged lower zone for WAVE_AFTERMATH_ROUNDS rounds. */
export function beginAftermath(track: Track): WaveState {
  return {
    phase: "aftermath",
    aftermathRoundsLeft: WAVE_AFTERMATH_ROUNDS,
    zoneTopY: waveZoneTopY(track),
  };
}

/**
 * Tick the aftermath at a round boundary. When it expires, the zone returns to
 * normal (caller should also strip temporary obstacles).
 */
export function advanceAftermath(wave: WaveState): {
  wave: WaveState;
  ended: boolean;
} {
  if (wave.phase !== "aftermath") return { wave, ended: false };
  const left = wave.aftermathRoundsLeft - 1;
  if (left <= 0) {
    return {
      wave: { phase: "none", aftermathRoundsLeft: 0, zoneTopY: wave.zoneTopY },
      ended: true,
    };
  }
  return { wave: { ...wave, aftermathRoundsLeft: left }, ended: false };
}
