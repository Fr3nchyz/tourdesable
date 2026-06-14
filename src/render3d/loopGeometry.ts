// ============================================================================
// tour-de-sable — build 3D geometry from the 2D loop track
//  - channel ribbon (the dug racing surface)
//  - low banked berm ridges along the inner + outer edges
//  - finish-line quad across the channel
// All geometry is emitted in world space via boardToWorld.
// ============================================================================

import * as THREE from "three";
import type { Track } from "@/game/types";
import * as V from "@/game/vector";
import { boardToWorld } from "./coords";
import { BERM_HEIGHT } from "@/game/constants";

/** Board-space left normal of the forward tangent at loop vertex i. */
function stationFrame(track: Track, i: number) {
  const n = track.loop.length;
  const a = track.loop[i % n];
  const b = track.loop[(i + 1) % n];
  const tangent = V.normalize(V.sub(b, a));
  return { center: a, left: V.perp(tangent) };
}

/**
 * Banked berm ridge along one side of the channel. `side` = +1 (inner) or -1
 * (outer). Cross-section: inner foot (y=0) -> crest (y=BERM_HEIGHT) -> outer
 * foot (y=0), swept around the closed loop.
 */
export function buildBermGeometry(
  track: Track,
  side: 1 | -1,
  bermWidthPx = 52,
): THREE.BufferGeometry {
  const n = track.loop.length;
  const tHW = track.trackHalfWidth;
  const positions: number[] = [];

  for (let i = 0; i <= n; i++) {
    const { center, left } = stationFrame(track, i);
    const foot1 = V.add(center, V.scale(left, side * tHW));
    const crest = V.add(center, V.scale(left, side * (tHW + bermWidthPx * 0.5)));
    const foot2 = V.add(center, V.scale(left, side * (tHW + bermWidthPx)));
    positions.push(...boardToWorld(foot1, track, 0));
    positions.push(...boardToWorld(crest, track, BERM_HEIGHT));
    positions.push(...boardToWorld(foot2, track, 0));
  }

  const indices: number[] = [];
  for (let s = 0; s < n; s++) {
    const a = s * 3;
    const b = (s + 1) * 3;
    // quad foot1->crest
    indices.push(a + 0, a + 1, b + 1, a + 0, b + 1, b + 0);
    // quad crest->foot2
    indices.push(a + 1, a + 2, b + 2, a + 1, b + 2, b + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** The flat dug channel surface (a ribbon across the loop at ground level). */
export function buildChannelGeometry(track: Track, y = 0.02): THREE.BufferGeometry {
  const n = track.loop.length;
  const tHW = track.trackHalfWidth;
  const positions: number[] = [];
  const uvs: number[] = [];

  for (let i = 0; i <= n; i++) {
    const { center, left } = stationFrame(track, i);
    const inner = V.add(center, V.scale(left, tHW));
    const outer = V.add(center, V.scale(left, -tHW));
    positions.push(...boardToWorld(inner, track, y));
    positions.push(...boardToWorld(outer, track, y));
    const u = i / n;
    uvs.push(u, 0, u, 1);
  }

  const indices: number[] = [];
  for (let s = 0; s < n; s++) {
    const a = s * 2;
    const b = (s + 1) * 2;
    indices.push(a, a + 1, b + 1, a, b + 1, b);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** A quad spanning the channel at the finish line (loop param t = 0). */
export function buildFinishGeometry(track: Track, y = 0.05): THREE.BufferGeometry {
  const { center, left } = stationFrame(track, 0);
  const tHW = track.trackHalfWidth;
  // A short strip a few stations long so the line has visible width.
  const aheadCenter = stationFrame(track, 1).center;
  const inner0 = V.add(center, V.scale(left, tHW));
  const outer0 = V.add(center, V.scale(left, -tHW));
  const inner1 = V.add(aheadCenter, V.scale(left, tHW));
  const outer1 = V.add(aheadCenter, V.scale(left, -tHW));

  const positions = [
    ...boardToWorld(inner0, track, y),
    ...boardToWorld(outer0, track, y),
    ...boardToWorld(outer1, track, y),
    ...boardToWorld(inner1, track, y),
  ];
  const uvs = [0, 0, 1, 0, 1, 1, 0, 1];
  const indices = [0, 1, 2, 0, 2, 3];

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** A simple black/white checker texture for the finish line. */
export function makeCheckerTexture(squares = 8): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const sq = size / squares;
  for (let y = 0; y < squares; y++) {
    for (let x = 0; x < squares; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#111" : "#f5f5f5";
      ctx.fillRect(x * sq, y * sq, sq, sq);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 1);
  return tex;
}
