// ============================================================================
// tour-de-sable — A→B coastal course generation + geometry/terrain helpers
// World units (metres). Course runs along +Z; X is across the beach; +Y up.
// ============================================================================

import type { Track, Rock, Vector2D, ElevationField } from "./types";
import { mulberry32, randRange, randInt, type Rng } from "./rng";
import * as V from "./vector";
import {
  COURSE_WIDTH,
  COURSE_LENGTH,
  FINISH_RADIUS,
  SEA_LEVEL_Y,
  RACER_COUNT,
  THEME_NAMES,
  type Theme,
} from "./constants";

const PATH_POINTS = 20;

/** Gaussian hill/valley placed along the course Z axis. */
interface MacroPeak {
  /** Fractional position along course (0 = start, 1 = finish). */
  t: number;
  /** Height contribution in metres. Positive = hill, negative = valley. */
  h: number;
  /** Gaussian spread (0.12 = tight peak, 0.30 = broad rolling hill). */
  sigma: number;
}

interface ThemeParams {
  elevation: Omit<ElevationField, "theme" | "seed">;
  /**
   * Macro elevation profile: Gaussian peaks/valleys layered on top of dunes.
   * Replaces the old linear slope — creates Tour-de-France-style mountain stages.
   */
  macroProfile: MacroPeak[];
  /** Sin frequency (radians) for the macro S/C path curve. π = one arch (C), 2π = S, 4π = double-S. */
  curveFreq: number;
  /** Amplitude of the macro curve as a fraction of (width/2 − 3). */
  curveAmp: number;
  rockCount: [number, number];
  rockRadius: [number, number];
  rockHeight: [number, number];
}

const THEME_PARAMS: Record<Theme, ThemeParams> = {
  // "Flat stage with a col" — rolling plains rising to a broad sandy crest, then descent.
  "trez-hir": {
    elevation: { amp: 0.35, freq: 0.14, cliffAmp: 0, slope: 0 },
    macroProfile: [
      { t: 0.45, h: 3.5, sigma: 0.28 }, // one broad crest mid-course
    ],
    curveFreq: Math.PI * 1,   // gentle C
    curveAmp: 0.55,
    rockCount: [4, 7],
    rockRadius: [0.8, 1.6],
    rockHeight: [0.6, 1.2],
  },
  // "Coastal summit finish" — gradual climb to a headland peak, technical sea-cliff descent.
  "le-minou": {
    elevation: { amp: 0.9, freq: 0.17, cliffAmp: 1.6, slope: 0 },
    macroProfile: [
      { t: 0.38, h: 6.0, sigma: 0.22 }, // main headland summit
      { t: 0.72, h: 2.5, sigma: 0.14 }, // secondary bump before the cliff descent
    ],
    curveFreq: Math.PI * 2,   // one full S
    curveAmp: 0.75,
    rockCount: [6, 10],
    rockRadius: [1.0, 2.2],
    rockHeight: [1.0, 2.4],
  },
  // "Alpine queen stage" — two distinct cols, saddle between them, sprint descent to finish.
  bertheaume: {
    elevation: { amp: 2.6, freq: 0.2, cliffAmp: 9, slope: 0 },
    macroProfile: [
      { t: 0.28, h: 8.0, sigma: 0.16 }, // first col (sharp peak)
      { t: 0.62, h: 5.5, sigma: 0.18 }, // second col (slightly lower)
    ],
    curveFreq: Math.PI * 4,   // double S
    curveAmp: 0.80,
    rockCount: [10, 15],
    rockRadius: [1.4, 3.2],
    rockHeight: [2.0, 5.0],
  },
};

/** Deterministically generate a themed A→B course from a seed. */
export function generateTrack(seed: number, theme: Theme): Track {
  const rng = mulberry32(seed);
  const width = COURSE_WIDTH;
  const length = COURSE_LENGTH;
  const tp = THEME_PARAMS[theme];

  const start: Vector2D = { x: randRange(rng, -4, 4), y: 6 };
  const finish: Vector2D = { x: randRange(rng, -6, 6), y: length - 6 };

  // Wandering centerline start → finish.
  // Macro curve (sin with theme-specific freq/amp) gives the course its recognisable
  // C / S / double-S shape; a small random nudge keeps each seed unique.
  const path: Vector2D[] = [];
  const maxSwing = (width / 2 - 3) * tp.curveAmp;
  for (let i = 0; i < PATH_POINTS; i++) {
    const t = i / (PATH_POINTS - 1);
    const z = start.y + (finish.y - start.y) * t;
    const baseX = start.x + (finish.x - start.x) * t;
    const macro = Math.sin(t * tp.curveFreq) * maxSwing;
    const noise = randRange(rng, -maxSwing * 0.15, maxSwing * 0.15); // 15% micro-variation
    const offset = i === 0 || i === PATH_POINTS - 1 ? 0 : macro + noise;
    path.push({ x: clamp(baseX + offset, -width / 2 + 2, width / 2 - 2), y: z });
  }

  // Start grid across X at the start line.
  const startGrid: Vector2D[] = [];
  const spread = 3;
  for (let i = 0; i < RACER_COUNT; i++) {
    const frac = (RACER_COUNT as number) === 1 ? 0 : i / (RACER_COUNT - 1) - 0.5;
    startGrid.push({ x: start.x + frac * 2 * spread, y: start.y });
  }

  const elevation: ElevationField = { theme, seed, ...tp.elevation };

  const rocks = scatterRocks(rng, tp, { path, start, finish, width, length });

  return {
    seed,
    theme,
    name: THEME_NAMES[theme],
    width,
    length,
    start,
    finish,
    finishRadius: FINISH_RADIUS,
    path,
    startGrid,
    rocks,
    seaLevelY: SEA_LEVEL_Y,
    elevation,
  };
}

