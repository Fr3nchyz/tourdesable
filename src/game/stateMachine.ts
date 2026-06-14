// ============================================================================
// tour-de-sable — phase transitions + turn sequencing (v3)
// LOBBY_VOTE → INITIALIZATION → TURN_CYCLE → ROUND_END → VICTORY
// ============================================================================

import type { GameState, Racer, Track, BotType } from "./types";
import { generateTrack, progressAlongPath } from "./track";
import { mulberry32, randInt, shuffle } from "./rng";
import { RACER_COLORS, RACER_COUNT, THEMES } from "./constants";

const ALL_BOTS: BotType[] = [
  "bully",
  "sniper",
  "beachcomber",
  "navigator",
  "coastglider",
  "daredevil",
];

const BOT_NAMES: Record<BotType, string> = {
  bully: "The Bully",
  sniper: "The Sniper",
  beachcomber: "The Beach-Comber",
  navigator: "The Navigator",
  coastglider: "The Coast-Glider",
  daredevil: "The Daredevil",
};

// --- LOBBY ---

/** Fresh game: one themed course option per theme. */
export function createInitialState(seed = Date.now() >>> 0): GameState {
  const rng = mulberry32(seed);
  const lobbyTracks = THEMES.map((theme) => generateTrack(randInt(rng, 1, 1_000_000), theme));
  return {
    phase: "LOBBY_VOTE",
    turnSubPhase: "INPUT",
    track: null,
    lobbyTracks,
    racers: [],
    activeTurn: 0,
    turnOrder: [],
    round: 1,
    winnerId: null,
    seed,
    finishedCount: 0,
    trails: [],
  };
}

// --- INIT ---

function makeRacer(
  track: Track,
  id: string,
  name: string,
  isHuman: boolean,
  botType: BotType | undefined,
  pos: { x: number; y: number },
  color: string,
): Racer {
  return {
    id,
    name,
    isHuman,
    botType,
    pos: { ...pos },
    color,
    state: "idle",
    skipNextTurn: false,
    lastInBoundsPos: { ...pos },
    progress: progressAlongPath(track, pos),
  };
}

function spawnRacers(track: Track, rng: () => number): Racer[] {
  const bots = shuffle(rng, ALL_BOTS).slice(0, RACER_COUNT - 1);
  const racers: Racer[] = [
    makeRacer(track, "p0", "You", true, undefined, track.startGrid[0], RACER_COLORS[0]),
  ];
  bots.forEach((bt, i) => {
    racers.push(
      makeRacer(track, `b${i}`, BOT_NAMES[bt], false, bt, track.startGrid[i + 1], RACER_COLORS[i + 1]),
    );
  });
  return racers;
}

/** Restart the current track with a fresh grid (no lobby). */
export function restartCurrentTrack(state: GameState): GameState {
  const track = state.track!;
  const rng = mulberry32((Date.now()) >>> 0);
  const racers = spawnRacers(track, rng);
  return {
    ...state,
    phase: "TURN_CYCLE",
    turnSubPhase: "INPUT",
    racers,
    turnOrder: racers.map((r) => r.id),
    activeTurn: 0,
    round: 1,
    winnerId: null,
    finishedCount: 0,
    trails: [],
  };
}

/** Select a lobby course, spawn the grid, begin the first turn. */
export function selectTrack(state: GameState, index: number): GameState {
  const track = state.lobbyTracks[index];
  const rng = mulberry32((state.seed + index + 1) >>> 0);
  const racers = spawnRacers(track, rng);
  return {
    ...state,
    phase: "TURN_CYCLE",
    turnSubPhase: "INPUT",
    track,
    racers,
    turnOrder: racers.map((r) => r.id),
    activeTurn: 0,
    round: 1,
    trails: [],
  };
}

// --- TURN CYCLE ---

export const activeRacer = (state: GameState): Racer =>
  state.racers.find((r) => r.id === state.turnOrder[state.activeTurn])!;

export const isHumanInput = (state: GameState): boolean =>
  state.phase === "TURN_CYCLE" &&
  state.turnSubPhase === "INPUT" &&
  activeRacer(state).isHuman;

export const isBotInput = (state: GameState): boolean =>
  state.phase === "TURN_CYCLE" &&
  state.turnSubPhase === "INPUT" &&
  !activeRacer(state).isHuman;

/** Age the persistent trail layer by one turn, pruning filled-in channels. */
export function decayTrails(state: GameState): void {
  for (const t of state.trails) t.turnsLeft -= 1;
  state.trails = state.trails.filter((t) => t.turnsLeft > 0);
}

/** Advance to the next racer that can act; flip to VICTORY when won. */
export function startNextTurn(state: GameState): void {
  decayTrails(state);
  if (state.winnerId) {
    state.phase = "VICTORY";
    return;
  }
  const n = state.turnOrder.length;
  for (let guard = 0; guard <= n + 1; guard++) {
    const prev = state.activeTurn;
    state.activeTurn = (prev + 1) % n;
    if (state.activeTurn === 0) state.round += 1;
    const r = activeRacer(state);
    if (r.state === "finished") continue;
    if (r.skipNextTurn) {
      r.skipNextTurn = false;
      r.state = "stopped";
      continue;
    }
    r.state = "idle";
    break;
  }
  state.turnSubPhase = "INPUT";
}
