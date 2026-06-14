// ============================================================================
// tour-de-sable — 2D vector math (pure, immutable helpers)
// ============================================================================

import type { Vector2D } from "./types";

export const vec = (x: number, y: number): Vector2D => ({ x, y });

export const clone = (a: Vector2D): Vector2D => ({ x: a.x, y: a.y });

export const add = (a: Vector2D, b: Vector2D): Vector2D => ({
  x: a.x + b.x,
  y: a.y + b.y,
});

export const sub = (a: Vector2D, b: Vector2D): Vector2D => ({
  x: a.x - b.x,
  y: a.y - b.y,
});

export const scale = (a: Vector2D, s: number): Vector2D => ({
  x: a.x * s,
  y: a.y * s,
});

export const dot = (a: Vector2D, b: Vector2D): number => a.x * b.x + a.y * b.y;

export const lenSq = (a: Vector2D): number => a.x * a.x + a.y * a.y;

export const len = (a: Vector2D): number => Math.hypot(a.x, a.y);

/** Unit vector. Returns {0,0} for a zero vector (safe). */
export const normalize = (a: Vector2D): Vector2D => {
  const l = len(a);
  return l === 0 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
};

export const distSq = (a: Vector2D, b: Vector2D): number => lenSq(sub(a, b));

export const dist = (a: Vector2D, b: Vector2D): number => len(sub(a, b));

/** Angle of the vector in radians (atan2). */
export const angle = (a: Vector2D): number => Math.atan2(a.y, a.x);

/** Unit vector from an angle (radians). */
export const fromAngle = (rad: number, mag = 1): Vector2D => ({
  x: Math.cos(rad) * mag,
  y: Math.sin(rad) * mag,
});

/** Rotate a vector by radians (CCW in standard math axes). */
export const rotate = (a: Vector2D, rad: number): Vector2D => {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
};

/** Left-hand perpendicular. */
export const perp = (a: Vector2D): Vector2D => ({ x: -a.y, y: a.x });

/** Reflect velocity v about a surface with unit normal n (elastic bounce). */
export const reflect = (v: Vector2D, n: Vector2D): Vector2D => {
  const d = dot(v, n);
  return { x: v.x - 2 * d * n.x, y: v.y - 2 * d * n.y };
};

/** Linear interpolation between a and b by t in [0,1]. */
export const lerp = (a: Vector2D, b: Vector2D, t: number): Vector2D => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

/** Smallest absolute angular difference between two angles (radians). */
export const angleDiff = (a: number, b: number): number => {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d);
};
