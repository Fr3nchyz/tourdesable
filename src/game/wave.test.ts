import { describe, it, expect } from "vitest";
import {
  rollWave,
  waveZoneTopY,
  applyWaveImpact,
  makeAftermathObstacles,
  beginAftermath,
  advanceAftermath,
} from "./wave";
import { generateTrack, centerlineXAt, isOutOfBounds } from "./track";
import { mulberry32 } from "./rng";
import {
  WAVE_PUSHBACK,
  WAVE_AFTERMATH_ROUNDS,
  WAVE_AFTERMATH_OBSTACLES,
} from "./constants";
import type { Racer, Vector2D } from "./types";

const track = generateTrack(321);

function racer(id: string, pos: Vector2D): Racer {
  return {
    id,
    name: id,
    isHuman: false,
    pos,
    vel: { x: 1, y: -1 },
    radius: 16,
    mass: 1,
    color: "#fff",
    state: "stopped",
    skipNextTurn: false,
    lastInBoundsPos: pos,
    progress: track.centerline[0].y - pos.y,
  };
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

  it("pushes a caught marble 100px back along the track", () => {
    const y = zoneTopY + 100;
    const r = racer("a", { x: centerlineXAt(track, y), y });
    const [after] = applyWaveImpact([r], track);
    expect(after.pos.y).toBeCloseTo(y + WAVE_PUSHBACK, 6);
    expect(after.vel).toEqual({ x: 0, y: 0 });
  });

  it("leaves marbles above the zone untouched", () => {
    const y = zoneTopY - 100;
    const r = racer("b", { x: centerlineXAt(track, y), y });
    const [after] = applyWaveImpact([r], track);
    expect(after.pos.y).toBe(y);
  });

  it("tips a marble forced off the track bounds", () => {
    // Sit a marble near the bottom edge so +100 pushes it past the board.
    const y = track.height - 30;
    const r = racer("c", { x: centerlineXAt(track, y), y });
    const [after] = applyWaveImpact([r], track);
    expect(isOutOfBounds(track, after.pos)).toBe(true);
    expect(after.state).toBe("tipped");
    expect(after.skipNextTurn).toBe(true);
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
