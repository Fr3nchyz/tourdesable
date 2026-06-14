// ============================================================================
// tour-de-sable — simulation engine
// Owns per-frame physics for all moving marbles, collisions, tipping, finish
// detection, and turn resolution. Mutates the GameState in place (single game
// loop). The render/audio layers consume the FrameEvents it returns.
// ============================================================================

import type { GameState, Racer, Launch, Vector2D, Track } from "./types";
import * as V from "./vector";
import { advanceVelocity, integrate, isStopped } from "./physics";
import {
  resolveDriftwood,
  resolveShunt,
  circlesOverlap,
} from "./collision";
import { nearestOnLoop, isOffBoard } from "./track";
import { computeLaunch } from "./ai";
import { mulberry32 } from "./rng";
import { activeRacer, startNextTurn } from "./stateMachine";
import {
  MAX_LAUNCH_SPEED,
  STOP_THRESHOLD,
  BERM_CLEAR_SPEED,
  BERM_DAMPING,
  LAPS_TO_WIN,
} from "./constants";

export interface FrameEvents {
  /** Marble-vs-marble shunts: contact point + whether it was high-powered. */
  collisions: { point: Vector2D; hard: boolean }[];
  /** Driftwood bounces: contact point. */
  bounces: { point: Vector2D }[];
  /** Racer ids that tipped out this frame. */
  tipped: string[];
  /** Racer ids that crossed the finish this frame. */
  finished: string[];
  /** True once every marble has come to rest (turn may resolve). */
  settled: boolean;
  /** Wave triggered during this turn's resolution. */
  waveTriggered: boolean;
}

function emptyEvents(): FrameEvents {
  return {
    collisions: [],
    bounces: [],
    tipped: [],
    finished: [],
    settled: false,
    waveTriggered: false,
  };
}

const HARD_HIT_SPEED = MAX_LAUNCH_SPEED * 0.6;

// ---------------------------------------------------------------------------
// Input -> impulse
// ---------------------------------------------------------------------------

/** Apply a launch (dir * power) to the active racer and enter the physics phase. */
export function applyLaunch(state: GameState, launch: Launch): void {
  const r = activeRacer(state);
  const speed = launch.power * MAX_LAUNCH_SPEED;
  r.vel = V.scale(V.normalize(launch.dir), speed);
  r.state = "moving";
  state.turnSubPhase = "PHYSICS";
}

/** Compute + apply the active bot's launch. */
export function takeBotTurn(state: GameState): Launch {
  const r = activeRacer(state);
  const rng = mulberry32((state.seed + state.round * 131 + state.activeTurn) >>> 0);
  const launch = computeLaunch(r, state, rng);
  applyLaunch(state, launch);
  return launch;
}

// ---------------------------------------------------------------------------
// Per-frame simulation
// ---------------------------------------------------------------------------

