import type { JSX } from 'solid-js';

import type { GameStatus } from '../../entities/game';
import { ScoreCounter } from './ScoreCounter';
import { StatusBadge } from './StatusBadge';

export interface HudProps {
  readonly score: number;
  readonly status: GameStatus;
  readonly boostTicksRemaining: number;
}

/**
 * Three scalars, not the whole GameState: the HUD is the game's text surface, so
 * it stays the accessible half of a stage whose layers are aria-hidden.
 */
export function Hud(props: HudProps): JSX.Element {
  return (
    <div class="hud">
      <ScoreCounter score={props.score} />
      <StatusBadge status={props.status} boostTicksRemaining={props.boostTicksRemaining} />
    </div>
  );
}
