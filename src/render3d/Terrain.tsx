"use client";

// ============================================================================
// Terrain — heightfield visual + Rapier trimesh collider for each themed map.
// The grid is sampled from track.elevation via heightAt() and reused for both
// the physics body and the rendered sand mesh.
// ============================================================================

import { useMemo, useEffect } from "react";
import * as THREE from "three";
import { RigidBody, TrimeshCollider } from "@react-three/rapier";
import type { Track, Zone } from "@/game/types";
import { heightAt } from "@/game/track";
import { zoneAt } from "@/game/surface";

// Per-zone vertex tint (multiplies the sand texture). Keeps the look in lockstep
// with the physics zones (B3): the smooth light channel is the fast line, the
// darker rough shoulders are the draggy loose berm, grey aprons mark granite.
const ZONE_TINT: Record<Zone, [number, number, number]> = {
  sand: [1.05, 1.03, 0.99],
  loose_sand_berm: [0.82, 0.75, 0.63],
  granite_rock: [0.69, 0.71, 0.75],
};

// Grid resolution: more rows (Z) than cols (X) since the course is longer.
const COLS = 20; // vertices along X (course width)
const ROWS = 192; // vertices along Z (course length)

const TEX_SIZE = 512;
const REPEAT = 12;

// --- procedural sand texture (same approach as SandGround) ------------------

function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (d - c - b + a) * u * v;
}

function fbm(x: number, y: number, oct: number): number {
  let v = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    v += amp * valueNoise(x * f, y * f);
    n += amp;
    amp *= 0.5;
    f *= 2;
  }
  return v / n;
}

function buildSandTextures(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } | null {
  if (typeof document === "undefined") return null;
  const cc = document.createElement("canvas");
  cc.width = TEX_SIZE; cc.height = TEX_SIZE;
  const bc = document.createElement("canvas");
  bc.width = TEX_SIZE; bc.height = TEX_SIZE;
  const cx = cc.getContext("2d");
  const bx = bc.getContext("2d");
  if (!cx || !bx) return null;
  const ci = cx.createImageData(TEX_SIZE, TEX_SIZE);
  const bi = bx.createImageData(TEX_SIZE, TEX_SIZE);
  const cd = ci.data, bd = bi.data;
  const sc = 8;
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const u = (x / TEX_SIZE) * sc;
      const v = (y / TEX_SIZE) * sc;
      const grain = fbm(u * 6, v * 6, 4);
      const und = fbm(u * 0.8, v * 0.8, 3);
      const rip = 0.5 + 0.5 * Math.sin((u + v) * 7 + fbm(u * 1.5, v * 1.5, 2) * 4);
      const bright = 1 + (grain - 0.5) * 0.18 + (und - 0.5) * 0.14 + (rip - 0.5) * 0.06;
      // Sparse pale shell flecks scattered through the golden sand (reference photos).
      const shell = hash2(x * 1.7 + 3.1, y * 1.3 + 7.9);
      const fleck = shell > 0.991 ? (shell - 0.991) / 0.009 : 0;
      const i = (y * TEX_SIZE + x) * 4;
      // Warmer, more golden Breton beach sand than the old greige tone.
      cd[i]   = Math.max(0, Math.min(255, 0xe8 * bright + fleck * 26));
      cd[i+1] = Math.max(0, Math.min(255, 0xcf * bright + fleck * 30));
      cd[i+2] = Math.max(0, Math.min(255, 0x90 * bright + fleck * 45));
      cd[i+3] = 255;
      const g = Math.max(0, Math.min(255, (grain * 0.7 + rip * 0.3) * 255));
      bd[i] = bd[i+1] = bd[i+2] = g; bd[i+3] = 255;
    }
  }
  cx.putImageData(ci, 0, 0);
  bx.putImageData(bi, 0, 0);
  const map = new THREE.CanvasTexture(cc);
  const bump = new THREE.CanvasTexture(bc);
  for (const t of [map, bump]) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(REPEAT, REPEAT);
    t.anisotropy = 4;
    t.needsUpdate = true;
  }
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, bump };
}

// --- grid builder -----------------------------------------------------------

interface TerrainData {
  geometry: THREE.BufferGeometry;
  vertices: Float32Array;
  indices: Uint32Array;
}

function buildTerrain(track: Track): TerrainData {
  const vCount = COLS * ROWS;
  const vertices = new Float32Array(vCount * 3);
  const uvs = new Float32Array(vCount * 2);
  const colors = new Float32Array(vCount * 3);
  const indexList: number[] = [];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = -track.width / 2 + (col / (COLS - 1)) * track.width;
      const z = (row / (ROWS - 1)) * track.length;
      let y = heightAt(track, x, z);
      // Raised sand berms on the left and right edges — natural pushed-up sand look.
      const edgeCol = Math.min(col, COLS - 1 - col); // 0 at edges, increases inward
      if (edgeCol === 0) y += 2.0;
      else if (edgeCol === 1) y += 1.2;
      else if (edgeCol === 2) y += 0.6;
      else if (edgeCol === 3) y += 0.2;
      // Jitter the berm crest so it reads as hand-patted crumbly sand, not a wall.
      if (edgeCol <= 3) y += (valueNoise(col * 1.7, z * 0.6) - 0.5) * 0.5 * (4 - edgeCol);
      const vi = row * COLS + col;
      vertices[vi * 3]     = x;
      vertices[vi * 3 + 1] = y;
      vertices[vi * 3 + 2] = z;
      uvs[vi * 2]     = (col / (COLS - 1)) * REPEAT;
      uvs[vi * 2 + 1] = (row / (ROWS - 1)) * REPEAT;
      const tint = ZONE_TINT[zoneAt(track, { x, y: z })];
      colors[vi * 3]     = tint[0];
      colors[vi * 3 + 1] = tint[1];
      colors[vi * 3 + 2] = tint[2];
    }
  }

  for (let row = 0; row < ROWS - 1; row++) {
    for (let col = 0; col < COLS - 1; col++) {
      const tl = row * COLS + col;
      const tr = tl + 1;
      const bl = (row + 1) * COLS + col;
      const br = bl + 1;
      indexList.push(tl, bl, tr, tr, bl, br);
    }
  }

  const indices = new Uint32Array(indexList);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();

  return { geometry, vertices, indices };
}

// --- component --------------------------------------------------------------

export default function Terrain({ track }: { track: Track }) {
  const { geometry, vertices, indices } = useMemo(() => buildTerrain(track), [track]);
  const textures = useMemo(() => buildSandTextures(), []);

  useEffect(() => {
    return () => {
      geometry.dispose();
      textures?.map.dispose();
      textures?.bump.dispose();
    };
  }, [geometry, textures]);

  return (
    <>
      {/* Physics collider */}
      <RigidBody type="fixed" colliders={false}>
        <TrimeshCollider args={[vertices, indices]} />
      </RigidBody>

      {/* Visual mesh */}
      <mesh geometry={geometry} receiveShadow>
        {textures ? (
          <meshStandardMaterial
            map={textures.map}
            bumpMap={textures.bump}
            bumpScale={0.06}
            roughness={0.92}
            metalness={0}
            vertexColors
          />
        ) : (
          <meshStandardMaterial color="#e9d8a6" roughness={0.92} metalness={0} vertexColors />
        )}
      </mesh>
    </>
  );
}
