// ============================================================================
// tour-de-sable — terrain classification + friction coefficients
// ============================================================================

import type { Track, Vector2D, WaveState, Zone } from "./types";
import { offsetFromCenter, isPastBerm } from "./track";
import {
  BASE_FRICTION,
  SHOULDER_FRICTION,
  KELP_FRICTION,
  WATERLOGGED_FRICTION,
} from "./constants";

/** True if the point lies inside a kelp / clam-shell drag circle. */
export function inKelp(track: Track, pos: Vector2D): boolean {
  for (const o of track.obstacles) {
    if (o.kind === "kelp" || o.kind === "clamshell") {
      const dx = pos.x - o.pos.x;
      const dy = pos.y - o.pos.y;
      if (dx * dx + dy * dy <= o.radius * o.radius) return true;
    }
  }
  return false;
}

/** True if the point is inside the active waterlogged (lower) wave zone. */
export function inWaterlogged(pos: Vector2D, wave: WaveState): boolean {
  if (wave.phase !== "impact" && wave.phase !== "aftermath") return false;
  return pos.y >= wave.zoneTopY;
}

/**
 * Classify the terrain at a point. Precedence:
 * out-of-bounds > kelp (drag obstacle) > waterlogged > lane/shoulder.
 */
export function zoneAt(track: Track, pos: Vector2D, wave: WaveState): Zone {
  if (isPastBerm(track, pos)) return "out"; // on/over a berm bank
  if (inKelp(track, pos)) return "kelp";
  if (inWaterlogged(pos, wave)) return "waterlogged";
  return offsetFromCenter(track, pos) <= track.laneHalfWidth
    ? "lane"
    : "shoulder";
}

/** Per-frame friction coefficient for a zone. */
export function frictionForZone(zone: Zone): number {
  switch (zone) {
    case "lane":
      return BASE_FRICTION;
    case "shoulder":
      return SHOULDER_FRICTION;
    case "kelp":
      return KELP_FRICTION;
    case "waterlogged":
      return WATERLOGGED_FRICTION;
    case "out":
      return BASE_FRICTION; // irrelevant: marble will be tipped
  }
}
