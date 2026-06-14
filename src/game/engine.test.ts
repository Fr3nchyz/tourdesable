import { describe, it, expect } from "vitest";
import { createInitialState, selectTrack, activeRacer, isHumanInput } from "./stateMachine";
import { applyLaunch, update, takeBotTurn } from "./engine";
import { loopPointAt, tangentAt } from "./track";
import { RACER_COUNT } from "./constants";
import * as V from "./vector";
import type { GameState } from "./types";

const SEED = 4242;

function started(): GameState {
  return selectTrack(createInitialState(SEED), 0);
}

/** Run frames until the turn settles (or a safety cap). */
function runUntilSettled(state: GameState, cap = 5000): number {
  let frames = 0;
  while (state.turnSubPhase === "PHYSICS" && frames < cap) {
    update(state);
    frames++;
  }
  return frames;
}

describe("lobby + init", () => {
  it("starts in the lobby with three distinct tracks", () => {
    const s = createInitialState(SEED);
    expect(s.phase).toBe("LOBBY_VOTE");
    expect(s.lobbyTracks).toHaveLength(3);
    const seeds = s.lobbyTracks.map((t) => t.seed);
    expect(new Set(seeds).size).toBe(3);
  });

  it("selecting a track spawns the grid and starts the turn cycle", () => {
    const s = started();
    expect(s.phase).toBe("TURN_CYCLE");
    expect(s.racers).toHaveLength(RACER_COUNT);
    expect(s.racers[0].isHuman).toBe(true);
    expect(s.racers.slice(1).every((r) => !r.isHuman)).toBe(true);
    expect(isHumanInput(s)).toBe(true);
  });
});

describe("flick -> physics -> resolution", () => {
  it("applyLaunch enters PHYSICS and sets velocity", () => {
    const s = started();
    applyLaunch(s, { dir: { x: 0, y: -1 }, power: 0.5 });
    expect(s.turnSubPhase).toBe("PHYSICS");
    expect(activeRacer(s).vel.y).toBeLessThan(0);
  });

  it("blocks resolution until the marble stops, then advances the turn", () => {
    const s = started();
    applyLaunch(s, { dir: { x: 0, y: -1 }, power: 0.4 });
    // One frame in: still moving, still player 0's turn.
    update(s);
    if (s.turnSubPhase === "PHYSICS") {
      expect(s.activeTurn).toBe(0);
    }
    runUntilSettled(s);
    expect(s.turnSubPhase).toBe("INPUT");
    expect(s.activeTurn).toBe(1); // handed to the next racer
    expect(activeRacer(s).vel).toEqual({ x: 0, y: 0 });
  });

  it("update is a no-op outside the physics phase", () => {
    const s = started();
    const ev = update(s); // still INPUT
    expect(ev.settled).toBe(false);
    expect(s.activeTurn).toBe(0);
  });
});

describe("pocket-stealer shunt in the loop", () => {
  it("attacker stops; target is launched forward", () => {
    const s = started();
    const t = s.track!;
    const tt = 0.35;
    const center = loopPointAt(t, tt);
    const tangent = tangentAt(t, tt);

    const attacker = s.racers[0];
    attacker.pos = { ...center };
    attacker.lastInBoundsPos = { ...center };

    const target = s.racers[1];
    const targetPos = V.add(center, V.scale(tangent, 36)); // just ahead, in range
    target.pos = { ...targetPos };
    target.lastInBoundsPos = { ...targetPos };
    target.state = "stopped";
    const targetStart = { ...targetPos };

    applyLaunch(s, { dir: tangent, power: 0.8 });
    runUntilSettled(s);

    expect(["stopped", "tipped"]).toContain(attacker.state);
    // Target was shoved forward, away from where it sat.
    expect(V.dist(target.pos, targetStart)).toBeGreaterThan(5);
  });
});

describe("victory", () => {
  it("completing the lap crosses the finish and flips to VICTORY", () => {
    const s = started();
    const t = s.track!;
    const human = s.racers[0];

    // Park the human just before the finish line, having already passed halfway.
    const startT = 0.97;
    human.pos = loopPointAt(t, startT);
    human.lastInBoundsPos = { ...human.pos };
    human.loopT = startT;
    human.passedHalf = true;

    applyLaunch(s, { dir: tangentAt(t, startT), power: 0.6 });
    runUntilSettled(s);

    expect(s.winnerId).toBe(human.id);
    expect(s.phase).toBe("VICTORY");
  });
});

describe("bot turns + full round", () => {
  it("every racer acts and the round advances", () => {
    const s = started();
    const acted = new Set<string>();

    // Drive whole turns until the round ticks over (or a safety cap). A bot may
    // knock another off the grid, so a racer's turn can be skipped — we only
    // require that the cycle completes and the round advances.
    let guard = 0;
    while (s.round < 2 && guard++ < 20) {
      acted.add(activeRacer(s).id);
      if (isHumanInput(s)) {
        applyLaunch(s, { dir: { x: 0, y: -1 }, power: 0.3 });
      } else {
        takeBotTurn(s);
      }
      runUntilSettled(s);
    }

    expect(s.round).toBe(2);
    expect(acted.size).toBeGreaterThanOrEqual(2); // multiple racers took turns
    expect(["TURN_CYCLE", "VICTORY"]).toContain(s.phase);
  });
});
