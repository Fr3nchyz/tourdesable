// ============================================================================
// tour-de-sable — Surface Displacement engine (pure, framework-agnostic)
//
// Replaces "constant linear friction" with a material-driven model. Each
// physics frame the marble samples surfaceAt() at its ground position +
// velocity and pushes the result into the Rapier body:
//   • sample.damping → rb.setLinearDamping  (rolling resistance + sink-to-stop
//                                            + grain variance + trail fast-lane)
//   • sample.lateral → rb.applyImpulse      (grain wobble + camber, speed-scaled)
//
// Imports only ./types, ./vector, ./constants — NO three / rapier. This keeps
// the math portable (e.g. droppable into a Godot GDScript / shader).
// ============================================================================

import type { SurfaceMaterial, Track, TrailSegment, Vector2D, Zone } from "./types";
import * as V from "./vector";
import { pathPointAt } from "./track";
import {
  ZONE_MATERIAL,
  ZONE_FRICTION,
  GRANITE_MARGIN,
  SINK_GAIN,
  SINK_SCALE,
  GRAIN_FREQ,
  WOBBLE_GAIN,
  WOBBLE_MIN_SPEED,
  TRAIL_WIDTH,
  LANE_HALF_WIDTH,
  CAMBER_GAIN,
  CAMBER_MIN_SPEED,
} from "./constants";

/** What the marble pushes into Rapier this frame. */
export interface SurfaceSample {
  /** Effective Rapier linearDamping. */
  damping: number;
  /** Effective collider friction (grip). */
  friction: number;
  /** Lateral force (ground XZ) to apply as an impulse — 0 at rest. */
  lateral: Vector2D;
}

// ---------------------------------------------------------------------------
// Value noise (deterministic; no noise lib exists in the repo)
// ---------------------------------------------------------------------------

/** Deterministic lattice hash → [0,1). */
function hash2(ix: number, iz: number, seed: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 2147483647)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  // `>>> 0` keeps the XOR unsigned — bitwise ops otherwise yield a signed int32,
  // which would let corner values go negative and break the [0,1) range.
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** 2D value noise in [-1, 1], deterministic from (x, z, seed). */
export function valueNoise2D(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fz = z - z0;
  const v00 = hash2(x0, z0, seed);
  const v10 = hash2(x0 + 1, z0, seed);
  const v01 = hash2(x0, z0 + 1, seed);
  const v11 = hash2(x0 + 1, z0 + 1, seed);
  const sx = smooth(fx);
  const sz = smooth(fz);
  const a = v00 + (v10 - v00) * sx;
  const b = v01 + (v11 - v01) * sx;
  return (a + (b - a) * sz) * 2 - 1;
}

/** Low-frequency grain sample at a ground position, in [-1, 1]. */
export function grainAt(track: Track, pos: Vector2D): number {
  return valueNoise2D(pos.x * GRAIN_FREQ, pos.y * GRAIN_FREQ, track.seed);
}

// ---------------------------------------------------------------------------
// Material + sink-to-stop
// ---------------------------------------------------------------------------

/**
 * Coastal geology classification of a ground patch:
 *   • granite_rock    — within the hard apron around any rock.
 *   • loose_sand_berm — beyond the carved channel half-width (off the racing line).
 *   • sand            — on the channel: the fast line.
 * The berm threshold reuses LANE_HALF_WIDTH so it matches the cambered lane and
 * the carved channel cut by track.ts:heightAt.
 */
export function zoneAt(track: Track, pos: Vector2D): Zone {
  for (const r of track.rocks) {
    const dx = pos.x - r.pos.x;
    const dz = pos.y - r.pos.y;
    const reach = r.radius + GRANITE_MARGIN;
    if (dx * dx + dz * dz <= reach * reach) return "granite_rock";
  }
  const centre = pathPointAt(track, pos.y / track.length);
  if (Math.abs(pos.x - centre.x) > LANE_HALF_WIDTH) return "loose_sand_berm";
  return "sand";
}

/**
 * Material at a ground position, resolved through its coastal zone. The
 * signature stays (track, pos) so call sites are unchanged.
 */
