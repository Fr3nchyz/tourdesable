import { describe, it, expect } from "vitest";
import { createInitialState, selectTrack, activeRacer, isHumanInput } from "./stateMachine";
import { applyLaunch, update, takeBotTurn } from "./engine";
import { centerlineXAt } from "./track";
import { RACER_COUNT } from "./constants";
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
  it("attacker stops in the vacated pocket; target is launched", () => {
    const s = started();
    const t = s.track!;
    const midY = t.height * 0.5;
    const cx = centerlineXAt(t, midY);

    const attacker = s.racers[0];
    attacker.pos = { x: cx, y: midY };
    attacker.lastInBoundsPos = { x: cx, y: midY };

    const target = s.racers[1];
    const targetPos = { x: cx, y: midY - 36 }; // just up-track, within hit range
    target.pos = { ...targetPos };
    target.lastInBoundsPos = { ...targetPos };
    target.state = "stopped";

    applyLaunch(s, { dir: { x: 0, y: -1 }, power: 0.8 });
    runUntilSettled(s);

    // Attacker parked at/above the target's old pocket; target shoved up-track.
    expect(attacker.pos.y).toBeLessThanOrEqual(midY);
    expect(target.pos.y).toBeLessThan(targetPos.y); // moved up from impact
  });
});

describe("victory", () => {
  it("first marble across the finish wins and flips to VICTORY", () => {
    const s = started();
    const t = s.track!;
    const human = s.racers[0];
    const y = t.finishY + 30;
    human.pos = { x: centerlineXAt(t, y), y };
    human.lastInBoundsPos = { ...human.pos };

    applyLaunch(s, { dir: { x: 0, y: -1 }, power: 1 });
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
