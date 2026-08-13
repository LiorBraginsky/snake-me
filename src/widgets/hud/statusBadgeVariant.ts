import type { GameStatus } from '../../entities/game';

export type StatusBadgeVariant = 'game-over' | 'paused' | 'boost';

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
