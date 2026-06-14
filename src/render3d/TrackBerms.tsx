"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { Track } from "@/game/types";
import {
  buildBermGeometry,
  buildChannelGeometry,
  buildFinishGeometry,
  makeCheckerTexture,
} from "./loopGeometry";

/**
 * The dug circuit: a worn channel ribbon flanked by two low banked berm ridges,
 * with a checkered finish line. Geometry is derived from the 2D loop.
 */
export default function TrackBerms({ track }: { track: Track }) {
  const inner = useMemo(() => buildBermGeometry(track, 1), [track]);
  const outer = useMemo(() => buildBermGeometry(track, -1), [track]);
  const channel = useMemo(() => buildChannelGeometry(track), [track]);
  const finish = useMemo(() => buildFinishGeometry(track), [track]);
  const checker = useMemo(() => makeCheckerTexture(), []);

  return (
    <group>
      {/* Worn racing channel (slightly darker, smoother sand). */}
      <mesh geometry={channel} receiveShadow>
        <meshStandardMaterial color="#d8c081" roughness={0.95} />
      </mesh>

      {/* Low banked berm ridges. */}
      <mesh geometry={inner} castShadow receiveShadow>
        <meshStandardMaterial color="#cdaf6e" roughness={1} flatShading />
      </mesh>
      <mesh geometry={outer} castShadow receiveShadow>
        <meshStandardMaterial color="#cdaf6e" roughness={1} flatShading />
      </mesh>

      {/* Finish line. */}
      <mesh geometry={finish}>
        <meshStandardMaterial
          map={checker ?? undefined}
          color={checker ? "#ffffff" : "#cccccc"}
          roughness={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
