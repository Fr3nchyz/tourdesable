// Make react-three-fiber's intrinsic elements (<mesh>, <boxGeometry>, ...)
// available to TypeScript's JSX across all components in the project.
import type { ThreeElements } from "@react-three/fiber";

declare module "react" {
  namespace JSX {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface IntrinsicElements extends ThreeElements {}
  }
}
