"use client";

// Tall golden beacon marking the finish line.

import type { Track } from "@/game/types";
import { heightAt } from "@/game/track";

export default function FinishBeacon({ track }: { track: Track }) {
  const fx = track.finish.x;
  const fz = track.finish.y; // pos.y = world Z
  const baseY = heightAt(track, fx, fz);
  const poleH = 14;
  const halfH = poleH / 2;

  return (
    <group position={[fx, baseY, fz]}>
      {/* pole */}
      <mesh castShadow position={[0, halfH, 0]}>
        <cylinderGeometry args={[0.12, 0.14, poleH, 8]} />
        <meshStandardMaterial
          color="#ffd700"
          emissive="#ffd700"
          emissiveIntensity={0.45}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>

      {/* flag panel */}
      <mesh position={[0.8, poleH - 0.5, 0]}>
        <boxGeometry args={[1.6, 0.9, 0.06]} />
        <meshStandardMaterial color="#111111" roughness={0.9} />
      </mesh>
      {/* checkers (four gold squares on the flag) */}
      {[
        [-0.4, 0.22, 0.04], [0.4, 0.22, 0.04],
        [-0.4, -0.22, 0.04], [0.4, -0.22, 0.04],
      ].map(([dx, dy, dz], i) =>
        (i % 2 === 0 ? true : false) === (Math.floor(i / 2) % 2 === 0) ? (
          <mesh key={i} position={[0.8 + dx, poleH - 0.5 + dy, dz]}>
            <boxGeometry args={[0.7, 0.38, 0.05]} />
            <meshStandardMaterial
              color="#ffd700"
              emissive="#ffd700"
              emissiveIntensity={0.3}
            />
          </mesh>
        ) : null,
      )}

      {/* glow light */}
      <pointLight
        color="#ffd700"
        intensity={12}
        distance={22}
        decay={2}
        position={[0, poleH * 0.6, 0]}
      />
    </group>
  );
}
