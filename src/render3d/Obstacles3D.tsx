"use client";

import type { Track, Obstacle } from "@/game/types";
import { boardToWorld, toWorldLen } from "./coords";

function Driftwood({ o, track }: { o: Extract<Obstacle, { kind: "driftwood" }>; track: Track }) {
  const pos = boardToWorld(o.pos, track, toWorldLen(o.halfH));
  const w = toWorldLen(o.halfW * 2);
  const h = toWorldLen(o.halfH * 2);
  return (
    <mesh position={pos} rotation={[0, -o.angle, 0]} castShadow receiveShadow>
      <boxGeometry args={[w, h, h]} />
      <meshStandardMaterial color="#8a6a43" roughness={1} />
    </mesh>
  );
}

function Kelp({ o, track }: { o: Extract<Obstacle, { kind: "kelp" | "clamshell" }>; track: Track }) {
  const base = boardToWorld(o.pos, track, 0);
  const rad = toWorldLen(o.radius);
  if (o.kind === "clamshell") {
    return (
      <mesh position={[base[0], rad * 0.5, base[2]]} castShadow receiveShadow>
        <sphereGeometry args={[rad, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#e7dcc6" roughness={0.6} />
      </mesh>
    );
  }
  // Kelp: a little clump of fronds.
  return (
    <group position={base}>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        const dx = Math.cos(a) * rad * 0.5;
        const dz = Math.sin(a) * rad * 0.5;
        const hgt = rad * (1.4 + (i % 3) * 0.4);
        return (
          <mesh key={i} position={[dx, hgt / 2, dz]} rotation={[0.2, a, 0]} castShadow>
            <coneGeometry args={[rad * 0.28, hgt, 6]} />
            <meshStandardMaterial color="#2f7d4f" roughness={0.8} />
          </mesh>
        );
      })}
    </group>
  );
}

/** All fixed + wave-spawned obstacles in 3D. */
export default function Obstacles3D({ track }: { track: Track }) {
  return (
    <group>
      {track.obstacles.map((o, i) =>
        o.kind === "driftwood" ? (
          <Driftwood key={i} o={o} track={track} />
        ) : (
          <Kelp key={i} o={o} track={track} />
        ),
      )}
    </group>
  );
}
