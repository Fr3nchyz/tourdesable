// ============================================================================
// tour-de-sable — track generation + geometry helpers
// Linear A->B corridor. Start grid at the bottom (high y), finish at the top
// (low y). The centerline is a gently wandering polyline (vector path) so each
// seed produces a distinct but always-playable corridor.
// ============================================================================

import type { Track, Obstacle, Vector2D } from "./types";
import { mulberry32, randRange, randInt, type Rng } from "./rng";
import { BOARD_WIDTH, BOARD_HEIGHT, RACER_COUNT } from "./constants";

const FINISH_MARGIN = 90; // distance of finish line from top
const START_MARGIN = 110; // distance of start grid from bottom
const WAYPOINTS = 7; // centerline resolution

/**
 * Deterministically generate a track from a seed. Same seed => identical track.
 */
export function generateTrack(seed: number): Track {
  const rng = mulberry32(seed);
  const width = BOARD_WIDTH;
  const height = BOARD_HEIGHT;

  const laneHalfWidth = randRange(rng, 95, 130);
  const corridorHalfWidth = laneHalfWidth + randRange(rng, 70, 110);

  const finishY = FINISH_MARGIN;
  const startY = height - START_MARGIN;

  // The centerX must stay far enough from the walls that the full corridor fits.
  const minX = corridorHalfWidth + 20;
  const maxX = width - corridorHalfWidth - 20;

  // Build a wandering centerline from start (bottom) to finish (top).
  const centerline: Vector2D[] = [];
  let cx = randRange(rng, minX, maxX);
  for (let i = 0; i < WAYPOINTS; i++) {
    const t = i / (WAYPOINTS - 1);
    const y = startY + (finishY - startY) * t; // start -> finish
    // Wander horizontally but clamp inside walls.
    cx += randRange(rng, -90, 90);
    cx = Math.max(minX, Math.min(maxX, cx));
    centerline.push({ x: cx, y });
  }

  // Start grid: spread racers across the lane at the bottom.
  const startCx = centerline[0].x;
  const startGrid: Vector2D[] = [];
  const spread = laneHalfWidth * 0.7;
  for (let i = 0; i < RACER_COUNT; i++) {
    const frac = (RACER_COUNT as number) === 1 ? 0 : i / (RACER_COUNT - 1) - 0.5;
    startGrid.push({ x: startCx + frac * 2 * spread, y: startY });
  }

  const obstacles = scatterObstacles(rng, {
    centerline,
    finishY,
    startY,
    laneHalfWidth,
    corridorHalfWidth,
  });

  const ripple = {
    angle: randRange(rng, 0, Math.PI),
    spacing: randRange(rng, 26, 40),
  };

  return {
    seed,
    width,
    height,
    centerline,
    laneHalfWidth,
    corridorHalfWidth,
    finishY,
    startGrid,
    obstacles,
    ripple,
  };
}

interface ScatterCtx {
  centerline: Vector2D[];
  finishY: number;
  startY: number;
  laneHalfWidth: number;
  corridorHalfWidth: number;
}

/** Scatter driftwood + kelp through the mid-track (clear of start & finish). */
function scatterObstacles(rng: Rng, ctx: ScatterCtx): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const count = randInt(rng, 4, 7);
  const top = ctx.finishY + 160; // keep finish approach clear
  const bottom = ctx.startY - 200; // keep start grid clear

  for (let i = 0; i < count; i++) {
    const y = randRange(rng, top, bottom);
    const cx = centerlineXForList(ctx.centerline, y);
    // Place within the corridor, biased toward shoulders for tactical lines.
    const offset = randRange(rng, -ctx.corridorHalfWidth, ctx.corridorHalfWidth);
    const pos = { x: cx + offset, y };

    if (rng() < 0.5) {
      obstacles.push({
        kind: "driftwood",
        pos,
        halfW: randRange(rng, 26, 46),
        halfH: randRange(rng, 10, 18),
        angle: randRange(rng, -0.5, 0.5),
      });
    } else {
      obstacles.push({
        kind: "kelp",
        pos,
        radius: randRange(rng, 20, 34),
      });
    }
  }
  return obstacles;
}

// ---------------------------------------------------------------------------
// Geometry helpers (reused by friction, AI, collision, rendering)
// ---------------------------------------------------------------------------

/** Interpolate the centerline x at a given y (clamped to the corridor span). */
export function centerlineXForList(line: Vector2D[], y: number): number {
  const startY = line[0].y;
  const finishY = line[line.length - 1].y;
  if (y >= startY) return line[0].x;
  if (y <= finishY) return line[line.length - 1].x;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    // y decreases from a to b
    if (y <= a.y && y >= b.y) {
      const t = (y - a.y) / (b.y - a.y);
      return a.x + (b.x - a.x) * t;
    }
  }
  return line[line.length - 1].x;
}

/** Centerline x at a given y for a track. */
export const centerlineXAt = (track: Track, y: number): number =>
  centerlineXForList(track.centerline, y);

/** Horizontal distance from the corridor centerline at the point's y. */
export const offsetFromCenter = (track: Track, pos: Vector2D): number =>
  Math.abs(pos.x - centerlineXAt(track, pos.y));

/**
 * Progress toward the finish. Higher = closer. Measured as how far the marble
 * has advanced up the board from the start line.
 */
export const progressFor = (track: Track, pos: Vector2D): number =>
  track.centerline[0].y - pos.y;

/** True if the marble center has left the corridor (sides) or board (ends). */
export function isOutOfBounds(track: Track, pos: Vector2D): boolean {
  if (pos.y < 0 || pos.y > track.height) return true;
  return offsetFromCenter(track, pos) > track.corridorHalfWidth;
}

/** True if the marble center has crossed the finish line. */
export const hasCrossedFinish = (track: Track, pos: Vector2D): boolean =>
  pos.y <= track.finishY;
