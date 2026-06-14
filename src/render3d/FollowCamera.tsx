"use client";
/* eslint-disable react-hooks/immutability -- imperative three.js camera control is the intended R3F pattern */

import { useRef } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import type { Vec3 } from "./coords";

const OFFSET_TIGHT = new THREE.Vector3(6, 9, 11); // aiming: close behind/above
const OFFSET_WIDE = new THREE.Vector3(13, 20, 18); // settled: survey the circuit

/**
 * Camera that eases toward the active racer — tight while aiming, wider when
 * settled — and follows the marble during flight. Adds a decaying shake read
 * from `shakeRef` on impacts.
 */
export default function FollowCamera({
  target,
  tight,
  shakeRef,
}: {
  target: Vec3;
  tight: boolean;
  shakeRef: { current: number };
}) {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3(target[0], target[1], target[2]));
  const ready = useRef(false);

  useFrame(() => {
    const t = new THREE.Vector3(target[0], target[1], target[2]);
    if (!ready.current) {
      look.current.copy(t);
      camera.position.copy(t.clone().add(OFFSET_WIDE));
      ready.current = true;
    }
    look.current.lerp(t, 0.12);
    const desired = t.clone().add(tight ? OFFSET_TIGHT : OFFSET_WIDE);
    camera.position.lerp(desired, 0.07);

    const sh = shakeRef.current;
    if (sh > 0.001) {
      camera.position.x += (Math.random() * 2 - 1) * sh * 0.12;
      camera.position.y += (Math.random() * 2 - 1) * sh * 0.12;
      shakeRef.current = sh * 0.85;
    }
    camera.lookAt(look.current);
  });

  return null;
}
