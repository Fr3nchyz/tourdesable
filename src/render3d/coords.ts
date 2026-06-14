// ============================================================================
// tour-de-sable — board (2D sim) <-> world (3D scene) coordinate mapping
// The sim runs in board pixels (x: 0..width, y: 0..height). The 3D scene centres
// the board at the origin on the ground plane (XZ); +Y is up. Marbles roll on
// the y=0 plane; berms/figurines use +Y for visual height.
// ============================================================================

import type { Vector2D, Track } from "@/game/types";
import { WORLD_SCALE } from "@/game/constants";

export type Vec3 = [number, number, number];

/** Board point -> world position [x, y, z] (y = height above the sand). */
export function boardToWorld(p: Vector2D, board: Track, y = 0): Vec3 {
  return [
    (p.x - board.width / 2) * WORLD_SCALE,
    y,
    (p.y - board.height / 2) * WORLD_SCALE,
  ];
}

/** World ground point (x,z) -> board point. Inverse of boardToWorld. */
export function worldToBoard(x: number, z: number, board: Track): Vector2D {
  return {
    x: x / WORLD_SCALE + board.width / 2,
    y: z / WORLD_SCALE + board.height / 2,
  };
}

/** Scalar board length -> world length. */
export const toWorldLen = (px: number): number => px * WORLD_SCALE;
