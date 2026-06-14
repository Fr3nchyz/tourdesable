"use client";

// ============================================================================
// Scene — the full R3F scene for a race.
// Wrapped in a Rapier <Physics> world.  Terrain + rocks provide the static
// collision surface; the active racer's marble is a dynamic RigidBody.
// ============================================================================

import { useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { Physics } from "@react-three/rapier";
import { EffectComposer, DepthOfField, Vignette } from "@react-three/postprocessing";
import type { Track, Racer, TrailSegment, Vector2D } from "@/game/types";
import {
  GRAVITY,
  MARBLE_RADIUS,
  MAX_DRAG_WORLD,
  TENSION_THRESHOLD,
  TENSION_JITTER,
} from "@/game/constants";
import Terrain from "./Terrain";
import Rocks3D from "./Rocks3D";
import Trails3D from "./Trails3D";
import Racers3D, { type Impulse3D } from "./Racers3D";
import OrbitCamera from "./OrbitCamera";
import DirectionArrow from "./DirectionArrow";
import FinishBeacon from "./FinishBeacon";

export interface AimState {
  dir: Vector2D; // unit, ground-plane (x=worldX, y=worldZ)
  power: number; // 0..1
}

export interface SceneProps {
  track: Track;
  racers: Racer[];
  activeId: string;
  trails: TrailSegment[];
  inPhysics: boolean;
  aim: AimState | null;
  impulseRef: React.RefObject<Impulse3D | null>;
  recenterRef: React.RefObject<boolean>;
  onRacerPos: (id: string, wx: number, wy: number, wz: number) => "finish" | "offcourse" | "ok";
  onSettle: (carvedPath: Vector2D[]) => void;
  onAimDown: (ground: Vector2D) => void;
  onAimMove: (ground: Vector2D) => void;
  onAimUp: () => void;
}

/** Aim arrow from the marble in the launch direction. */
function AimArrow({
  origin,
  aim,
}: {
  origin: [number, number, number];
  aim: AimState;
}) {
  const groupRef = useRef<Group>(null);
  const baseX = origin[0];
  const baseY = origin[1] + MARBLE_RADIUS + 0.1;
  const baseZ = origin[2];

  // Tension curve: the last bit of drag "strains" — length eases toward max so
  // power feels harder to add near full power.
  const len = Math.pow(aim.power, 1.4) * MAX_DRAG_WORLD * 0.85;
  const heading = Math.atan2(-aim.dir.y, aim.dir.x);
  const color = aim.power > 0.8 ? "#e63946" : aim.power > 0.5 ? "#f4a261" : "#2a9d8f";

  // Near max power the arrow jitters to signal physical strain.
  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    if (aim.power > TENSION_THRESHOLD) {
      const k =
        ((aim.power - TENSION_THRESHOLD) / (1 - TENSION_THRESHOLD)) *
        TENSION_JITTER;
      g.position.set(
        baseX + (Math.random() - 0.5) * k,
        baseY + (Math.random() - 0.5) * k,
        baseZ + (Math.random() - 0.5) * k,
      );
    } else {
      g.position.set(baseX, baseY, baseZ);
    }
  });

  return (
    <group ref={groupRef} position={[baseX, baseY, baseZ]} rotation={[0, heading, 0]}>
      <mesh position={[len / 2, 0, 0]}>
        <boxGeometry args={[len, 0.08, 0.5]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>
      <mesh position={[len, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.55, 1.0, 10]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

export default function Scene({
  track,
  racers,
  activeId,
  trails,
  inPhysics,
  aim,
  impulseRef,
  recenterRef,
  onRacerPos,
  onSettle,
  onAimDown,
  onAimMove,
  onAimUp,
}: SceneProps) {
  const active = racers.find((r) => r.id === activeId);

  // Convert a pointer hit on the invisible flat plane → ground-space Vector2D.
  const toGround = (e: ThreeEvent<PointerEvent>): Vector2D => ({
    x: e.point.x,
    y: e.point.z,
  });

  const aimOrigin: [number, number, number] = active
    ? [active.pos.x, 0, active.pos.y]
    : [0, 0, 0];

  return (
    <>
      <color attach="background" args={["#b8d8e8"]} />
      <fog attach="fog" args={["#b8d8e8", 70, 180]} />

      <hemisphereLight args={["#fff7e6", "#9a7b4f", 0.55]} />
      <directionalLight
        position={[30, 50, 20]}
        intensity={1.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-camera-near={1}
        shadow-camera-far={160}
        shadow-bias={-0.0004}
      />

      <Physics gravity={[0, GRAVITY, 0]} colliders={false}>
        <Terrain track={track} />
        <Rocks3D track={track} />
        <Racers3D
          racers={racers}
          activeId={activeId}
          track={track}
          trails={trails}
          impulseRef={impulseRef}
          inPhysics={inPhysics}
          onRacerPos={onRacerPos}
          onSettle={onSettle}
        />
      </Physics>

      {/* Carved sand channels (persistent deformation layer) */}
      <Trails3D track={track} trails={trails} />

      {/* Direction arrow over active marble */}
      {active && !inPhysics && (
        <DirectionArrow
          track={track}
          pos={active.pos}
          progress={active.progress}
        />
      )}

      {/* Finish beacon */}
      <FinishBeacon track={track} />

      {/* Aim arrow (slingshot preview) */}
      {aim && !inPhysics && <AimArrow origin={aimOrigin} aim={aim} />}

      {/* Orbit camera */}
      <OrbitCamera
        target={active ? active.pos : { x: 0, y: track.length / 2 }}
        recenterRef={recenterRef}
      />

      {/* Invisible flat plane at y=0 for flick raycasting. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        onPointerDown={(e) => {
          e.stopPropagation();
          (e.target as Element).setPointerCapture?.(e.pointerId);
          onAimDown(toGround(e));
        }}
        onPointerMove={(e) => onAimMove(toGround(e))}
        onPointerUp={(e) => {
          (e.target as Element).releasePointerCapture?.(e.pointerId);
          onAimUp();
        }}
      >
        <planeGeometry args={[500, 500]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <EffectComposer>
        <DepthOfField focusDistance={0.01} focalLength={0.05} bokehScale={2.5} />
        <Vignette eskil={false} offset={0.2} darkness={0.6} />
      </EffectComposer>
    </>
  );
}
