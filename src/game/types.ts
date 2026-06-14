// ============================================================================
// tour-de-sable — core types (v3: A→B coastal courses, Rapier physics)
// Ground positions use Vector2D where x = world X (across) and y = world Z
// (along the course, start→finish). Height (world Y) lives in the physics body.
// ============================================================================

/** Ground-plane point: x = world X, y = world Z. */
export interface Vector2D {
  x: number;
  y: number;
}

// --- State machine ---
export type Phase =
  | "LOBBY_VOTE"
  | "INITIALIZATION"
  | "TURN_CYCLE"
  | "ROUND_END"
  | "VICTORY";

export type TurnSubPhase = "INPUT" | "PHYSICS" | "RESOLUTION";

// --- Racers ---
export type BotType =
  | "bully"
  | "sniper"
  | "beachcomber"
  | "navigator"
  | "coastglider"
  | "daredevil";

export type RacerState = "idle" | "moving" | "stopped" | "tipped" | "finished";

export interface Racer {
  id: string;
  name: string;
  isHuman: boolean;
  botType?: BotType;
  /** Ground position (x = world X, y = world Z). Synced from the physics body. */
  pos: Vector2D;
  color: string;
  state: RacerState;
  /** Tipped marbles miss their next turn. */
  skipNextTurn: boolean;
  /** Last in-bounds ground position — respawn anchor after falling off. */
  lastInBoundsPos: Vector2D;
  /** Progress toward the finish along the course path, 0..1. */
  progress: number;
  /** Set when finishing; lower = earlier. */
  finishedRank?: number;
}

// --- Course ---
import type { Theme } from "./constants";

/** Fixed rock / cliff obstacle (cylinder-ish collider). */
export interface Rock {
  pos: Vector2D;
  radius: number;
  height: number;
}

/** Parameters that drive the deterministic terrain height sampler. */
export interface ElevationField {
  theme: Theme;
  seed: number;
  /** Overall dune amplitude (metres). */
  amp: number;
  /** Spatial frequency of the dunes. */
  freq: number;
  /** Extra cliff amplitude on the seaward side (metres). */
  cliffAmp: number;
  /** Net rise from start to finish (metres). */
  slope: number;
}

/** An A→B coastal course. World units (metres). */
export interface Track {
  seed: number;
  theme: Theme;
  name: string;
  /** Extent along X (across the beach). */
  width: number;
  /** Extent along Z (start→finish). */
  length: number;
  start: Vector2D;
  finish: Vector2D;
  finishRadius: number;
  /** Centerline waypoints from start→finish (for AI + progress + direction arrow). */
  path: Vector2D[];
  /** Spawn points on the start line. */
  startGrid: Vector2D[];
  rocks: Rock[];
  /** Marbles below this world Y have fallen into the sea. */
  seaLevelY: number;
  elevation: ElevationField;
}

// --- Input ---
export interface Launch {
  dir: Vector2D; // unit (ground)
  power: number; // 0..1
}

// --- Game state ---
export interface GameState {
  phase: Phase;
  turnSubPhase: TurnSubPhase;
  track: Track | null;
  lobbyTracks: Track[];
  racers: Racer[];
  activeTurn: number;
  turnOrder: string[];
  round: number;
  winnerId: string | null;
  seed: number;
  finishedCount: number;
}
