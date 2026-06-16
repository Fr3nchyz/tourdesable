"use client";

// Importing a type from @react-three/fiber loads its module augmentation,
// which registers the three.js primitives (mesh, boxGeometry, …) onto
// JSX.IntrinsicElements for react/jsx-runtime.
import type { ThreeElements } from "@react-three/fiber";

/** Root group element type, used to make the augmentation import load-bearing. */
type RootProps = ThreeElements["group"];

export interface CyclistProps {
  /** Jersey colour, e.g. "#e63946". */
  color: string;
  /** Optional uniform scale multiplier (default 1). */
  scale?: number;
}

const METAL = "#3a3f45";
const SKIN = "#c79c70";
const TIRE = "#1c1f22";

/**
 * Stylized low-poly cyclist figurine built entirely from three.js primitives.
 * Local space: forward = +X, lowest point at y≈0, ~2 long / ~1.6 tall.
 */
function Cyclist({ color, scale = 1 }: CyclistProps) {
  const wheelR = 0.5;
  const rootProps: RootProps = { scale };

  return (
    <group {...rootProps}>
      {/* ---- Bike wheels (rolling axis along Z) ---- */}
      {([0.85, -0.85] as const).map((x) => (
        <group key={x} position={[x, wheelR, 0]}>
          {/* tyre */}
          <mesh castShadow receiveShadow>
            <torusGeometry args={[wheelR, 0.07, 8, 20]} />
            <meshStandardMaterial color={TIRE} roughness={0.85} />
          </mesh>
          {/* hub */}
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.16, 10]} />
            <meshStandardMaterial color={METAL} roughness={0.4} metalness={0.6} />
          </mesh>
        </group>
      ))}

      {/* ---- Frame (thin metal boxes) ---- */}
      {/* down tube: rear hub up toward head tube */}
      <mesh
        castShadow
        position={[0.05, 0.62, 0]}
        rotation={[0, 0, -0.7]}
      >
        <boxGeometry args={[1.1, 0.06, 0.06]} />
        <meshStandardMaterial color={METAL} roughness={0.4} metalness={0.6} />
      </mesh>
      {/* top tube */}
      <mesh castShadow position={[0.1, 0.95, 0]} rotation={[0, 0, -0.18]}>
        <boxGeometry args={[1.0, 0.06, 0.06]} />
        <meshStandardMaterial color={METAL} roughness={0.4} metalness={0.6} />
      </mesh>
      {/* seat tube */}
      <mesh castShadow position={[-0.45, 0.7, 0]} rotation={[0, 0, 0.18]}>
        <boxGeometry args={[0.06, 0.85, 0.06]} />
        <meshStandardMaterial color={METAL} roughness={0.4} metalness={0.6} />
      </mesh>
      {/* head tube / fork to front wheel */}
      <mesh castShadow position={[0.7, 0.7, 0]} rotation={[0, 0, 0.32]}>
        <boxGeometry args={[0.06, 0.95, 0.06]} />
        <meshStandardMaterial color={METAL} roughness={0.4} metalness={0.6} />
      </mesh>

      {/* saddle */}
      <mesh castShadow receiveShadow position={[-0.5, 1.12, 0]}>
        <boxGeometry args={[0.34, 0.07, 0.18]} />
        <meshStandardMaterial color={TIRE} roughness={0.8} />
      </mesh>

      {/* handlebars (drop bar) */}
      <mesh castShadow position={[0.82, 1.18, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.4, 8]} />
        <meshStandardMaterial color={METAL} roughness={0.4} metalness={0.6} />
      </mesh>

      {/* pedals + crank */}
      <mesh castShadow position={[0.05, 0.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.05, 10]} />
        <meshStandardMaterial color={METAL} roughness={0.4} metalness={0.6} />
      </mesh>

      {/* ====================== RIDER (racing tuck) ====================== */}
      {/* hips / shorts — on saddle */}
      <mesh castShadow position={[-0.42, 0.98, 0]}>
        <sphereGeometry args={[0.24, 12, 10]} />
        <meshStandardMaterial color={TIRE} roughness={0.8} />
      </mesh>

      {/* torso: lean forward (-Z rotation tilts top toward +X / front) */}
      <mesh
        castShadow
        receiveShadow
        position={[0.0, 1.26, 0]}
        rotation={[0, 0, -0.95]}
      >
        <capsuleGeometry args={[0.22, 0.5, 6, 12]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>

      {/* head + helmet, tucked over the bars */}
      <group position={[0.4, 1.55, 0]}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[0.2, 14, 12]} />
          <meshStandardMaterial color={SKIN} roughness={0.7} />
        </mesh>
        {/* helmet cap */}
        <mesh castShadow position={[0, 0.07, 0]}>
          <sphereGeometry
            args={[0.225, 14, 10, 0, Math.PI * 2, 0, Math.PI / 1.7]}
          />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
      </group>

      {/* arms: shoulder [0.38,1.53] → handlebars [0.82,1.18], mirrored on Z */}
      {([0.16, -0.16] as const).map((z) => (
        <mesh
          key={z}
          castShadow
          position={[0.60, 1.355, z]}
          rotation={[0, 0, 0.9]}
        >
          <capsuleGeometry args={[0.06, 0.44, 4, 8]} />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
      ))}

      {/* upper legs: hip → pedal (mirrored on Z) */}
      {([0.13, -0.13] as const).map((z) => (
        <mesh
          key={`thigh-${z}`}
          castShadow
          position={[-0.2, 0.8, z]}
          rotation={[0, 0, -0.7]}
        >
          <capsuleGeometry args={[0.08, 0.45, 4, 8]} />
          <meshStandardMaterial color={TIRE} roughness={0.75} />
        </mesh>
      ))}
      {/* shins */}
      {([0.13, -0.13] as const).map((z) => (
        <mesh
          key={`shin-${z}`}
          castShadow
          position={[0.05, 0.55, z]}
          rotation={[0, 0, 0.35]}
        >
          <capsuleGeometry args={[0.06, 0.4, 4, 8]} />
          <meshStandardMaterial color={SKIN} roughness={0.7} />
        </mesh>
      ))}
      {/* feet / shoes */}
      {([0.13, -0.13] as const).map((z) => (
        <mesh
          key={`foot-${z}`}
          castShadow
          position={[0.22, 0.24, z]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <capsuleGeometry args={[0.055, 0.2, 4, 8]} />
          <meshStandardMaterial color={TIRE} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

export default Cyclist;
