import { describe, expect, it } from 'vitest';

import { statusBadgeVariant } from './statusBadgeVariant';

describe('statusBadgeVariant', () => {
  it('shows nothing while a plain round runs', () => {
    expect(statusBadgeVariant('running', 0)).toBeUndefined();
  });

  it('shows nothing before the round starts', () => {
    expect(statusBadgeVariant('idle', 0)).toBeUndefined();
  });

  it('shows the boost while the multiplier is active', () => {
    expect(statusBadgeVariant('running', 12)).toBe('boost');
  });

  it('prefers paused over an active boost', () => {
    expect(statusBadgeVariant('paused', 12)).toBe('paused');
  });

  it('prefers game over over everything else', () => {
    expect(statusBadgeVariant('game-over', 12)).toBe('game-over');
  });
});
