// ============================================================================
// tour-de-sable — dug-circuit track generation + loop geometry helpers
// The track is a closed loop (ring) carved into the sand. Racers flick their
// marbles around the channel between two LOW berm banks. Every seed yields a
// distinct but always-playable circuit that fits inside the board.
// ============================================================================

import type { Track, Obstacle, Vector2D } from "./types";
import { mulberry32, randRange, randInt, type Rng } from "./rng";
import * as V from "./vector";
import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  TRACK_HALF_WIDTH,
  RACER_COUNT,
} from "./constants";

const TAU = Math.PI * 2;
const LOOP_POINTS = 56;
const BOARD_MARGIN = 64;

/**
 * Deterministically generate a circuit from a seed. Same seed => identical track.
 */
export function generateTrack(seed: number): Track {
  const rng = mulberry32(seed);
  const width = BOARD_WIDTH;
  const height = BOARD_HEIGHT;
  const cx = width / 2;
  const cy = height / 2;

  const laneHalfWidth = randRange(rng, 56, 70);
  const trackHalfWidth = TRACK_HALF_WIDTH;

  // Base ring radii (kept conservative so channel + berm stay inside the board).
  const maxR = Math.min(width, height) / 2 - BOARD_MARGIN - trackHalfWidth;
  const baseRx = maxR * randRange(rng, 0.72, 0.84);
  const baseRy = maxR * randRange(rng, 0.72, 0.84);

  // A few radial harmonics make the ring wander without self-intersecting.
  const harmonics = [
    { k: 2, amp: randRange(rng, 0.04, 0.1), phase: rng() * TAU },
    { k: 3, amp: randRange(rng, 0.03, 0.08), phase: rng() * TAU },
    { k: 5, amp: randRange(rng, 0.0, 0.05), phase: rng() * TAU },
  ];

  const loop: Vector2D[] = [];
  for (let i = 0; i < LOOP_POINTS; i++) {
    const theta = (TAU * i) / LOOP_POINTS;
    let rfac = 1;
    for (const h of harmonics) rfac += h.amp * Math.sin(h.k * theta + h.phase);
    loop.push({
      x: cx + baseRx * rfac * Math.cos(theta),
      y: cy + baseRy * rfac * Math.sin(theta),
    });
  }

  const { cumLen, loopLength } = buildArcLengths(loop);

  const partial: Pick<Track, "loop" | "cumLen" | "loopLength"> = {
    loop,
    cumLen,
    loopLength,
  };

  const startGrid = buildStartGrid(partial, laneHalfWidth);
  const obstacles = scatterObstacles(rng, partial, laneHalfWidth, trackHalfWidth);

  return {
    seed,
    width,
    height,
    loop,
    cumLen,
    loopLength,
    laneHalfWidth,
    trackHalfWidth,
    startGrid,
    obstacles,
    ripple: {
      angle: randRange(rng, 0, Math.PI),
      spacing: randRange(rng, 26, 40),
    },
  };
}

// ---------------------------------------------------------------------------
// Arc-length tables
// ---------------------------------------------------------------------------

/** cumLen has LOOP_POINTS + 1 entries; cumLen[n] = loopLength (closing seg). */
function buildArcLengths(loop: Vector2D[]): {
  cumLen: number[];
  loopLength: number;
} {
  const n = loop.length;
  const cumLen = new Array<number>(n + 1);
  cumLen[0] = 0;
  for (let i = 0; i < n; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % n];
    cumLen[i + 1] = cumLen[i] + V.dist(a, b);
  }
  return { cumLen, loopLength: cumLen[n] };
}

// ---------------------------------------------------------------------------
// Loop geometry (reused by friction, AI, collision, engine, rendering)
// ---------------------------------------------------------------------------

export interface LoopProjection {
  /** Parameter along the loop, t in [0,1). */
  t: number;
  /** Signed lateral offset from the centerline (left of travel = positive). */
  lateral: number;
  /** Forward unit tangent at the nearest point. */
  tangent: Vector2D;
  /** Nearest point on the centerline. */
  point: Vector2D;
}

type LoopLike = Pick<Track, "loop" | "cumLen" | "loopLength">;

