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
  MARBLE_LINEAR_DAMPING,
  MAX_DRAG_WORLD,
  TENSION_THRESHOLD,
  TENSION_JITTER,
} from "@/game/constants";
import { heightAt } from "@/game/track";
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
  marbleKey: string;
  trails: TrailSegment[];
  inPhysics: boolean;
  aim: AimState | null;
  isAiming: boolean;
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

/**
 * Trajectory preview — a string of translucent glass-marble beads tracing the
 * predicted ground path of the shot (a nod to the real marbles in the original
 * game). Cosmetic only: a damped ballistic projection, not the live physics, so
 * it indicates direction + relative reach rather than the exact landing spot.
 */
function TrajectoryPreview({
  track,
  origin,
  aim,
}: {
  track: Track;
  origin: [number, number, number];
  aim: AimState;
}) {
  const STEPS = 16;
  const DT = 0.09;
  const V0_MAX = 26; // m/s at full power — tuned by feel, not derived.
  const beads: [number, number, number][] = [];
  let px = origin[0];
  let pz = origin[2];
  let vx = aim.dir.x * aim.power * V0_MAX;
  let vz = aim.dir.y * aim.power * V0_MAX;
  for (let i = 0; i < STEPS; i++) {
    vx *= 1 - MARBLE_LINEAR_DAMPING * DT;
    vz *= 1 - MARBLE_LINEAR_DAMPING * DT;
    px += vx * DT;
    pz += vz * DT;
    beads.push([px, heightAt(track, px, pz) + MARBLE_RADIUS * 0.6, pz]);
  }
  return (
    <group>
      {beads.map((p, i) => {
        const f = 1 - i / STEPS; // shrink toward the end
        return (
          <mesh key={i} position={p}>
            <sphereGeometry args={[0.12 + 0.1 * f, 10, 10]} />
            {/* Cheap translucent glass look — avoids a transmission render pass,
                which can lose the WebGL context when stacked with DepthOfField. */}
            <meshStandardMaterial
              color="#3ad17a"
              emissive="#1c8f4e"
              emissiveIntensity={0.4}
              roughness={0.15}
              metalness={0}
              transparent
              opacity={0.4 + 0.4 * f}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

export default function Scene({
  track,
  racers,
  activeId,
  marbleKey,
  trails,
  inPhysics,
  aim,
  isAiming,
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

      {/* Fixed timestep + interpolation → identical marble speed across 60/120/144 Hz
          displays. These are the library defaults, set explicitly to document intent. */}
      <Physics gravity={[0, GRAVITY, 0]} colliders={false} timeStep={1 / 60} interpolate>
        <Terrain track={track} />
        <Rocks3D track={track} />
        <Racers3D
          racers={racers}
          activeId={activeId}
          marbleKey={marbleKey}
          track={track}
          trails={trails}
          impulseRef={impulseRef}
          inPhysics={inPhysics}
          onRacerPos={onRacerPos}
          onSettle={onSettle}
        />
      </Physics>

      {/* ---- Environment planes (visual only, no physics) ---- */}
      {/* Wide beach surround — flat sand at Y=0 so the terrain visibly rises above it */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -4, track.length / 2]} receiveShadow>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color="#e0cc96" roughness={0.95} metalness={0} />
      </mesh>
      {/* Sea plane — dark water on the +X flank (seaward side per cliff logic) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[160, -1.5, track.length / 2]}>
        <planeGeometry args={[300, 600]} />
        <meshStandardMaterial color="#2a7ca8" roughness={0.1} metalness={0.15} transparent opacity={0.82} />
      </mesh>

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

      {/* Aim arrow + glass-bead trajectory preview (slingshot) */}
      {aim && !inPhysics && (
        <>
          <AimArrow origin={aimOrigin} aim={aim} />
          {aim.power > 0.02 && (
            <TrajectoryPreview track={track} origin={aimOrigin} aim={aim} />
          )}
        </>
      )}

      {/* Orbit camera */}
      <OrbitCamera
        target={active ? active.pos : { x: 0, y: track.length / 2 }}
        recenterRef={recenterRef}
        isAiming={isAiming}
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
