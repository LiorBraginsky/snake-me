/**
 * The randomness the game core needs, as a port (spec §4). The only source of
 * non-determinism in the slice: inject a seeded implementation and a round
 * replays exactly.
 */
export interface Rng {
  /** Uniform value in the half-open range [0, 1). */
  next(): number;
}

/**
 * mulberry32 — a 32-bit PRNG in eight lines. Chosen because this slice imports
 * nothing (spec §4) and because it uses only `Math.imul` and unsigned shifts,
 * so every JS engine produces bit-identical sequences for a given seed. The
 * numbers below are the algorithm's constants, not gameplay values.
 */
export function createSeededRng(seed: number): Rng {
  let state = seed >>> 0;

  return {
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

      return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
    },
  };
}
