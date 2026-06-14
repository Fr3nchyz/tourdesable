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
  /** Cached progress for standings ordering = lap + loopT. */
  progress: number;
  /** Completed laps. */
  lap: number;
  /** Current parameter position along the loop, t in [0,1). */
  loopT: number;
  /** True once the racer has passed the half-way point this lap (anti-cheese). */
  passedHalf: boolean;
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
 * Dug circuit: a closed loop (ring) carved into the sand. Racers flick their
 * marbles around the channel between the inner and outer LOW berm banks. The
 * centerline `loop` is a closed polyline (loop[last] connects back to loop[0]);
 * `cumLen[i]` is the arc length up to vertex i, `loopLength` the total. Lane /
 * shoulder bands and the berm are measured by lateral offset from the loop.
 * The finish line sits at loop param t = 0 (loop[0]); racing goes in the
 * direction of increasing vertex index (increasing t).
 */
export interface Track {
  seed: number;
  width: number;
  height: number;
  /** Closed centerline ring (not repeated: loop[n-1] -> loop[0] closes it). */
  loop: Vector2D[];
  /** Cumulative arc length to each vertex; cumLen[0] = 0. */
  cumLen: number[];
  /** Total loop arc length. */
  loopLength: number;
  /** Half-width of the optimal racing lane around the centerline. */
  laneHalfWidth: number;
  /** Half-width of the full drivable channel; beyond = low berm bank. */
  trackHalfWidth: number;
  /** Spawn points for up to 4 racers (just past the finish line). */
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
