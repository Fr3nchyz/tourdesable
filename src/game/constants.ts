// ============================================================================
// tour-de-sable — tuning constants (v3: real Rapier physics, A→B coastal courses)
// The world is in metres. The course runs along +Z (start near z=0, finish near
// z=COURSE_LENGTH); width is along X; +Y is up.
// ============================================================================

// --- Racer roster ---
export const RACER_COUNT = 4; // 1 human + 3 bots
export const RACER_COLORS = ["#e63946", "#457b9d", "#f4a261", "#2a9d8f"];

// --- Marble (rigid body) ---
export const MARBLE_RADIUS = 0.8;
/** Sand drag: heavy linear/angular damping so marbles roll then settle. */
export const MARBLE_LINEAR_DAMPING = 1.7;
export const MARBLE_ANGULAR_DAMPING = 1.6;
export const MARBLE_FRICTION = 0.9;
export const MARBLE_RESTITUTION = 0.35;

// --- Flick / launch ---
/** Impulse magnitude at 100% power. */
export const MAX_IMPULSE = 9;
/** Drag distance (world metres) that maps to 100% power. */
export const MAX_DRAG_WORLD = 12;

// --- Turn resolution ---
/** Below this speed (m/s) a marble counts as at rest. */
export const SLEEP_SPEED = 0.18;
/** Consecutive settled frames required before the turn resolves. */
export const SETTLE_FRAMES = 14;
/** Hard cap on a single shot's simulation before forcing a settle (ms). */
export const MAX_SETTLE_MS = 7000;

// --- Physics world ---
/** Gentle gravity: slopes influence the marble, damping prevents runaway. */
export const GRAVITY = -7;

// --- Surface displacement engine (material-driven sand feel) ---
// surface.ts samples these each frame and pushes effective damping / lateral
// force into the Rapier body. baseFriction ≈ the old MARBLE_LINEAR_DAMPING, so
// behaviour is preserved when grain / trails / sink contribute nothing.
import type { SurfaceMaterial } from "./types";

/** Dry beach sand (Blancs-Sablons primary). */
export const SAND_MATERIAL: SurfaceMaterial = {
  baseFriction: 1.7,
  grainResistance: 0.5,
  deformationFactor: 0.5,
};

/** "Sink-to-stop": extra damping added as speed→0 (the settling "thud"). */
export const SINK_GAIN = 2.6;
/** Speed (m/s) e-fold of the sink ramp — smaller = thud closer to rest. */
export const SINK_SCALE = 1.1;
/** Half-width (m) of the cambered racing lane; |x| beyond this is shoulder. */
export const LANE_HALF_WIDTH = 9;

// Grain variance: low-frequency Perlin noise so no two patches feel identical.
/** Spatial frequency of the grain noise (cycles per metre). */
export const GRAIN_FREQ = 0.09;
/** Lateral micro-wobble force scale (× speed) from the grain field. */
export const WOBBLE_GAIN = 0.05;
/** Below this speed (m/s) grain wobble is suppressed (settle-safe). */
export const WOBBLE_MIN_SPEED = 0.45;

// Deformation trails ("persistent layer"): carved channels = temporary fast lanes.
/** Turns a carved channel persists before filling back in. */
export const TRAIL_LIFETIME = 4;
/** Half-width (m) of a carved channel's fast lane. */
export const TRAIL_WIDTH = 1.6;

// --- Course (metres) ---
export const COURSE_WIDTH = 44;
export const COURSE_LENGTH = 92;
/** Distance from the finish point that counts as crossing the line. */
export const FINISH_RADIUS = 4.5;
/** Marbles below this Y have fallen off the coast (into the sea) → reset. */
export const SEA_LEVEL_Y = -3;

// --- Camera ---
export const CAM_MIN_DIST = 6;
export const CAM_MAX_DIST = 60;

// --- Effects ---
export const SAND_BURST_MIN = 8;
export const SAND_BURST_MAX = 14;

// --- Map themes ---
export const THEMES = ["blancs-sablons", "le-minou", "bertheaume"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_NAMES: Record<Theme, string> = {
  "blancs-sablons": "Les Blancs-Sablons",
  "le-minou": "Le Minou",
  bertheaume: "Bertheaume",
};
