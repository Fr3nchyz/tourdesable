"use client";

// Rock cylinder colliders + visual meshes placed on the terrain surface.

import { RigidBody, CylinderCollider } from "@react-three/rapier";
import type { Track } from "@/game/types";
import { heightAt } from "@/game/track";

export default function Rocks3D({ track }: { track: Track }) {
  return (
    <>
      {track.rocks.map((rock, i) => {
        const x = rock.pos.x;
        const z = rock.pos.y; // pos.y = world Z (course direction)
        const baseY = heightAt(track, x, z);
        const halfH = rock.height / 2;

        return (
          <RigidBody key={i} type="fixed" position={[x, baseY + halfH, z]}>
            <CylinderCollider args={[halfH, rock.radius]} />
            <mesh castShadow receiveShadow>
              <cylinderGeometry
                args={[rock.radius * 0.75, rock.radius, rock.height, 8]}
              />
              <meshStandardMaterial color="#7a7065" roughness={0.92} metalness={0} />
            </mesh>
          </RigidBody>
        );
      })}
    </>
  );
}
