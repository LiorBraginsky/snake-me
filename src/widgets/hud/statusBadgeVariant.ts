import type { GameStatus } from '../../entities/game';

export type StatusBadgeVariant = 'game-over' | 'paused' | 'boost';

/**
 * Which single badge the HUD shows, if any. At most one is ever visible, in this
 * precedence: a finished round beats a paused one, and both beat an active
 * boost. Split out of the component because the precedence is the only logic in
 * this widget — and logic is the only thing this project tests (spec §8).
 */
export function statusBadgeVariant(
  status: GameStatus,
  boostTicksRemaining: number,
): StatusBadgeVariant | undefined {
  if (status === 'game-over') {
    return 'game-over';
  }
  if (status === 'paused') {
    return 'paused';
  }
  if (boostTicksRemaining > 0) {
    return 'boost';
  }

  return undefined;
}
