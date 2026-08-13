import { Show, createMemo } from 'solid-js';
import type { JSX } from 'solid-js';

import type { GameStatus } from '../../entities/game';
import { statusBadgeVariant } from './statusBadgeVariant';
import type { StatusBadgeVariant } from './statusBadgeVariant';

const LABELS: Readonly<Record<StatusBadgeVariant, string>> = {
  'game-over': 'Game over',
  paused: 'Paused',
  boost: 'Boost',
};

export interface StatusBadgeProps {
  readonly status: GameStatus;
  readonly boostTicksRemaining: number;
}

export function StatusBadge(props: StatusBadgeProps): JSX.Element {
  const variant = createMemo(() => statusBadgeVariant(props.status, props.boostTicksRemaining));

  return (
    <p class="hud__badge" role="status">
      <Show when={variant()}>
        {(current) => <span class={`hud__chip hud__chip--${current()}`}>{LABELS[current()]}</span>}
      </Show>
    </p>
  );
}
