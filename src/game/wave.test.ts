import { describe, it, expect } from "vitest";
import {
  rollWave,
  waveZoneTopY,
  applyWaveImpact,
  makeAftermathObstacles,
  beginAftermath,
  advanceAftermath,
} from "./wave";
import { generateTrack, loopPointAt, nearestOnLoop } from "./track";
import { mulberry32 } from "./rng";
import * as V from "./vector";
import {
  WAVE_PUSHBACK,
  WAVE_AFTERMATH_ROUNDS,
  WAVE_AFTERMATH_OBSTACLES,
} from "./constants";
import type { Racer, Vector2D } from "./types";

const track = generateTrack(321);

function racer(id: string, pos: Vector2D): Racer {
  const loopT = nearestOnLoop(track, pos).t;
  return {
    id,
    name: id,
    isHuman: false,
    pos,
    vel: { x: 0, y: 0 },
    radius: 16,
    mass: 1,
    color: "#fff",
    state: "stopped",
    skipNextTurn: false,
    lastInBoundsPos: pos,
    progress: loopT,
    lap: 0,
    loopT,
    passedHalf: false,
  };
}

/** A centerline point with y in the lower (wave) zone, or null. */
function lowCenterlinePoint(): Vector2D | null {
  const zoneTopY = track.height * 0.6;
  for (let s = 0; s < 1; s += 0.005) {
    const p = loopPointAt(track, s);
    if (p.y >= zoneTopY + 40) return p;
  }
  return null;
}

describe("wave trigger", () => {
  it("never triggers before round 3", () => {
    expect(rollWave(1, () => 0)).toBe(false);
    expect(rollWave(2, () => 0)).toBe(false);
  });

  it("triggers at round >=3 when the roll is under 20%", () => {
    expect(rollWave(3, () => 0.1)).toBe(true);
    expect(rollWave(5, () => 0.19)).toBe(true);
    expect(rollWave(3, () => 0.25)).toBe(false);
  });
});

describe("wave zone", () => {
  it("covers the lower 40% of the board", () => {
    expect(waveZoneTopY(track)).toBeCloseTo(track.height * 0.6, 6);
  });
});

describe("wave impact", () => {
  const zoneTopY = waveZoneTopY(track);

  it("shoves a caught marble ~100px backward along the loop", () => {
    const low = lowCenterlinePoint();
    expect(low).not.toBeNull();
    const r = racer("a", low!);
    const [after] = applyWaveImpact([r], track);
    expect(V.dist(r.pos, after.pos)).toBeCloseTo(WAVE_PUSHBACK, 4);
    expect(after.vel).toEqual({ x: 0, y: 0 });
  });

  it("leaves marbles above the zone untouched", () => {
    // A point clearly above the lower zone.
    let high: Vector2D | null = null;
    for (let s = 0; s < 1; s += 0.005) {
      const p = loopPointAt(track, s);
      if (p.y <= zoneTopY - 120) {
        high = p;
        break;
      }
    }
    expect(high).not.toBeNull();
    const r = racer("b", high!);
    const [after] = applyWaveImpact([r], track);
    expect(after.pos).toEqual(high);
  });
});

describe("aftermath", () => {
  it("begins with the configured duration", () => {
    const w = beginAftermath(track);
    expect(w.phase).toBe("aftermath");
    expect(w.aftermathRoundsLeft).toBe(WAVE_AFTERMATH_ROUNDS);
  });

  it("spawns temporary obstacles inside the lower zone", () => {
    const obs = makeAftermathObstacles(track, mulberry32(4));
    expect(obs).toHaveLength(WAVE_AFTERMATH_OBSTACLES);
    const zoneTopY = waveZoneTopY(track);
    for (const o of obs) {
      expect(o.temporary).toBe(true);
      expect(o.pos.y).toBeGreaterThanOrEqual(zoneTopY);
    }
  });

  it("counts down and ends after the duration", () => {
    const w = beginAftermath(track); // 2 rounds
    let r = advanceAftermath(w);
    expect(r.ended).toBe(false);
    expect(r.wave.aftermathRoundsLeft).toBe(1);
    r = advanceAftermath(r.wave);
    expect(r.ended).toBe(true);
    expect(r.wave.phase).toBe("none");
  });
});