/** Step one moving marble by a single frame, recording events. */
function stepRacer(state: GameState, r: Racer, ev: FrameEvents): void {
  const track = state.track!;
  let pos = integrate(r.pos, r.vel);

  // --- Driftwood bounces (iterate a few times for corners) ---
  for (const o of track.obstacles) {
    if (o.kind !== "driftwood") continue;
    const res = resolveDriftwood(pos, r.vel, r.radius, o);
    if (res.hit) {
      pos = res.pos;
      r.vel = res.vel;
      if (res.contact) ev.bounces.push({ point: res.contact });
    }
  }

  // --- Marble collisions ---
  for (const other of state.racers) {
    if (other.id === r.id || other.state === "finished") continue;
    if (!circlesOverlap(pos, r.radius, other.pos, other.radius)) continue;

    const otherSpeed = V.len(other.vel);
    if (otherSpeed < STOP_THRESHOLD) {
      // Pocket-Stealer Shunt against a stationary target.
      const incoming = V.len(r.vel);
      const normal = V.normalize(V.sub(other.pos, pos)); // attacker -> target
      const shunt = resolveShunt(pos, r.vel, r.radius, other.pos);
      // Attacker parks in the vacated pocket and stops dead.
      r.pos = shunt.attacker.pos;
      r.vel = shunt.attacker.vel;
      r.state = "stopped";
      // Target is launched and nudged exactly clear so the pair don't re-collide.
      other.vel = shunt.target.vel;
      other.pos = V.add(shunt.attacker.pos, V.scale(normal, r.radius + other.radius));
      other.state = "moving";
      ev.collisions.push({ point: shunt.contact, hard: incoming >= HARD_HIT_SPEED });
      const ap = nearestOnLoop(track, r.pos);
      r.loopT = ap.t;
      r.progress = r.lap + ap.t;
      return; // attacker is done this frame
    } else {
      // Two movers: exchange velocity components along the contact normal.
      const normal = V.normalize(V.sub(other.pos, pos));
      const vr = V.dot(r.vel, normal);
      const vo = V.dot(other.vel, normal);
      r.vel = V.add(r.vel, V.scale(normal, vo - vr));
      other.vel = V.add(other.vel, V.scale(normal, vr - vo));
      // Nudge apart to avoid sticking.
      pos = V.add(pos, V.scale(normal, -1));
      ev.collisions.push({ point: V.lerp(pos, other.pos, 0.5), hard: false });
    }
  }

  // --- Friction / ripple / kelp ---
  const adv = advanceVelocity(track, pos, r.vel, state.wave);
  r.vel = adv.vel;
  r.pos = pos;

  // --- Low banked berm (speed-gated) ---
  const proj = nearestOnLoop(track, r.pos);
  if (Math.abs(proj.lateral) > track.trackHalfWidth) {
    if (V.len(r.vel) >= BERM_CLEAR_SPEED) {
      tipRacer(r, ev); // a hard flick clears the low berm -> out of bounds
      return;
    }
    // Gentle: the bank deflects the marble back into the channel.
    const leftNormal = V.perp(proj.tangent);
    const side = proj.lateral > 0 ? 1 : -1;
    const inwardNormal = V.scale(leftNormal, -side); // toward the centerline
    r.vel = V.scale(V.reflect(r.vel, inwardNormal), BERM_DAMPING);
    r.pos = V.add(
      proj.point,
      V.scale(leftNormal, side * (track.trackHalfWidth - r.radius)),
    );
    ev.bounces.push({ point: r.pos });
  }

  // --- Off-board safety (rare) ---
  if (isOffBoard(track, r.pos)) {
    tipRacer(r, ev);
    return;
  }

  // --- Lap counting + finish ---
  if (updateLapAndFinish(state, r, ev, track)) return;

  // In-bounds bookkeeping.
  r.lastInBoundsPos = { ...r.pos };
  if (isStopped(r.vel) && r.state === "moving") r.state = "stopped";
}

/** Tip a marble out: park it at its respawn anchor, miss the next turn. */
function tipRacer(r: Racer, ev: FrameEvents): void {
  r.state = "tipped";
  r.skipNextTurn = true;
  r.vel = { x: 0, y: 0 };
  r.pos = { ...r.lastInBoundsPos };
  ev.tipped.push(r.id);
}

/**
 * Update lap parameter, detect forward/backward finish crossings, and finish the
 * race on the winning lap. Returns true if the racer finished this frame.
 */
function updateLapAndFinish(
  state: GameState,
  r: Racer,
  ev: FrameEvents,
  track: Track,
): boolean {
  const t = nearestOnLoop(track, r.pos).t;
  const prev = r.loopT;

  if (t > 0.4 && t < 0.6) r.passedHalf = true;

  // Forward wrap (high -> low) after passing halfway = completed a lap.
  if (prev > 0.7 && t < 0.3 && r.passedHalf) {
    r.lap += 1;
    r.passedHalf = false;
    if (r.lap >= LAPS_TO_WIN) {
      r.state = "finished";
      r.vel = { x: 0, y: 0 };
      r.finishedRank = state.finishedCount++;
      if (!state.winnerId) state.winnerId = r.id;
      ev.finished.push(r.id);
      r.loopT = t;
      r.progress = r.lap + t;
      return true;
    }
  } else if (prev < 0.3 && t > 0.7) {
    // Backward wrap — undo a lap (never below zero).
    r.lap = Math.max(0, r.lap - 1);
  }

  r.loopT = t;
  r.progress = r.lap + t;
  return false;
}

/**
 * Advance the whole simulation by one frame. When every marble has settled,
 * resolves the turn and hands off to the next racer. Returns frame events.
 */
export function update(state: GameState): FrameEvents {
  const ev = emptyEvents();
  if (state.phase !== "TURN_CYCLE" || state.turnSubPhase !== "PHYSICS") return ev;

  for (const r of state.racers) {
    if (r.state === "moving") stepRacer(state, r, ev);
  }

  const anyMoving = state.racers.some((r) => r.state === "moving");
  if (!anyMoving) {
    ev.settled = true;
    state.turnSubPhase = "RESOLUTION";
    const info = startNextTurn(state);
    ev.waveTriggered = info.waveTriggered;
  }
  return ev;
}
