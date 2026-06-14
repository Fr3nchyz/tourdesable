// ============================================================================
// tour-de-sable — physics & gameplay tuning constants
// Centralised so game feel can be tuned in one place.
// ============================================================================

// --- Board ---
export const BOARD_WIDTH = 900;
export const BOARD_HEIGHT = 1400;

// --- Marble ---
export const MARBLE_RADIUS = 16;
export const MARBLE_MASS = 1;

// --- Friction (per-frame velocity drain: v *= (1 - coeff)) ---
/** Baseline soft-sand rolling resistance in the racing lane. Heavy by design. */
export const BASE_FRICTION = 0.03;
/** Dry sand shoulder: 2x baseline (rapid speed drain). */
export const SHOULDER_FRICTION = BASE_FRICTION * 2;
/** Kelp: 10x baseline (effective instant stop on contact). */
export const KELP_FRICTION = BASE_FRICTION * 10;
/** Waterlogged sand after a wave: near-zero (hydroplane). */
export const WATERLOGGED_FRICTION = 0.003;

/** A marble is considered stopped below this speed. */
export const STOP_THRESHOLD = 0.05;

// --- Ripples ---
/** Angular tolerance (radians) for "moving with" the ripple direction. */
export const RIPPLE_ALIGN_TOLERANCE = Math.PI / 6; // 30deg
/** Moving with the ripple: -15% drag (acts as +15% acceleration aid). */
export const RIPPLE_WITH_DRAG_MULT = 0.85;
/** Moving against/across: +20% drag penalty. */
export const RIPPLE_AGAINST_DRAG_MULT = 1.2;
/** Micro-bounce wobble when crossing ripples, applied as a small heading
 *  rotation (radians) so it perturbs trajectory without adding energy. */
export const RIPPLE_WOBBLE = 0.08;

// --- Launch ---
/** Max impulse speed at 100% power (px/frame). */
export const MAX_LAUNCH_SPEED = 22;
/** Max drag distance (px) that maps to 100% power. */
export const MAX_DRAG_DISTANCE = 220;

// --- Collision: Pocket-Stealer Shunt ---
/** Fraction of incoming velocity transferred to the struck marble. */
export const SHUNT_TRANSFER = 0.7;

// --- Rogue wave ---
/** Wave checks begin at this round. */
export const WAVE_START_ROUND = 3;
/** Flat per-round trigger chance once eligible. */
export const WAVE_CHANCE = 0.2;
/** Fraction of board height (from bottom) the wave/aftermath covers. */
export const WAVE_ZONE_FRACTION = 0.4;
/** Pixels a caught marble is pushed back (toward start = +y). */
export const WAVE_PUSHBACK = 100;
/** Complete rounds the waterlogged aftermath persists. */
export const WAVE_AFTERMATH_ROUNDS = 2;
/** Temporary obstacles spawned in the aftermath zone. */
export const WAVE_AFTERMATH_OBSTACLES = 3;

// --- Particles / effects ---
export const SAND_BURST_MIN = 8;
export const SAND_BURST_MAX = 12;
export const SCREEN_SHAKE_PX = 2;

// --- Racer roster ---
export const RACER_COUNT = 4; // 1 human + 3 bots
export const RACER_COLORS = ["#e63946", "#457b9d", "#f4a261", "#2a9d8f"];
