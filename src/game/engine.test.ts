import { describe, it, expect } from "vitest";
import { createInitialState, selectTrack, activeRacer, isHumanInput } from "./stateMachine";
import { applyLaunch, takeBotTurn, updateRacerPos, onSettled } from "./engine";
import { RACER_COUNT } from "./constants";
import type { GameState } from "./types";

const SEED = 4242;

function started(): GameState {
  return selectTrack(createInitialState(SEED), 0);
}

describe("lobby + init", () => {
  it("starts in the lobby with three distinct tracks", () => {
    const s = createInitialState(SEED);
    expect(s.phase).toBe("LOBBY_VOTE");
    expect(s.lobbyTracks).toHaveLength(3);
    const themes = s.lobbyTracks.map((t) => t.theme);
    expect(new Set(themes).size).toBe(3);
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

describe("applyLaunch", () => {
  it("enters PHYSICS phase", () => {
    const s = started();
    applyLaunch(s, { dir: { x: 0, y: 1 }, power: 0.5 });
    expect(s.turnSubPhase).toBe("PHYSICS");
  });

  it("returns a 3D impulse scaled by power", () => {
    const s = started();
    const impulse = applyLaunch(s, { dir: { x: 0, y: 1 }, power: 1.0 });
    expect(impulse.x).toBeCloseTo(0);
    expect(impulse.y).toBeCloseTo(0);
    expect(Math.abs(impulse.z)).toBeGreaterThan(0);
  });

  it("direction maps ground-plane (x,y) to world (x,0,z)", () => {
    const s = started();
    const impulse = applyLaunch(s, { dir: { x: 1, y: 0 }, power: 1.0 });
    expect(impulse.x).toBeGreaterThan(0);
    expect(impulse.y).toBeCloseTo(0);
    expect(impulse.z).toBeCloseTo(0);
  });
});

describe("takeBotTurn", () => {
  it("enters PHYSICS phase and returns a valid impulse", () => {
    const s = started();
    // Make the first player a bot so takeBotTurn acts on it.
    s.racers[0].isHuman = false;
    s.racers[0].botType = "sniper";
    const impulse = takeBotTurn(s);
    expect(s.turnSubPhase).toBe("PHYSICS");
    const mag = Math.hypot(impulse.x, impulse.y, impulse.z);
    expect(mag).toBeGreaterThan(0);
  });
});

describe("updateRacerPos", () => {
  it("returns ok for a normal in-bounds position", () => {
    const s = started();
    const track = s.track!;
    const r = s.racers[0];
    const result = updateRacerPos(s, r.id, r.pos.x, 0, r.pos.y + 5);
    expect(result).toBe("ok");
  });

  it("returns finish when marble reaches the finish zone", () => {
    const s = started();
    const track = s.track!;
    const r = s.racers[0];
    const result = updateRacerPos(
      s,
      r.id,
      track.finish.x,
      0,
      track.finish.y,
    );
    expect(result).toBe("finish");
    expect(r.state).toBe("finished");
    expect(s.winnerId).toBe(r.id);
  });

  it("returns offcourse when marble falls below sea level", () => {
    const s = started();
    const track = s.track!;
    const r = s.racers[0];
    const result = updateRacerPos(s, r.id, r.pos.x, track.seaLevelY - 1, r.pos.y);
    expect(result).toBe("offcourse");
    expect(r.state).toBe("tipped");
    expect(r.skipNextTurn).toBe(true);
  });

  it("returns offcourse when marble leaves the course bounds", () => {
    const s = started();
    const track = s.track!;
    const r = s.racers[0];
    const result = updateRacerPos(s, r.id, track.width, 0, r.pos.y);
    expect(result).toBe("offcourse");
  });
});

describe("onSettled", () => {
  it("advances the turn and resets to INPUT", () => {
    const s = started();
    applyLaunch(s, { dir: { x: 0, y: 1 }, power: 0.3 });
    expect(s.turnSubPhase).toBe("PHYSICS");
    onSettled(s);
    expect(s.turnSubPhase).toBe("INPUT");
    expect(s.activeTurn).toBe(1);
  });

  it("transitions to VICTORY when a winner exists", () => {
    const s = started();
    s.winnerId = s.racers[0].id;
    applyLaunch(s, { dir: { x: 0, y: 1 }, power: 0.3 });
    onSettled(s);
    expect(s.phase).toBe("VICTORY");
  });
});

describe("bot round cycling", () => {
  it("every racer acts and the round advances", () => {
    const s = started();
    const acted = new Set<string>();
    let guard = 0;

    while (s.round < 2 && guard++ < 20) {
      acted.add(activeRacer(s).id);
      if (isHumanInput(s)) {
        applyLaunch(s, { dir: { x: 0, y: 1 }, power: 0.3 });
      } else {
        takeBotTurn(s);
      }
      // Simulate settle: immediately resolve (no real physics in tests).
      onSettled(s);
    }

    expect(s.round).toBe(2);
    expect(acted.size).toBeGreaterThanOrEqual(2);
    expect(["TURN_CYCLE", "VICTORY"]).toContain(s.phase);
  });
});
