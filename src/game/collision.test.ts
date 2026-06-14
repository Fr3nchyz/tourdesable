import { describe, it, expect } from "vitest";
import { circlesOverlap, resolveShunt, resolveDriftwood } from "./collision";
import { SHUNT_TRANSFER } from "./constants";
import * as V from "./vector";
import type { RectObstacle } from "./types";

describe("circle overlap", () => {
  it("detects overlap by radius sum", () => {
    expect(circlesOverlap({ x: 0, y: 0 }, 10, { x: 15, y: 0 }, 10)).toBe(true);
    expect(circlesOverlap({ x: 0, y: 0 }, 10, { x: 25, y: 0 }, 10)).toBe(false);
  });
});

describe("pocket-stealer shunt", () => {
  it("transfers 70% of incoming speed to the target along the normal", () => {
    // Attacker moving +x into a target directly to its right.
    const r = resolveShunt({ x: 0, y: 0 }, { x: 10, y: 0 }, 16, { x: 30, y: 0 });
    const targetSpeed = V.len(r.target.vel);
    expect(targetSpeed).toBeCloseTo(0.7 * 10, 10);
    expect(SHUNT_TRANSFER).toBe(0.7);
    // Direction is along +x (attacker -> target normal).
    expect(V.normalize(r.target.vel).x).toBeCloseTo(1, 10);
  });

  it("attacker stops dead in the vacated pocket", () => {
    const targetPos = { x: 30, y: 0 };
    const r = resolveShunt({ x: 0, y: 0 }, { x: 10, y: 0 }, 16, targetPos);
    expect(r.attacker.vel).toEqual({ x: 0, y: 0 });
    expect(r.attacker.pos).toEqual(targetPos);
  });

  it("produces a contact point between the marbles", () => {
    const r = resolveShunt({ x: 0, y: 0 }, { x: 5, y: 0 }, 16, { x: 40, y: 0 });
    expect(r.contact.x).toBeCloseTo(16, 6);
    expect(r.contact.y).toBeCloseTo(0, 6);
  });
});

describe("driftwood elastic bounce", () => {
  const plank: RectObstacle = {
    kind: "driftwood",
    pos: { x: 0, y: 0 },
    halfW: 40,
    halfH: 10,
    angle: 0,
  };

  it("reflects velocity off the top face", () => {
    // Marble approaching from above moving down (+y), just touching top face.
    const r = resolveDriftwood({ x: 0, y: -14 }, { x: 0, y: 5 }, 16, plank);
    expect(r.hit).toBe(true);
    expect(r.vel.y).toBeCloseTo(-5, 6); // y flipped
    expect(r.vel.x).toBeCloseTo(0, 6);
    expect(r.pos.y).toBeCloseTo(-(plank.halfH + 16), 6); // pushed clear above
  });

  it("reports no hit when clearly separated", () => {
    const r = resolveDriftwood({ x: 0, y: -200 }, { x: 0, y: 5 }, 16, plank);
    expect(r.hit).toBe(false);
  });

  it("handles a rotated plank (45deg) and keeps speed (elastic)", () => {
    const rot: RectObstacle = { ...plank, angle: Math.PI / 4 };
    const incoming = { x: 6, y: 6 };
    const r = resolveDriftwood({ x: 18, y: 18 }, incoming, 16, rot);
    if (r.hit) {
      expect(V.len(r.vel)).toBeCloseTo(V.len(incoming), 6); // elastic: |v| preserved
    }
  });
});
