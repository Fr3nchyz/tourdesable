// ============================================================================
// tour-de-sable — sand physics core
// Heavy linear rolling resistance: v *= (1 - coeff) every frame, modulated by
// terrain zone and wind-swept ripple alignment.
// ============================================================================

import type { Track, Vector2D, WaveState, Zone } from "./types";
import * as V from "./vector";
import { zoneAt, frictionForZone } from "./friction";
import {
  STOP_THRESHOLD,
  RIPPLE_ALIGN_TOLERANCE,
  RIPPLE_WITH_DRAG_MULT,
  RIPPLE_AGAINST_DRAG_MULT,
  RIPPLE_WOBBLE,
} from "./constants";

/** Below STOP_THRESHOLD a marble is considered at rest. */
export const isStopped = (vel: Vector2D): boolean =>
  V.len(vel) < STOP_THRESHOLD;

/** Advance a position by one frame of velocity. */
export const integrate = (pos: Vector2D, vel: Vector2D): Vector2D =>
  V.add(pos, vel);

export interface RippleEffect {
  /** Multiplier applied to the friction coefficient. */
  dragMult: number;
  /** Lateral wobble magnitude (px/frame), 0 when aligned. */
  wobble: number;
}

/**
 * Ripple lines are bidirectional, so motion is "with" the ripple when the
 * velocity angle is near the ripple angle OR its opposite. Aligned => -15% drag
 * (a speed aid). Across/against => +20% drag plus a micro lateral wobble.
 */
export function rippleEffect(vel: Vector2D, rippleAngle: number): RippleEffect {
  if (V.len(vel) === 0) return { dragMult: 1, wobble: 0 };
  const a = V.angle(vel);
  const aligned =
    V.angleDiff(a, rippleAngle) < RIPPLE_ALIGN_TOLERANCE ||
    V.angleDiff(a, rippleAngle + Math.PI) < RIPPLE_ALIGN_TOLERANCE;
  return aligned
    ? { dragMult: RIPPLE_WITH_DRAG_MULT, wobble: 0 }
    : { dragMult: RIPPLE_AGAINST_DRAG_MULT, wobble: RIPPLE_WOBBLE };
}

/**
 * Compute the next velocity for a marble at `pos` moving with `vel`.
 * - Kelp contact => instant stop (spec).
 * - Otherwise apply zone friction scaled by ripple alignment, plus wobble.
 */
export function advanceVelocity(
  track: Track,
  pos: Vector2D,
  vel: Vector2D,
  wave: WaveState,
): { vel: Vector2D; zone: Zone } {
  const zone = zoneAt(track, pos, wave);

  if (zone === "kelp") return { vel: { x: 0, y: 0 }, zone };

  const coeff = frictionForZone(zone);
  const rip = rippleEffect(vel, track.ripple.angle);
  const effective = coeff * rip.dragMult;

  let next = V.scale(vel, 1 - effective);

  // Micro-bounce wobble when crossing ripples: rotate the heading slightly.
  // Rotation preserves magnitude (marbles still come to rest). The sign is
  // taken from the ripple's spatial phase at this position so it flips each
  // time the marble crosses a ripple band — a genuine left/right wobble that
  // averages to zero curl (no orbiting).
  if (rip.wobble > 0) {
    const rippleNormal = V.fromAngle(track.ripple.angle + Math.PI / 2);
    const phase = V.dot(pos, rippleNormal) / track.ripple.spacing;
    const sign = Math.sin(phase * Math.PI * 2) >= 0 ? 1 : -1;
    next = V.rotate(next, rip.wobble * sign);
  }

  if (isStopped(next)) return { vel: { x: 0, y: 0 }, zone };
  return { vel: next, zone };
}
