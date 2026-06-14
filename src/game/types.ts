// ============================================================================
// tour-de-sable — core type definitions
// All game state is described here. These types are pure (no DOM) so the whole
// simulation can run + be unit-tested headless.
// ============================================================================

/** 2D vector. Used for positions, velocities, directions. */
export interface Vector2D {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// State machine phases
// ---------------------------------------------------------------------------

/** Top-level game phases (rigid sequential state machine). */
export type Phase =
  | "LOBBY_VOTE"
  | "INITIALIZATION"
  | "TURN_CYCLE"
  | "ROUND_END"
  | "VICTORY";

/** Sub-phases within a single racer's turn. */
export type TurnSubPhase = "INPUT" | "PHYSICS" | "RESOLUTION";

// ---------------------------------------------------------------------------
// Racers
// ---------------------------------------------------------------------------

/** The six AI personality archetypes. */
export type BotType =
  | "bully"
  | "sniper"
  | "beachcomber"
  | "navigator"
  | "coastglider"
  | "daredevil";

/** Lifecycle state of a marble. */
export type RacerState = "idle" | "moving" | "stopped" | "tipped" | "finished";

export interface Racer {
  id: string;
  name: string;
  isHuman: boolean;
  botType?: BotType;
  pos: Vector2D;
  vel: Vector2D;
  radius: number;
  mass: number;
  color: string;
  state: RacerState;
  /** Tipped marbles miss their next turn. */
  skipNextTurn: boolean;
  /** Last position recorded while in-bounds — respawn anchor after tipping. */
  lastInBoundsPos: Vector2D;
  /** Cached progress toward finish (higher = closer). */
  progress: number;
  /** Set when crossing finish; lower = earlier. */
  finishedRank?: number;
}

// ---------------------------------------------------------------------------
// Obstacles (discriminated union)
// ---------------------------------------------------------------------------

/** Driftwood: hard elastic rectangle, marbles bounce cleanly. */
export interface RectObstacle {
  kind: "driftwood";
  pos: Vector2D; // center
  halfW: number;
  halfH: number;
  angle: number; // radians
}

/** Kelp / clam shell: circular extreme-drag zone. */
export interface CircleObstacle {
  kind: "kelp" | "clamshell";
  pos: Vector2D;
  radius: number;
  /** Wave-spawned obstacles are removed when aftermath ends. */
  temporary?: boolean;
}

export type Obstacle = RectObstacle | CircleObstacle;

// ---------------------------------------------------------------------------
// Track
// ---------------------------------------------------------------------------

/** Visual + mechanical wind-swept ripple field across the sand. */
export interface RippleField {
  /** Direction the ripple lines run (radians). */
  angle: number;
  /** Visual spacing between ripple lines (px). */
  spacing: number;
}

/**
 * Linear A->B corridor. Start grid sits near the bottom (high y), finish line
 * near the top (low y). Racing goes "up" (decreasing y). The centerline is a
 * series of waypoints so the corridor can gently wander while staying linear
 * (no loop). Lane / shoulder / out-of-bounds are bands measured from the
 * centerline at the marble's y.
 */
export interface Track {
  seed: number;
  width: number;
  height: number;
  /** Waypoints from start (bottom) to finish (top). */
  centerline: Vector2D[];
  /** Half-width of the optimal racing lane around the centerline. */
  laneHalfWidth: number;
  /** Half-width of the full corridor; beyond this is out-of-bounds. */
  corridorHalfWidth: number;
  /** y coordinate of the finish line. */
  finishY: number;
  /** Spawn points for up to 4 racers. */
  startGrid: Vector2D[];
  obstacles: Obstacle[];
  ripple: RippleField;
}

// ---------------------------------------------------------------------------
// Friction zones
// ---------------------------------------------------------------------------

/** Terrain classification at a point, drives the friction coefficient. */
export type Zone = "lane" | "shoulder" | "kelp" | "waterlogged" | "out";

// ---------------------------------------------------------------------------
// Rogue wave
// ---------------------------------------------------------------------------

export type WavePhase = "none" | "warning" | "impact" | "aftermath";

export interface WaveState {
  phase: WavePhase;
  /** Remaining complete rounds the waterlogged aftermath persists. */
  aftermathRoundsLeft: number;
  /** Top y of the affected lower zone (lower 40% => 0.6 * height). */
  zoneTopY: number;
}

// ---------------------------------------------------------------------------
// Launch input
// ---------------------------------------------------------------------------

/** A computed/launched shot: direction (unit) * power (0..1). */
export interface Launch {
  dir: Vector2D; // unit vector
  power: number; // 0..1
}

// ---------------------------------------------------------------------------
// Full game state
// ---------------------------------------------------------------------------

export interface GameState {
  phase: Phase;
  turnSubPhase: TurnSubPhase;
  track: Track | null;
  /** Three generated options shown in the lobby. */
  lobbyTracks: Track[];
  racers: Racer[];
  /** Index into turnOrder of the racer currently acting. */
  activeTurn: number;
  /** Racer ids in turn order. */
  turnOrder: string[];
  round: number;
  wave: WaveState;
  winnerId: string | null;
  /** Master seed; drives deterministic wave rolls + AI jitter. */
  seed: number;
  /** Count of racers that have finished (for ranking). */
  finishedCount: number;
}
