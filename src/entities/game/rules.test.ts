import { describe, expect, it } from 'vitest';

import { DEFAULT_RULES, SCOREBOARD_SIZE } from './rules';

describe('DEFAULT_RULES', () => {
  it('describes the 24 x 16 landscape board from spec §3', () => {
    expect(DEFAULT_RULES.cols).toBe(24);
    expect(DEFAULT_RULES.rows).toBe(16);
  });

  it('derives the boost duration from the boosted interval, as whole ticks', () => {
    // 5000 ms / (150 ms / 1.6) = 53.33 ticks -> 53 (spec §3).
    expect(DEFAULT_RULES.boostDurationTicks).toBe(53);
    expect(Number.isInteger(DEFAULT_RULES.boostDurationTicks)).toBe(true);
  });

  it('names the starting direction from spec §3', () => {
    expect(DEFAULT_RULES.initialDirection).toBe('right');
  });

  it('names every other spec §3 number', () => {
    expect(DEFAULT_RULES.baseTickMs).toBe(150);
    expect(DEFAULT_RULES.boostMultiplier).toBe(1.6);
    expect(DEFAULT_RULES.boostTtlTicks).toBe(30);
    expect(DEFAULT_RULES.boostSpawnChance).toBe(0.2);
    expect(DEFAULT_RULES.foodScore).toBe(10);
    expect(DEFAULT_RULES.boostScore).toBe(5);
    expect(DEFAULT_RULES.initialSnakeLength).toBe(3);
    expect(DEFAULT_RULES.directionQueueDepth).toBe(2);
    expect(SCOREBOARD_SIZE).toBe(5);
  });
});
