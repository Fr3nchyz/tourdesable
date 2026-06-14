"use client";

// Free-orbit camera backed by drei OrbitControls.
// Accepts a recenterRef: when set true from outside the Canvas, it snaps
// the orbit target to the active marble's ground position.

import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Vector2D } from "@/game/types";
import { CAM_MIN_DIST, CAM_MAX_DIST } from "@/game/constants";

interface OrbitCameraProps {
  /** Active marble's ground position (x=worldX, y=worldZ). */
  target: Vector2D;
  /** When .current becomes true, recenter + reset to false. */
  recenterRef: React.RefObject<boolean>;
  /** When true, disable orbit so flick drags don't rotate the camera. */
  isAiming: boolean;
}

const PAN_SPEED = 0.5;
const ARROW_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

export default function OrbitCamera({ target, recenterRef, isAiming }: OrbitCameraProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const keysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (ARROW_KEYS.has(e.key)) { e.preventDefault(); keysRef.current.add(e.key); }
    };
    const onUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, []);

  useFrame(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;

    if (recenterRef.current) {
      const tx = target.x;
      const tz = target.y;
      ctrl.target.set(tx, 0, tz);
      // Reset camera to a clean elevated view above and slightly behind the marble.
      ctrl.object.position.set(tx, 16, tz - 28);
      ctrl.update();
      (recenterRef as React.MutableRefObject<boolean>).current = false;
    }

    const keys = keysRef.current;
    if (keys.size > 0) {
      let dx = 0, dz = 0;
      if (keys.has("ArrowLeft"))  dx =  PAN_SPEED;
      if (keys.has("ArrowRight")) dx = -PAN_SPEED;
      if (keys.has("ArrowUp"))    dz =  PAN_SPEED;
      if (keys.has("ArrowDown"))  dz = -PAN_SPEED;
      // Slide both target and camera body so the whole view translates.
      ctrl.target.x += dx; ctrl.target.z += dz;
      ctrl.object.position.x += dx; ctrl.object.position.z += dz;
      ctrl.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enabled={!isAiming}
      enableDamping
      dampingFactor={0.06}
      minDistance={CAM_MIN_DIST}
      maxDistance={CAM_MAX_DIST}
      maxPolarAngle={Math.PI / 2 - 0.04}
    />
  );
}
