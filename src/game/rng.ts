// ============================================================================
// tour-de-sable — seeded RNG (mulberry32)
// Deterministic from a seed so track generation + tests are reproducible.
// ============================================================================

export type Rng = () => number;

/** mulberry32: fast, well-distributed 32-bit seeded PRNG. Returns [0,1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Float in [min, max). */
export const randRange = (rng: Rng, min: number, max: number): number =>
  min + rng() * (max - min);

/** Integer in [min, max] inclusive. */
export const randInt = (rng: Rng, min: number, max: number): number =>
  Math.floor(randRange(rng, min, max + 1));

/** Pick a random element. */
export const pick = <T>(rng: Rng, arr: readonly T[]): T =>
  arr[Math.floor(rng() * arr.length)];

/** Fisher-Yates shuffle (returns a new array). */
export function shuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
