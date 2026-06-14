"use client";

// Floating directional arrow above the active marble, pointing toward the
// next course path waypoint.  Bobs gently on the Y axis.

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Track, Vector2D } from "@/game/types";
import { pathPointAt, heightAt } from "@/game/track";

interface DirectionArrowProps {
  track: Track;
  pos: Vector2D;       // active racer ground pos (x=worldX, y=worldZ)
  progress: number;    // 0..1
}

export default function DirectionArrow({ track, pos, progress }: DirectionArrowProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const baseY = heightAt(track, pos.x, pos.y) + 3.5;
    groupRef.current.position.y = baseY + Math.sin(clock.elapsedTime * 2.5) * 0.3;
  });

  // Aim toward a point 18% along the path from the racer's current progress.
  const targetT = Math.min(1, progress + 0.18);
  const target = pathPointAt(track, targetT);
  const dx = target.x - pos.x;
  const dz = target.y - pos.y;
  const heading = Math.atan2(dx, dz); // rotation about Y in XZ plane

  const groundY = heightAt(track, pos.x, pos.y);

  return (
    <group
      ref={groupRef}
      position={[pos.x, groundY + 3.5, pos.y]}
      rotation={[0, heading, 0]}
    >
      {/* shaft */}
      <mesh position={[0, 0, 0.5]}>
        <boxGeometry args={[0.18, 0.18, 1.0]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
      </mesh>
      {/* head */}
      <mesh position={[0, 0, 1.1]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.3, 0.5, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
      </mesh>
    </group>
  );
}