export function materialFor(track: Track, pos: Vector2D): SurfaceMaterial {
  return ZONE_MATERIAL[zoneAt(track, pos)];
}

/**
 * Non-linear "sink-to-stop" damping: ≈0 at launch speed, ramping up sharply as
 * the marble slows so it settles into the sand with a thud (and the turn
 * resolves crisply). Returns the EXTRA damping to add on top of baseFriction.
 */
export function sinkToStop(speed: number): number {
  return SINK_GAIN * Math.exp(-Math.max(0, speed) / SINK_SCALE);
}

// ---------------------------------------------------------------------------
// Deformation trails
// ---------------------------------------------------------------------------

/** Distance from point p to segment a→b. */
function segDist(p: Vector2D, a: Vector2D, b: Vector2D): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  let t = len2 > 0 ? ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}

/** True if pos lies within a still-active carved channel. */
export function onTrail(trails: TrailSegment[], pos: Vector2D): boolean {
  for (const s of trails) {
    if (s.turnsLeft > 0 && segDist(pos, s.a, s.b) <= TRAIL_WIDTH) return true;
  }
  return false;
}

/**
 * Damping multiplier for the deformation layer: <1 inside a carved channel
 * (the dug "fast lane"), 1 elsewhere. Reduction scales with the material's
 * deformationFactor.
 */
export function trailFrictionMultiplier(
  track: Track,
  trails: TrailSegment[],
  pos: Vector2D,
): number {
  const mat = materialFor(track, pos);
  return onTrail(trails, pos) ? 1 - mat.deformationFactor : 1;
}

// ---------------------------------------------------------------------------
// Camber
// ---------------------------------------------------------------------------

/**
 * Lateral camber force (ground XZ). The lane crowns at x=0, so a marble drifts
 * toward the nearer shoulder ∝ its offset from centre. Scaled by speed and
 * suppressed at rest so it never stalls settle detection. Direction is along
 * world X (across the beach), away from the lane centre.
 */
export function camberLateral(
  _track: Track,
  pos: Vector2D,
  vel: Vector2D,
): Vector2D {
  const speed = V.len(vel);
  if (speed < CAMBER_MIN_SPEED) return { x: 0, y: 0 };
  const t = Math.max(-1, Math.min(1, pos.x / LANE_HALF_WIDTH));
  return { x: CAMBER_GAIN * t * Math.min(speed, 6), y: 0 };
}

// ---------------------------------------------------------------------------
// Combined sample
// ---------------------------------------------------------------------------

/**
 * Sample the surface for the active marble.
 * @param pos ground position (x = world X, y = world Z)
 * @param vel ground velocity (x = world X/s, y = world Z/s)
 */
export function surfaceAt(
  track: Track,
  trails: TrailSegment[],
  pos: Vector2D,
  vel: Vector2D,
): SurfaceSample {
  const zone = zoneAt(track, pos);
  const mat = ZONE_MATERIAL[zone];
  const speed = V.len(vel);

  // Base rolling resistance + Perlin grain variance + sink-to-stop.
  let damping = mat.baseFriction + grainAt(track, pos) * mat.grainResistance;
  damping += sinkToStop(speed);
  // Carved channels lower resistance → temporary fast lane.
  damping *= trailFrictionMultiplier(track, trails, pos);

  // Grain micro-wobble: a small lateral nudge perpendicular to travel, scaled
  // by speed so it only perturbs a rolling marble and vanishes at rest.
  let lateral: Vector2D = { x: 0, y: 0 };
  if (speed > WOBBLE_MIN_SPEED) {
    const w = valueNoise2D(
      pos.x * GRAIN_FREQ * 3 + 11.7,
      pos.y * GRAIN_FREQ * 3 + 7.3,
      track.seed,
    );
    const perp = V.perp(V.normalize(vel)); // left-hand normal to travel
    lateral = V.scale(perp, w * WOBBLE_GAIN * Math.min(speed, 6));
  }
  // Camber: crowned lane pushes the marble toward the shoulder.
  lateral = V.add(lateral, camberLateral(track, pos, vel));

  return { damping, friction: ZONE_FRICTION[zone], lateral };
}
