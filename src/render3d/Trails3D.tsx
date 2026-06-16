"use client";

// Carved sand channels from past shots — the visual side of the persistent
// deformation layer. Each TrailSegment is drawn as a thin darkened scuff laid
// on the terrain, fading as the channel fills back in (turnsLeft → 0).

import { memo } from "react";
import type { Track, TrailSegment } from "@/game/types";
import { heightAt } from "@/game/track";
import { TRAIL_WIDTH, TRAIL_LIFETIME } from "@/game/constants";

function Trails3D({
  track,
  trails,
}: {
  track: Track;
  trails: TrailSegment[];
}) {
  return (
    <>
      {trails.map((s, i) => {
        const mx = (s.a.x + s.b.x) / 2;
        const mz = (s.a.y + s.b.y) / 2;
        const dx = s.b.x - s.a.x;
        const dz = s.b.y - s.a.y;
        const len = Math.hypot(dx, dz);
        if (len < 0.01) return null;
        const y = heightAt(track, mx, mz) + 0.05;
        const heading = Math.atan2(-dz, dx);
        const opacity = 0.4 * Math.max(0, Math.min(1, s.turnsLeft / TRAIL_LIFETIME));

        return (
          <mesh
            key={i}
            position={[mx, y, mz]}
            rotation={[-Math.PI / 2, 0, heading]}
            receiveShadow
          >
            {/* plane lying flat: local X = channel length, local Y = width */}
            <planeGeometry args={[len + TRAIL_WIDTH, TRAIL_WIDTH * 1.7]} />
            <meshStandardMaterial
              color="#6f5d3f"
              roughness={1}
              metalness={0}
              transparent
              opacity={opacity}
              depthWrite={false}
              polygonOffset
              polygonOffsetFactor={-1}
            />
          </mesh>
        );
      })}
    </>
  );
}

// Memoized: trails only change on settle (new array ref), not during aiming.
export default memo(Trails3D);
