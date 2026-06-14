// ============================================================================
// tour-de-sable — phase transitions + turn sequencing
// LOBBY_VOTE -> INITIALIZATION -> TURN_CYCLE -> ROUND_END -> VICTORY
// ============================================================================

import type { GameState, Racer, Track, BotType } from "./types";
import { generateTrack } from "./track";
import { mulberry32, randInt, shuffle, type Rng } from "./rng";
import { rollWave, applyWaveImpact, makeAftermathObstacles, beginAftermath, advanceAftermath } from "./wave";
import { MARBLE_RADIUS, MARBLE_MASS, RACER_COLORS, RACER_COUNT } from "./constants";

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

/** Per-round deterministic RNG derived from the master seed. */
const roundRng = (seed: number, round: number): Rng =>
  mulberry32((seed ^ (round * 0x9e3779b1)) >>> 0);

// ---------------------------------------------------------------------------
// LOBBY_VOTE
// ---------------------------------------------------------------------------

/** Fresh game in the lobby with three distinct track options. */
export function createInitialState(seed = Date.now() >>> 0): GameState {
  const rng = mulberry32(seed);
  const seeds = new Set<number>();
  while (seeds.size < 3) seeds.add(randInt(rng, 1, 1_000_000));
  const lobbyTracks = [...seeds].map(generateTrack);

  return {
    phase: "LOBBY_VOTE",
    turnSubPhase: "INPUT",
    track: null,
    lobbyTracks,
    racers: [],
    activeTurn: 0,
    turnOrder: [],
    round: 1,
    wave: { phase: "none", aftermathRoundsLeft: 0, zoneTopY: 0 },
    winnerId: null,
    seed,
    finishedCount: 0,
  };
}

// ---------------------------------------------------------------------------
// INITIALIZATION
// ---------------------------------------------------------------------------

function spawnRacers(track: Track, rng: Rng): Racer[] {
  const bots = shuffle(rng, ALL_BOTS).slice(0, RACER_COUNT - 1);
  const racers: Racer[] = [];

  // Human in the first grid slot.
  racers.push(makeRacer("p0", "You", true, undefined, track.startGrid[0], RACER_COLORS[0]));

  bots.forEach((bt, i) => {
    racers.push(
      makeRacer(`b${i}`, BOT_NAMES[bt], false, bt, track.startGrid[i + 1], RACER_COLORS[i + 1]),
    );
  });
  return racers;
}

function makeRacer(
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
    vel: { x: 0, y: 0 },
    radius: MARBLE_RADIUS,
    mass: MARBLE_MASS,
    color,
    state: "idle",
    skipNextTurn: false,
    lastInBoundsPos: { ...pos },
    progress: 0,
  };
}

/** Select a lobby track, spawn the grid, and begin the first turn cycle. */
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
  };
}

// ---------------------------------------------------------------------------
// TURN_CYCLE -> ROUND_END
// ---------------------------------------------------------------------------

export const activeRacer = (state: GameState): Racer =>
  state.racers.find((r) => r.id === state.turnOrder[state.activeTurn])!;

/** Whether the active racer is a human awaiting flick input. */
export const isHumanInput = (state: GameState): boolean =>
  state.phase === "TURN_CYCLE" &&
  state.turnSubPhase === "INPUT" &&
  activeRacer(state).isHuman;

/** Whether the active racer is a bot awaiting its computed launch. */
export const isBotInput = (state: GameState): boolean =>
  state.phase === "TURN_CYCLE" &&
  state.turnSubPhase === "INPUT" &&
  !activeRacer(state).isHuman;

export interface RoundEndInfo {
  waveTriggered: boolean;
}

/**
 * End of a full round: tick any active aftermath (removing it + its temporary
 * obstacles when due), otherwise roll for a fresh rogue wave. Mutates state.
 */
function onRoundEnd(state: GameState): RoundEndInfo {
  state.round += 1;
  const rng = roundRng(state.seed, state.round);

  if (state.wave.phase === "aftermath") {
    const { wave, ended } = advanceAftermath(state.wave);
    state.wave = wave;
    if (ended && state.track) {
      state.track = {
        ...state.track,
        obstacles: state.track.obstacles.filter((o) => !("temporary" in o && o.temporary)),
      };
    }
    return { waveTriggered: false };
  }

  if (state.track && rollWave(state.round, rng)) {
    // Warning -> impact -> aftermath. Impact + aftermath applied now; the UI
    // animates the warning/impact interlude off the returned flag.
    state.racers = applyWaveImpact(state.racers, state.track);
    const temps = makeAftermathObstacles(state.track, rng);
    state.track = { ...state.track, obstacles: [...state.track.obstacles, ...temps] };
    state.wave = beginAftermath(state.track);
    return { waveTriggered: true };
  }

  return { waveTriggered: false };
}

/**
 * Advance to the next racer that can act. Skips tipped racers (consuming their
 * missed turn), runs round-end logic on wrap, and flips to VICTORY if won.
 * Returns whether a wave was triggered this transition.
 */
export function startNextTurn(state: GameState): RoundEndInfo {
  if (state.winnerId) {
    state.phase = "VICTORY";
    return { waveTriggered: false };
  }

  let info: RoundEndInfo = { waveTriggered: false };
  const n = state.turnOrder.length;

  for (let guard = 0; guard <= n + 1; guard++) {
    const prev = state.activeTurn;
    state.activeTurn = (prev + 1) % n;
    if (state.activeTurn === 0) info = onRoundEnd(state);

    const r = activeRacer(state);
    if (r.state === "finished") continue; // already done, skip
    if (r.skipNextTurn) {
      // Consume the missed turn from tipping; the marble is already parked at
      // its respawn anchor adjacent to where it left the track.
      r.skipNextTurn = false;
      r.state = "stopped";
      continue;
    }
    r.state = "idle";
    break;
  }

  state.turnSubPhase = "INPUT";
  return info;
}
