"use client";

import type { Racer, Track } from "@/game/types";
import { tangentAt } from "@/game/track";
import * as V from "@/game/vector";
import { boardToWorld } from "./coords";
import { MARBLE_RADIUS, WORLD_SCALE } from "@/game/constants";
import Cyclist from "./Cyclist";

const R = MARBLE_RADIUS * WORLD_SCALE;

/** Heading (rotation about Y) so local +X faces a board-space direction. */
function headingY(dir: { x: number; y: number }): number {
  // board (dx,dy) -> world (dx, 0, dy); +X rotated by a about Y = (cos,-sin).
  return Math.atan2(-dir.y, dir.x);
}

function Marble({ color, pos }: { color: string; pos: [number, number, number] }) {
  return (
    <mesh position={pos} castShadow>
      <sphereGeometry args={[R, 28, 28]} />
      <meshStandardMaterial
        color={color}
        roughness={0.15}
        metalness={0.35}
        emissive={color}
        emissiveIntensity={0.08}
      />
    </mesh>
  );
}

/**
 * Renders every racer. The active racer (whose turn it is) is shown as a colored
 * marble; everyone else is a cyclist figurine facing its direction of travel.
 */
export default function Racers3D({
  racers,
  activeId,
  track,
}: {
  racers: Racer[];
  activeId: string;
  track: Track;
}) {
  return (
    <group>
      {racers.map((r) => {
        const isActive = r.id === activeId;
        if (isActive) {
          const pos = boardToWorld(r.pos, track, R);
          return <Marble key={r.id} color={r.color} pos={pos} />;
        }
        const heading =
          V.len(r.vel) > 0.01 ? r.vel : tangentAt(track, r.loopT);
        const pos = boardToWorld(r.pos, track, 0);
        return (
          <group
            key={r.id}
            position={pos}
            rotation={[0, headingY(heading), 0]}
            scale={r.state === "tipped" ? 0.9 : 1}
          >
            <Cyclist color={r.color} />
          </group>
        );
      })}
    </group>
  );
}
