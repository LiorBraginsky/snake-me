import { describe, expect, it } from 'vitest';

import { createSeededRng } from './rng';

function take(count: number, seed: number): number[] {
  const rng = createSeededRng(seed);

  return Array.from({ length: count }, () => rng.next());
}

describe('createSeededRng', () => {
  it('replays the same sequence for the same seed', () => {
    expect(take(100, 42)).toEqual(take(100, 42));
  });

  it('produces a different sequence for a different seed', () => {
    expect(take(10, 42)).not.toEqual(take(10, 43));
  });

  it('stays inside the half-open range [0, 1)', () => {
    for (const value of take(1000, 7)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('does not degenerate into a repeated value', () => {
    expect(new Set(take(100, 1)).size).toBeGreaterThan(90);
  });

  it('works from seed 0', () => {
    expect(new Set(take(5, 0)).size).toBe(5);
  });
});