/** Project a point onto the loop: nearest centerline point + param + offset. */
export function nearestOnLoop(track: LoopLike, p: Vector2D): LoopProjection {
  const { loop, cumLen, loopLength } = track;
  const n = loop.length;
  let best = { d2: Infinity, i: 0, s: 0, pt: loop[0] };

  for (let i = 0; i < n; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % n];
    const ab = V.sub(b, a);
    const len2 = V.lenSq(ab);
    const s = len2 > 0 ? clamp(V.dot(V.sub(p, a), ab) / len2, 0, 1) : 0;
    const pt = V.add(a, V.scale(ab, s));
    const d2 = V.distSq(p, pt);
    if (d2 < best.d2) best = { d2, i, s, pt };
  }

  const a = loop[best.i];
  const b = loop[(best.i + 1) % n];
  const tangent = V.normalize(V.sub(b, a));
  const arc = cumLen[best.i] + best.s * (cumLen[best.i + 1] - cumLen[best.i]);
  const leftNormal = V.perp(tangent); // (-ty, tx)
  const lateral = V.dot(V.sub(p, best.pt), leftNormal);

  return { t: loopLength > 0 ? arc / loopLength : 0, lateral, tangent, point: best.pt };
}

/** Centerline position at parameter t (wraps). */
export function loopPointAt(track: LoopLike, t: number): Vector2D {
  const { loop, cumLen, loopLength } = track;
  const n = loop.length;
  const arc = (((t % 1) + 1) % 1) * loopLength;
  for (let i = 0; i < n; i++) {
    if (arc >= cumLen[i] && arc < cumLen[i + 1]) {
      const seg = cumLen[i + 1] - cumLen[i];
      const s = seg > 0 ? (arc - cumLen[i]) / seg : 0;
      return V.lerp(loop[i], loop[(i + 1) % n], s);
    }
  }
  return { ...loop[0] };
}

/** Forward unit tangent at parameter t (wraps). */
export function tangentAt(track: LoopLike, t: number): Vector2D {
  const { loop, cumLen, loopLength } = track;
  const n = loop.length;
  const arc = (((t % 1) + 1) % 1) * loopLength;
  for (let i = 0; i < n; i++) {
    if (arc >= cumLen[i] && arc < cumLen[i + 1]) {
      return V.normalize(V.sub(loop[(i + 1) % n], loop[i]));
    }
  }
  return V.normalize(V.sub(loop[1], loop[0]));
}

/** Absolute lateral distance from the centerline. */
export const offsetFromCenter = (track: Track, pos: Vector2D): number =>
  Math.abs(nearestOnLoop(track, pos).lateral);

/** Progress for standings (loop parameter; lap tracked separately). */
export const progressFor = (track: Track, pos: Vector2D): number =>
  nearestOnLoop(track, pos).t;

/** True if the marble has gone beyond a berm bank (channel edge). */
export const isPastBerm = (track: Track, pos: Vector2D): boolean =>
  offsetFromCenter(track, pos) > track.trackHalfWidth;

/** Safety bound: marble has left the board entirely. */
export const isOffBoard = (track: Track, pos: Vector2D): boolean =>
  pos.x < 0 || pos.y < 0 || pos.x > track.width || pos.y > track.height;

// ---------------------------------------------------------------------------
// Start grid + obstacles
// ---------------------------------------------------------------------------

function buildStartGrid(track: LoopLike, laneHalfWidth: number): Vector2D[] {
  const baseT = 0.02; // just past the finish line (t = 0)
  const center = loopPointAt(track, baseT);
  const tangent = tangentAt(track, baseT);
  const leftNormal = V.perp(tangent);
  const spread = laneHalfWidth * 0.7;
  const grid: Vector2D[] = [];
  for (let i = 0; i < RACER_COUNT; i++) {
    const frac = RACER_COUNT === 1 ? 0 : i / (RACER_COUNT - 1) - 0.5;
    grid.push(V.add(center, V.scale(leftNormal, frac * 2 * spread)));
  }
  return grid;
}

function scatterObstacles(
  rng: Rng,
  track: LoopLike,
  laneHalfWidth: number,
  trackHalfWidth: number,
): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const count = randInt(rng, 5, 8);
  for (let i = 0; i < count; i++) {
    // Avoid the start/finish stretch (t near 0 / 1).
    const t = randRange(rng, 0.1, 0.9);
    const center = loopPointAt(track, t);
    const leftNormal = V.perp(tangentAt(track, t));
    const lateral = randRange(rng, -trackHalfWidth * 0.9, trackHalfWidth * 0.9);
    const pos = V.add(center, V.scale(leftNormal, lateral));

    if (rng() < 0.5) {
      obstacles.push({
        kind: "driftwood",
        pos,
        halfW: randRange(rng, 22, 38),
        halfH: randRange(rng, 9, 15),
        angle: randRange(rng, -Math.PI / 2, Math.PI / 2),
      });
    } else {
      obstacles.push({
        kind: "kelp",
        pos,
        radius: randRange(rng, 16, 26),
      });
    }
  }
  // keep laneHalfWidth referenced for future tuning of obstacle bias
  void laneHalfWidth;
  return obstacles;
}

// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
