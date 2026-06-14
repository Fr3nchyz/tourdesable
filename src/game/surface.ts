// ============================================================================
// tour-de-sable — Surface Displacement engine (pure, framework-agnostic)
//
// Replaces "constant linear friction" with a material-driven model. Each
// physics frame the marble samples surfaceAt() at its ground position +
// velocity and pushes the result into the Rapier body:
//   • sample.damping → rb.setLinearDamping  (rolling resistance + sink-to-stop)
//   • sample.lateral → rb.applyImpulse      (camber + grain wobble, P2/P1)
//
// Imports only ./types, ./vector, ./constants — NO three / rapier. This keeps
// the math portable (e.g. droppable into a Godot GDScript / shader).
// ============================================================================

import type { SurfaceMaterial, Track, Vector2D } from "./types";
import * as V from "./vector";
import { SAND_MATERIAL, SINK_GAIN, SINK_SCALE } from "./constants";

/** What the marble pushes into Rapier this frame. */
export interface SurfaceSample {
  /** Effective Rapier linearDamping. */
  damping: number;
  /** Effective collider friction (grip). */
  friction: number;
  /** Lateral force (ground XZ) to apply as an impulse — 0 at rest. */
  lateral: Vector2D;
}

/**
 * Material at a ground position. For the Blancs-Sablons primary this is a
 * single sand material everywhere; the signature takes (track, pos) so future
 * themes / zones can vary it without touching call sites.
 */
export function materialFor(_track: Track, _pos: Vector2D): SurfaceMaterial {
  return SAND_MATERIAL;
}

/**
 * Non-linear "sink-to-stop" damping: ≈0 at launch speed, ramping up sharply as
 * the marble slows so it settles into the sand with a thud (and the turn
 * resolves crisply). Returns the EXTRA damping to add on top of baseFriction.
 */
export function sinkToStop(speed: number): number {
  return SINK_GAIN * Math.exp(-Math.max(0, speed) / SINK_SCALE);
}

/**
 * Sample the surface for the active marble.
 * @param pos ground position (x = world X, y = world Z)
 * @param vel ground velocity (x = world X/s, y = world Z/s)
 */
export function surfaceAt(
  track: Track,
  pos: Vector2D,
  vel: Vector2D,
): SurfaceSample {
  const mat = materialFor(track, pos);
  const speed = V.len(vel);

  const damping = mat.baseFriction + sinkToStop(speed);

  return {
    damping,
    friction: 0.9,
    lateral: { x: 0, y: 0 },
  };
}