function scatterRocks(
  rng: Rng,
  tp: ThemeParams,
  ctx: { path: Vector2D[]; start: Vector2D; finish: Vector2D; width: number; length: number },
): Rock[] {
  const rocks: Rock[] = [];
  const count = randInt(rng, tp.rockCount[0], tp.rockCount[1]);
  for (let i = 0; i < count; i++) {
    const z = randRange(rng, 14, ctx.length - 14);
    const x = randRange(rng, -ctx.width / 2 + 2, ctx.width / 2 - 2);
    const pos = { x, y: z };
    // Keep the immediate start/finish clear.
    if (V.dist(pos, ctx.start) < 8 || V.dist(pos, ctx.finish) < 8) continue;
    rocks.push({
      pos,
      radius: randRange(rng, tp.rockRadius[0], tp.rockRadius[1]),
      height: randRange(rng, tp.rockHeight[0], tp.rockHeight[1]),
    });
  }
  return rocks;
}

// ---------------------------------------------------------------------------
// Terrain height
// ---------------------------------------------------------------------------

/** Deterministic terrain height (world Y) at a ground point. */
export function heightAt(track: Track, x: number, z: number): number {
  const e = track.elevation;
  // Macro profile: Gaussian peaks/valleys give each theme a distinct elevation shape
  // (Tour de France stage inspiration — flat stage / summit finish / alpine queen).
  // These replace the old linear slope and are defined per theme in THEME_PARAMS.
  const tp = THEME_PARAMS[track.theme];
  let h = 0;
  for (const peak of tp.macroProfile) {
    const dt = z / track.length - peak.t;
    h += peak.h * Math.exp(-(dt * dt) / (2 * peak.sigma * peak.sigma));
  }
  // Rolling dunes (texture riding on top of the macro profile).
  h +=
    e.amp *
    (Math.sin(x * e.freq + e.seed * 0.013) * 0.5 +
      Math.sin(z * e.freq * 0.8 + e.seed * 0.021) * 0.5);
  // Seaward cliff rising toward the +X edge.
  if (e.cliffAmp > 0) {
    const edge = x / (track.width / 2); // -1..1
    const t = Math.max(0, (edge - 0.35) / 0.65);
    h += e.cliffAmp * t * t;
  }
  // Carved beach path: channel depression along the centerline, pushed-up berms
  // just outside it, and high-frequency micro-bumps for a hand-crafted sand feel.
  const pathPt = pathPointAt(track, z / track.length);
  const dx = x - pathPt.x;
  const absDx = Math.abs(dx);
  const channelHW = 5;
  if (absDx < channelHW) {
    const t = dx / channelHW;
    h -= 0.4 * (1 - t * t); // parabolic channel scoop
  }
  const bermEnd = channelHW + 4;
  if (absDx >= channelHW && absDx < bermEnd) {
    const bt = (absDx - channelHW) / 4;
    h += 0.5 * bt * (1 - bt) * 4; // smooth berm shoulder
  }
  h += 0.12 * Math.sin(x * 3.1 + z * 2.3 + e.seed * 0.07); // micro-bumps
  return h;
}

// ---------------------------------------------------------------------------
// Path geometry (open polyline start→finish)
// ---------------------------------------------------------------------------

function pathLengths(path: Vector2D[]): { cum: number[]; total: number } {
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + V.dist(path[i - 1], path[i]));
  return { cum, total: cum[cum.length - 1] };
}

/** Project a point onto the course path → progress fraction 0..1 toward finish. */
export function progressAlongPath(track: Track, pos: Vector2D): number {
  const { path } = track;
  const { cum, total } = pathLengths(path);
  let best = { d2: Infinity, arc: 0 };
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const ab = V.sub(b, a);
    const len2 = V.lenSq(ab);
    const s = len2 > 0 ? clamp(V.dot(V.sub(pos, a), ab) / len2, 0, 1) : 0;
    const pt = V.add(a, V.scale(ab, s));
    const d2 = V.distSq(pos, pt);
    if (d2 < best.d2) best = { d2, arc: cum[i] + s * (cum[i + 1] - cum[i]) };
  }
  return total > 0 ? best.arc / total : 0;
}

/** A point on the path at progress fraction t (0..1). */
export function pathPointAt(track: Track, t: number): Vector2D {
  const { path } = track;
  const { cum, total } = pathLengths(path);
  const arc = clamp(t, 0, 1) * total;
  for (let i = 0; i < path.length - 1; i++) {
    if (arc <= cum[i + 1]) {
      const seg = cum[i + 1] - cum[i];
      const s = seg > 0 ? (arc - cum[i]) / seg : 0;
      return V.lerp(path[i], path[i + 1], s);
    }
  }
  return { ...path[path.length - 1] };
}

/** True if the marble has crossed into the finish zone. */
export const atFinish = (track: Track, pos: Vector2D): boolean =>
  V.dist(pos, track.finish) <= track.finishRadius;

/** True if the marble has left the playable beach (sides / ends). */
export function isOffCourse(track: Track, pos: Vector2D): boolean {
  const m = 1;
  return (
    Math.abs(pos.x) > track.width / 2 + m ||
    pos.y < -m ||
    pos.y > track.length + m
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
