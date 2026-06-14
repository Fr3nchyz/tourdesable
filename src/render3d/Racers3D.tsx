"use client";

// ============================================================================
// Racers3D — renders every racer in the scene.
//
// Active racer  → Rapier <RigidBody> marble.  Consumes the pending impulse
//                 from impulseRef on the first physics frame, then polls
//                 velocity for settle detection.
// Idle racers   → Cyclist figurines placed on the terrain surface.
// ============================================================================

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CylinderCollider, BallCollider } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import type { Racer, Track, TrailSegment, Vector2D } from "@/game/types";
import { heightAt } from "@/game/track";
import { surfaceAt } from "@/game/surface";
import Cyclist from "./Cyclist";
import {
  MARBLE_RADIUS,
  MARBLE_LINEAR_DAMPING,
  MARBLE_ANGULAR_DAMPING,
  MARBLE_FRICTION,
  MARBLE_RESTITUTION,
  SLEEP_SPEED,
  SETTLE_FRAMES,
  MAX_SETTLE_MS,
} from "@/game/constants";

export interface Impulse3D {
  x: number;
  y: number;
  z: number;
}

// ---------------------------------------------------------------------------
// Active marble (Rapier RigidBody)
// ---------------------------------------------------------------------------

interface ActiveMarbleProps {
  racer: Racer;
  track: Track;
  trails: TrailSegment[];
  impulseRef: React.RefObject<Impulse3D | null>;
  inPhysics: boolean;
  onRacerPos: (
    id: string,
    wx: number,
    wy: number,
    wz: number,
  ) => "finish" | "offcourse" | "ok";
  onSettle: (carvedPath: Vector2D[]) => void;
}

function ActiveMarble({
  racer,
  track,
  trails,
  impulseRef,
  inPhysics,
  onRacerPos,
  onSettle,
}: ActiveMarbleProps) {
  const rbRef = useRef<RapierRigidBody>(null);
  const settleCount = useRef(0);
  const settleStart = useRef(0);
  const firedSettle = useRef(false);
  const impulseConsumed = useRef(false);
  const carved = useRef<Vector2D[]>([]);

  useFrame(() => {
    const rb = rbRef.current;
    if (!rb || !inPhysics || firedSettle.current) return;

    // Consume the pending impulse on the first physics frame.
    if (impulseRef.current !== null && !impulseConsumed.current) {
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
      rb.applyImpulse(impulseRef.current, true);
      (impulseRef as React.MutableRefObject<Impulse3D | null>).current = null;
      impulseConsumed.current = true;
      settleStart.current = Date.now();
      settleCount.current = 0;
      carved.current = [];
      return; // give Rapier one frame before we start reading velocity
    }

    if (!impulseConsumed.current) return;

    const pos = rb.translation();
    const vel = rb.linvel();
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);

    // Surface displacement: material damping + grain variance + sink-to-stop +
    // trail fast-lane + grain/camber lateral. Sampled at the marble's ground
    // position and pushed into the Rapier body each frame.
    const sample = surfaceAt(
      track,
      trails,
      { x: pos.x, y: pos.z },
      { x: vel.x, y: vel.z },
    );
    rb.setLinearDamping(sample.damping);
    if (sample.lateral.x !== 0 || sample.lateral.y !== 0) {
      rb.applyImpulse({ x: sample.lateral.x, y: 0, z: sample.lateral.y }, true);
    }

    // Record the carved path (for the persistent deformation layer).
    carved.current.push({ x: pos.x, y: pos.z });

    const result = onRacerPos(racer.id, pos.x, pos.y, pos.z);
    if (result !== "ok") {
      firedSettle.current = true;
      onSettle(carved.current);
      return;
    }

    if (speed < SLEEP_SPEED) {
      settleCount.current++;
    } else {
      settleCount.current = 0;
    }

    const elapsed = Date.now() - settleStart.current;
    if (settleCount.current >= SETTLE_FRAMES || elapsed >= MAX_SETTLE_MS) {
      firedSettle.current = true;
      onSettle(carved.current);
    }
  });

  const spawnX = racer.pos.x;
  const spawnZ = racer.pos.y; // racer.pos.y = world Z
  const spawnY = heightAt(track, spawnX, spawnZ) + MARBLE_RADIUS + 0.1;

  return (
    <RigidBody
      ref={rbRef}
      colliders={false}
      position={[spawnX, spawnY, spawnZ]}
      linearDamping={MARBLE_LINEAR_DAMPING}
      angularDamping={MARBLE_ANGULAR_DAMPING}
      friction={MARBLE_FRICTION}
      restitution={MARBLE_RESTITUTION}
    >
      <BallCollider args={[MARBLE_RADIUS]} />
      <group
        position={[0, -MARBLE_RADIUS + 0.05, 0]}
        rotation={[0, facingFinish(racer.pos, track.finish), 0]}
        scale={0.9}
      >
        <Cyclist color={racer.color} />
      </group>
    </RigidBody>
  );
}

// ---------------------------------------------------------------------------
// Idle racer (Cyclist figurine)
// ---------------------------------------------------------------------------

/** Heading rotation about Y so the figurine faces toward the finish. */
function facingFinish(pos: Vector2D, finish: Vector2D): number {
  const dx = finish.x - pos.x;
  const dz = finish.y - pos.y;
  return Math.atan2(-dz, dx);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface Racers3DProps {
  racers: Racer[];
  activeId: string;
  marbleKey: string;
  track: Track;
  trails: TrailSegment[];
  impulseRef: React.RefObject<Impulse3D | null>;
  inPhysics: boolean;
  onRacerPos: (
    id: string,
    wx: number,
    wy: number,
    wz: number,
  ) => "finish" | "offcourse" | "ok";
  onSettle: (carvedPath: Vector2D[]) => void;
}

export default function Racers3D({
  racers,
  activeId,
  marbleKey,
  track,
  trails,
  impulseRef,
  inPhysics,
  onRacerPos,
  onSettle,
}: Racers3DProps) {
  const active = racers.find((r) => r.id === activeId);

  return (
    <group>
      {/* Active racer: remounts on every turn via marbleKey (round+activeTurn),
          ensuring fresh Rapier body and reset refs each shot. */}
      {active && (
        <ActiveMarble
          key={marbleKey}
          racer={active}
          track={track}
          trails={trails}
          impulseRef={impulseRef}
          inPhysics={inPhysics}
          onRacerPos={onRacerPos}
          onSettle={onSettle}
        />
      )}

      {/* Idle racers: Cyclist figurines with physics cylinders so the marble collides. */}
      {racers
        .filter((r) => r.id !== activeId && r.state !== "finished")
        .map((r) => {
          const x = r.pos.x;
          const z = r.pos.y;
          const y = heightAt(track, x, z);
          return (
            <group key={r.id}>
              {/* Collision body — remounts when the racer moves to a new position */}
              <RigidBody
                key={`col-${r.id}-${x.toFixed(1)}-${z.toFixed(1)}`}
                type="fixed"
                position={[x, y + 0.9, z]}
                colliders={false}
              >
                <CylinderCollider args={[0.85, 0.42]} />
              </RigidBody>
              {/* Visual */}
              <group
                position={[x, y, z]}
                rotation={[0, facingFinish(r.pos, track.finish), 0]}
                scale={r.state === "tipped" ? 0.85 : 0.9}
              >
                <Cyclist color={r.color} />
              </group>
            </group>
          );
        })}
    </group>
  );
}
