// ============================================================================
// tour-de-sable — procedural sand ground plane
// A large horizontal plane (XZ, y=0) representing the surrounding beach. The
// sand colour map and grain bump map are generated procedurally on the client
// (no external assets): a warm tan base + multi-octave value noise for grain +
// faint diagonal wind ripples, baked into THREE.CanvasTexture instances.
// ============================================================================

"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
// Pulling a type from @react-three/fiber loads its global JSX augmentation,
// making the three.js intrinsic elements (<mesh>, <planeGeometry>, ...) known
// to TypeScript even though this is the first R3F component in the project.
import type { ThreeElements } from "@react-three/fiber";

export interface SandGroundProps {
  /** World-unit size of the square ground (default 140). */
  size?: number;
}

const TEX_SIZE = 512;
const REPEAT = 6;

// --- procedural noise helpers ------------------------------------------------

/** Deterministic 2D hash -> [0,1). */
function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth (cosine-interpolated) value noise sampled on an integer lattice. */
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
  const ab = a + (b - a) * u;
  const cd = c + (d - c) * u;
  return ab + (cd - ab) * v;
}

/** Multi-octave fractal noise in [0,1]. */
function fbm(x: number, y: number, octaves: number): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    value += amp * valueNoise(x * freq, y * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return value / norm;
}

interface SandTextures {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
}

/** Build the colour + bump CanvasTextures, or null if no canvas is available. */
function buildSandTextures(): SandTextures | null {
  if (typeof document === "undefined") return null;

  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = TEX_SIZE;
  colorCanvas.height = TEX_SIZE;
  const cctx = colorCanvas.getContext("2d");

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = TEX_SIZE;
  bumpCanvas.height = TEX_SIZE;
  const bctx = bumpCanvas.getContext("2d");

  if (!cctx || !bctx) return null;

  const colorImg = cctx.createImageData(TEX_SIZE, TEX_SIZE);
  const bumpImg = bctx.createImageData(TEX_SIZE, TEX_SIZE);
  const cdata = colorImg.data;
  const bdata = bumpImg.data;

  // Warm sand base colour (#e9d8a6).
  const baseR = 0xe9;
  const baseG = 0xd8;
  const baseB = 0xa6;

  const scale = 8; // lattice cells across the tile (kept seamless via wrap freq)

  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const u = (x / TEX_SIZE) * scale;
      const v = (y / TEX_SIZE) * scale;

      // Fine grain: high-frequency fbm.
      const grain = fbm(u * 6, v * 6, 4);
      // Soft undulation across the tile.
      const undulation = fbm(u * 0.8, v * 0.8, 3);
      // Faint diagonal wind ripples.
      const ripple =
        0.5 +
        0.5 *
          Math.sin((u + v) * 7 + fbm(u * 1.5, v * 1.5, 2) * 4);

      // Combine into a brightness factor around 1.0.
      const grainAmt = (grain - 0.5) * 0.18;
      const undAmt = (undulation - 0.5) * 0.14;
      const rippleAmt = (ripple - 0.5) * 0.06;
      const bright = 1 + grainAmt + undAmt + rippleAmt;

      const i = (y * TEX_SIZE + x) * 4;
      cdata[i] = Math.max(0, Math.min(255, baseR * bright));
      cdata[i + 1] = Math.max(0, Math.min(255, baseG * bright));
      cdata[i + 2] = Math.max(0, Math.min(255, baseB * (bright - rippleAmt * 0.5)));
      cdata[i + 3] = 255;

      // Bump: grain + ripple as grayscale height.
      const h = grain * 0.7 + ripple * 0.3;
      const g = Math.max(0, Math.min(255, h * 255));
      bdata[i] = g;
      bdata[i + 1] = g;
      bdata[i + 2] = g;
      bdata[i + 3] = 255;
    }
  }

  cctx.putImageData(colorImg, 0, 0);
  bctx.putImageData(bumpImg, 0, 0);

  const map = new THREE.CanvasTexture(colorCanvas);
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);

  for (const t of [map, bumpMap]) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(REPEAT, REPEAT);
    t.anisotropy = 4;
    t.needsUpdate = true;
  }
  map.colorSpace = THREE.SRGBColorSpace;

  return { map, bumpMap };
}

/**
 * Large procedural sand ground plane lying flat on y=0 in the XZ plane.
 * Receives shadows so the dug circuit and marbles cast onto the beach.
 */
export default function SandGround({ size = 140 }: SandGroundProps) {
  const textures = useMemo(() => buildSandTextures(), []);

  // Lie flat in the XZ plane and receive the circuit's shadows.
  const meshProps: ThreeElements["mesh"] = {
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, 0, 0],
    receiveShadow: true,
  };

  // Dispose GPU resources on unmount.
  useEffect(() => {
    return () => {
      textures?.map.dispose();
      textures?.bumpMap.dispose();
    };
  }, [textures]);

  return (
    <mesh {...meshProps}>
      <planeGeometry args={[size, size, 1, 1]} />
      {textures ? (
        <meshStandardMaterial
          map={textures.map}
          bumpMap={textures.bumpMap}
          bumpScale={0.08}
          roughness={0.95}
          metalness={0}
        />
      ) : (
        <meshStandardMaterial color="#e9d8a6" roughness={0.95} metalness={0} />
      )}
    </mesh>
  );
}
