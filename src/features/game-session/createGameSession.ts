import { createSignal } from 'solid-js';
import type { Accessor } from 'solid-js';

import type { GameState, Rng, Rules } from '../../entities/game';
import { createInitialState, restart, start, tick, togglePause, turn } from '../../entities/game';
import type { ControlSignal } from '../../shared/input';

export interface GameSessionOptions {
  readonly rules: Rules;
  readonly rng: Rng;
}

export interface GameSession {
  readonly state: Accessor<GameState>;
  readonly dispatch: (signal: ControlSignal) => void;
  readonly start: () => void;
  readonly togglePause: () => void;
  readonly restart: () => void;
  readonly tick: () => void;
}

export function createGameSession(options: GameSessionOptions): GameSession {
  const { rules, rng } = options;
  const [state, setState] = createSignal(createInitialState(rules, rng));

  return {
    state,
    dispatch: (signal) => {
      switch (signal.kind) {
        case 'turn':
          setState((current) => turn(current, rules, signal.direction));
          return;
        case 'togglePause':
          setState(togglePause);
          return;
        case 'confirm':
          setState((current) =>
            current.status === 'game-over' ? restart(rules, rng) : start(current),
          );
          return;
      }
    },
    start: () => {
      setState(start);
    },
    togglePause: () => {
      setState(togglePause);
    },
    restart: () => {
      setState(restart(rules, rng));
    },
    tick: () => {
      setState((current) => tick(current, rules, rng));
    },
  };
}
