// ============================================================================
// tour-de-sable — engine v3 (Rapier-backed, event-driven)
// In v3 Rapier drives all marble physics.  engine.ts provides:
//   • applyLaunch / takeBotTurn  — compute the 3D impulse for Rapier
//   • updateRacerPos             — sync racer state from Rapier each frame
//   • onSettled                  — resolve the turn once marbles rest
// The per-frame stepRacer / update loop is gone (Rapier owns it).
// ============================================================================

import type { GameState, Launch, Vector2D } from "./types";
import * as V from "./vector";
import { activeRacer, startNextTurn } from "./stateMachine";
import { computeLaunch } from "./ai";
import { mulberry32 } from "./rng";
import { progressAlongPath, pathPointAt, atFinish, isOffCourse } from "./track";
import { MAX_IMPULSE, TRAIL_LIFETIME } from "./constants";

/** 3D impulse vector passed to Rapier's applyImpulse. */
export interface Impulse3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Apply a human launch to the active racer.
 * Mutates state (PHYSICS phase, racer "moving").
 * Returns the 3D world-space impulse to feed to the Rapier body.
 * dir.x = world X, dir.y = world Z (ground plane).
 */
export function applyLaunch(state: GameState, launch: Launch): Impulse3D {
  const r = activeRacer(state);
  const power = Math.max(0.05, Math.min(1, launch.power));
  const mag = power * MAX_IMPULSE;
  const d = V.len(launch.dir) > 0 ? V.normalize(launch.dir) : { x: 0, y: 1 };
  r.state = "moving";
  state.turnSubPhase = "PHYSICS";
  return { x: d.x * mag, y: 0, z: d.y * mag };
}

/** Compute + apply the active bot's turn. */
export function takeBotTurn(state: GameState): Impulse3D {
  const r = activeRacer(state);
  const rng = mulberry32((state.seed + state.round * 131 + state.activeTurn) >>> 0);
  const launch = computeLaunch(r, state, rng);
  return applyLaunch(state, launch);
}

/**
 * Called from the R3F marble's useFrame every tick during PHYSICS.
 * Syncs racer position from the Rapier body and checks finish / offcourse.
 * Returns 'finish' | 'offcourse' | 'ok'.
 */
export function updateRacerPos(
  state: GameState,
  racerId: string,
  worldX: number,
  worldY: number,
  worldZ: number,
): "finish" | "offcourse" | "ok" {
  const r = state.racers.find((x) => x.id === racerId);
  if (!r || r.state === "finished") return "ok";

  const pos: Vector2D = { x: worldX, y: worldZ };
  r.pos = pos;
  r.progress = progressAlongPath(state.track!, pos);

  if (worldY < state.track!.seaLevelY || isOffCourse(state.track!, pos)) {
    r.state = "tipped";
    r.skipNextTurn = true;
    // Snap to the path centerline at the last safe progress so they respawn
    // in the middle of the course rather than at the edge they fell off.
    const safeProgress = progressAlongPath(state.track!, r.lastInBoundsPos);
    const centerPos = pathPointAt(state.track!, safeProgress);
    r.pos = centerPos;
    r.lastInBoundsPos = { ...centerPos };
    r.progress = safeProgress;
    return "offcourse";
  }

  if (atFinish(state.track!, pos)) {
    r.state = "finished";
    r.finishedRank = state.finishedCount++;
    if (!state.winnerId) state.winnerId = r.id;
    return "finish";
  }

  r.lastInBoundsPos = { ...pos };
  return "ok";
}

/**
 * Carve the just-finished shot's path into the persistent trail layer.
 * Down-samples the per-frame path into a handful of segments so a later
 * marble crossing the channel gets a temporary fast lane.
 */
export function recordTrail(state: GameState, path: Vector2D[]): void {
  if (path.length < 2) return;
  const step = Math.max(1, Math.floor(path.length / 24));
  let prev = path[0];
  for (let i = step; i < path.length; i += step) {
    const cur = path[i];
    if (V.dist(prev, cur) > 0.6) {
      state.trails.push({ a: { ...prev }, b: { ...cur }, turnsLeft: TRAIL_LIFETIME });
    }
    prev = cur;
  }
}

/** Called by the R3F marble component when all marbles have settled. */
export function onSettled(state: GameState): void {
  state.turnSubPhase = "RESOLUTION";
  startNextTurn(state);
}
