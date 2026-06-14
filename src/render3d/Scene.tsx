"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { EffectComposer, DepthOfField, Vignette } from "@react-three/postprocessing";
import type { Track, Racer, Vector2D } from "@/game/types";
import {
  MARBLE_RADIUS,
  WORLD_SCALE,
  MAX_DRAG_DISTANCE,
} from "@/game/constants";
import { boardToWorld, worldToBoard, type Vec3 } from "./coords";
import SandGround from "./SandGround";
import TrackBerms from "./TrackBerms";
import Obstacles3D from "./Obstacles3D";
import Racers3D from "./Racers3D";
import FollowCamera from "./FollowCamera";

const R = MARBLE_RADIUS * WORLD_SCALE;
const POST = true; // tilt-shift depth-of-field + vignette

export interface AimState {
  dir: Vector2D; // unit, board space
  power: number; // 0..1
}

export interface SceneProps {
  track: Track;
  racers: Racer[];
  activeId: string;
  /** True while the human is aiming (camera tightens). */
  tight: boolean;
  aim: AimState | null;
  shakeRef: { current: number };
  onAimDown: (board: Vector2D) => void;
  onAimMove: (board: Vector2D) => void;
  onAimUp: (board: Vector2D) => void;
}

/** Aim arrow drawn on the ground from the active marble. */
function AimArrow({ origin, aim }: { origin: Vec3; aim: AimState }) {
  const len = aim.power * MAX_DRAG_DISTANCE * WORLD_SCALE;
  const heading = Math.atan2(-aim.dir.y, aim.dir.x);
  const color = aim.power > 0.8 ? "#e63946" : aim.power > 0.5 ? "#f4a261" : "#2a9d8f";
  return (
    <group position={[origin[0], 0.15, origin[2]]} rotation={[0, heading, 0]}>
      <mesh position={[len / 2, 0, 0]}>
        <boxGeometry args={[len, 0.06, 0.5]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>
      <mesh position={[len, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.6, 1.1, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

export default function Scene({
  track,
  racers,
  activeId,
  tight,
  aim,
  shakeRef,
  onAimDown,
  onAimMove,
  onAimUp,
}: SceneProps) {
  const active = racers.find((r) => r.id === activeId);
  const activeWorld: Vec3 = active
    ? boardToWorld(active.pos, track, R)
    : [0, 0, 0];

  const toBoard = (e: ThreeEvent<PointerEvent>): Vector2D =>
    worldToBoard(e.point.x, e.point.z, track);

  return (
    <>
      <color attach="background" args={["#bcdce8"]} />
      <fog attach="fog" args={["#bcdce8", 60, 160]} />

      <hemisphereLight args={["#fff7e6", "#9a7b4f", 0.6]} />
      <directionalLight
        position={[24, 34, 12]}
        intensity={1.6}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-camera-near={1}
        shadow-camera-far={120}
        shadow-bias={-0.0004}
      />

      <SandGround />
      <TrackBerms track={track} />
      <Obstacles3D track={track} />
      <Racers3D racers={racers} activeId={activeId} track={track} />
      {aim && active && <AimArrow origin={activeWorld} aim={aim} />}

      <FollowCamera target={activeWorld} tight={tight} shakeRef={shakeRef} />

      {/* Invisible ground plane that captures pointer rays for flick input. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        onPointerDown={(e) => {
          e.stopPropagation();
          (e.target as Element).setPointerCapture?.(e.pointerId);
          onAimDown(toBoard(e));
        }}
        onPointerMove={(e) => onAimMove(toBoard(e))}
        onPointerUp={(e) => {
          (e.target as Element).releasePointerCapture?.(e.pointerId);
          onAimUp(toBoard(e));
        }}
      >
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {POST && (
        <EffectComposer>
          <DepthOfField focusDistance={0.012} focalLength={0.04} bokehScale={3.2} />
          <Vignette eskil={false} offset={0.25} darkness={0.7} />
        </EffectComposer>
      )}
    </>
  );
}
