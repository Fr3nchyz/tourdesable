// ============================================================================
// tour-de-sable — tuning constants (v3: real Rapier physics, A→B coastal courses)
// The world is in metres. The course runs along +Z (start near z=0, finish near
// z=COURSE_LENGTH); width is along X; +Y is up.
// ============================================================================

// --- Racer roster ---
export const RACER_COUNT = 4; // 1 human + 3 bots
export const RACER_COLORS = ["#e63946", "#457b9d", "#f4a261", "#2a9d8f"];

// --- Marble (rigid body) ---
export const MARBLE_RADIUS = 0.45;
/** Sand drag: linear damping so marbles roll then settle. */
export const MARBLE_LINEAR_DAMPING = 0.7;
export const MARBLE_ANGULAR_DAMPING = 0.7;
export const MARBLE_FRICTION = 0.95;
export const MARBLE_RESTITUTION = 0.08;
/** Extra downward force (N/step) keeping the marble pressed into terrain contours.
 * Higher = the marble stays glued through residual swells instead of taking air. */
export const MARBLE_DOWNFORCE = 11.0;

// --- Flick / launch ---
/** Impulse magnitude at 100% power. */
export const MAX_IMPULSE = 17;
/** Drag distance (world metres) that maps to 100% power. */
export const MAX_DRAG_WORLD = 12;

// --- Turn resolution ---
/** Below this speed (m/s) a marble counts as at rest. */
export const SLEEP_SPEED = 0.18;
/** Consecutive settled frames required before the turn resolves. */
export const SETTLE_FRAMES = 14;
/** After this many consecutive slow frames, actively bleed off the marble's
 * residual creep (zero its velocity) so it parks cleanly instead of gliding /
 * "recalculating" around the rest threshold. */
export const SETTLE_PARK_FRAMES = 5;
/** Hard cap on a single shot's simulation before forcing a settle (ms). */
export const MAX_SETTLE_MS = 7000;

// --- Physics world ---
/** Gentle gravity: slopes influence the marble, damping prevents runaway. */
export const GRAVITY = -20;

// --- Surface displacement engine (material-driven sand feel) ---
// surface.ts samples these each frame and pushes effective damping / lateral
// force into the Rapier body. baseFriction ≈ the old MARBLE_LINEAR_DAMPING, so
// behaviour is preserved when grain / trails / sink contribute nothing.
import type { SurfaceMaterial, Zone } from "./types";

/** Dry beach sand (Blancs-Sablons primary) — the carved racing channel. */
export const SAND_MATERIAL: SurfaceMaterial = {
  baseFriction: 0.7,
  grainResistance: 0.4,
  deformationFactor: 0.5,
};

// --- Coastal geology zones (B3) ---
// Beyond the carved channel the sand is loose and draggy; close to rocks the
// ground is hard granite — slick and skittish. zoneAt() in surface.ts classifies
// each ground patch, and ZONE_MATERIAL / ZONE_FRICTION turn that into feel.

/** Loose pushed-up berm sand: high drag punishes lines that stray off the channel. */
export const LOOSE_SAND_BERM_MATERIAL: SurfaceMaterial = {
  baseFriction: 1.4,
  grainResistance: 0.5,
  deformationFactor: 0.2,
};

/** Granite apron around rocks: hard, slick, low drag, does not hold a carve. */
export const GRANITE_ROCK_MATERIAL: SurfaceMaterial = {
  baseFriction: 0.28,
  grainResistance: 0.12,
  deformationFactor: 0,
};

export const ZONE_MATERIAL: Record<Zone, SurfaceMaterial> = {
  sand: SAND_MATERIAL,
  loose_sand_berm: LOOSE_SAND_BERM_MATERIAL,
  granite_rock: GRANITE_ROCK_MATERIAL,
};

/** Collider grip (Rapier friction) per zone — granite is slick, berm grabby. */
export const ZONE_FRICTION: Record<Zone, number> = {
  sand: 0.9,
  loose_sand_berm: 1.0,
  granite_rock: 0.3,
};

/** Extra radius (m) of the hard granite apron beyond a rock's footprint. */
export const GRANITE_MARGIN = 0.9;

/** "Sink-to-stop": extra damping added as speed→0 (the settling "thud"). */
export const SINK_GAIN = 1.0;
/** Speed (m/s) e-fold of the sink ramp — larger = the damping rises smoothly over
 * a wider speed band instead of spiking right at rest (which made the marble
 * oscillate around the settle threshold). */
export const SINK_SCALE = 2.0;
/** Half-width (m) of the cambered racing lane; |x| beyond this is shoulder. */
export const LANE_HALF_WIDTH = 5;

// Grain variance: low-frequency Perlin noise so no two patches feel identical.
/** Spatial frequency of the grain noise (cycles per metre). */
export const GRAIN_FREQ = 0.09;
/** Lateral micro-wobble force scale (× speed) from the grain field. */
export const WOBBLE_GAIN = 0.008;
/** Below this speed (m/s) grain wobble is suppressed (settle-safe). */
export const WOBBLE_MIN_SPEED = 0.45;

// Deformation trails ("persistent layer"): carved channels = temporary fast lanes.
/** Turns a carved channel persists before filling back in. */
export const TRAIL_LIFETIME = 4;
/** Half-width (m) of a carved channel's fast lane. */
export const TRAIL_WIDTH = 1.6;

// Camber: the lane crowns at the centre, so an imprecise launch drifts to a
// shoulder. Modelled as a speed-scaled lateral force ∝ offset from lane centre.
/** Lateral camber force scale (× normalised offset × speed). */
export const CAMBER_GAIN = 0;
/** Below this speed (m/s) camber is suppressed (settle-safe). */
export const CAMBER_MIN_SPEED = 0.3;

// Launch "tension": the aim arrow strains (jitters) as power approaches max.
/** Aim power above which the arrow visibly jitters. */
export const TENSION_THRESHOLD = 0.82;
/** Peak jitter amplitude (world m) at full power. */
export const TENSION_JITTER = 0.14;

// --- Course (metres) ---
// Wide beach so the carved channel can carve genuine 40–55° sweeping turns
// (the path swings up to ±14m); the channel itself stays ~5m, a ribbon winding
// across the open sand.
export const COURSE_WIDTH = 40;
export const COURSE_LENGTH = 190;
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
export const THEMES = ["trez-hir", "le-minou", "bertheaume"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_NAMES: Record<Theme, string> = {
  "trez-hir": "Trez-Hir",
  "le-minou": "Le Minou",
  bertheaume: "Bertheaume",
};
