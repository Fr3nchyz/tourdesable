"use client";

// Free-orbit camera backed by drei OrbitControls.
// Accepts a recenterRef: when set true from outside the Canvas, it snaps
// the orbit target to the active marble's ground position.

import { useRef } from "react";
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
}

export default function OrbitCamera({ target, recenterRef }: OrbitCameraProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  useFrame(() => {
    if (recenterRef.current && controlsRef.current) {
      controlsRef.current.target.set(target.x, 0, target.y);
      controlsRef.current.update();
      (recenterRef as React.MutableRefObject<boolean>).current = false;
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.06}
      minDistance={CAM_MIN_DIST}
      maxDistance={CAM_MAX_DIST}
      maxPolarAngle={Math.PI / 2 - 0.04}
    />
  );
}
