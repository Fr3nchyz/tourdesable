// ============================================================================
// tour-de-sable — collision model
//  - Marble vs marble: the "Pocket-Stealer Shunt"
//  - Marble vs driftwood: perfectly elastic bounce off a rotated rectangle
// (Kelp drag + out-of-bounds tipping are handled in physics/engine, not here.)
// ============================================================================

import type { RectObstacle, Vector2D } from "./types";
import * as V from "./vector";
import { SHUNT_TRANSFER } from "./constants";

/** Two circles overlap when centre distance < sum of radii. */
export const circlesOverlap = (
  aPos: Vector2D,
  aR: number,
  bPos: Vector2D,
  bR: number,
): boolean => V.distSq(aPos, bPos) < (aR + bR) * (aR + bR);

export interface ShuntResult {
  /** Attacker after impact: stopped, parked in the vacated pocket. */
  attacker: { pos: Vector2D; vel: Vector2D };
  /** Target after impact: launched along the impact normal. */
  target: { pos: Vector2D; vel: Vector2D };
  /** World contact point (for the sand-burst particles). */
  contact: Vector2D;
}

/**
 * Pocket-Stealer Shunt. A moving attacker strikes a stationary target:
 *  1. 70% of the attacker's incoming speed transfers to the target along the
 *     normal (attacker->target), shoving it outward toward the dry shoulder.
 *  2. The attacker sheds its momentum and stops dead in the pocket the target
 *     just vacated.
 */
export function resolveShunt(
  attackerPos: Vector2D,
  attackerVel: Vector2D,
  attackerR: number,
  targetPos: Vector2D,
): ShuntResult {
  const normal = V.normalize(V.sub(targetPos, attackerPos));
  const incomingSpeed = V.len(attackerVel);
  const targetVel = V.scale(normal, SHUNT_TRANSFER * incomingSpeed);
  const contact = V.add(attackerPos, V.scale(normal, attackerR));

  return {
    attacker: { pos: V.clone(targetPos), vel: { x: 0, y: 0 } },
    target: { pos: V.clone(targetPos), vel: targetVel },
    contact,
  };
}

export interface BounceResult {
  pos: Vector2D;
  vel: Vector2D;
  hit: boolean;
  contact?: Vector2D;
}

/**
 * Elastic bounce of a marble (circle) off a driftwood plank (rotated rect).
 * Returns the corrected position (pushed clear) and reflected velocity.
 */
export function resolveDriftwood(
  pos: Vector2D,
  vel: Vector2D,
  radius: number,
  rect: RectObstacle,
): BounceResult {
  // Transform the marble centre into the rect's local (axis-aligned) space.
  const rel = V.sub(pos, rect.pos);
  const local = V.rotate(rel, -rect.angle);

  const clampedX = Math.max(-rect.halfW, Math.min(rect.halfW, local.x));
  const clampedY = Math.max(-rect.halfH, Math.min(rect.halfH, local.y));

  const insideRect =
    clampedX === local.x && clampedY === local.y; // centre is within the plank

  let localNormal: Vector2D;
  let surfaceLocal: Vector2D;

  if (insideRect) {
    // Push out along the axis of least penetration.
    const dxRight = rect.halfW - local.x;
    const dxLeft = local.x + rect.halfW;
    const dyTop = rect.halfH - local.y;
    const dyBottom = local.y + rect.halfH;
    const min = Math.min(dxRight, dxLeft, dyTop, dyBottom);
    if (min === dxRight) {
      localNormal = { x: 1, y: 0 };
      surfaceLocal = { x: rect.halfW, y: local.y };
    } else if (min === dxLeft) {
      localNormal = { x: -1, y: 0 };
      surfaceLocal = { x: -rect.halfW, y: local.y };
    } else if (min === dyTop) {
      localNormal = { x: 0, y: 1 };
      surfaceLocal = { x: local.x, y: rect.halfH };
    } else {
      localNormal = { x: 0, y: -1 };
      surfaceLocal = { x: local.x, y: -rect.halfH };
    }
  } else {
    const closest = { x: clampedX, y: clampedY };
    const delta = V.sub(local, closest);
    if (V.lenSq(delta) >= radius * radius) {
      return { pos, vel, hit: false }; // no contact
    }
    localNormal = V.normalize(delta);
    surfaceLocal = closest;
  }

  // Back to world space.
  const worldNormal = V.rotate(localNormal, rect.angle);
  const surfaceWorld = V.add(rect.pos, V.rotate(surfaceLocal, rect.angle));

  // Reposition the marble just clear of the surface, reflect its velocity.
  const correctedPos = V.add(surfaceWorld, V.scale(worldNormal, radius));
  const reflected = V.reflect(vel, worldNormal);

  return {
    pos: correctedPos,
    vel: reflected,
    hit: true,
    contact: surfaceWorld,
  };
}
