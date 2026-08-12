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
  /** The whole engine state, in one signal. */
  readonly state: Accessor<GameState>;
  /** Maps what the player asked for onto the engine command it means. */
  readonly dispatch: (signal: ControlSignal) => void;
  readonly start: () => void;
  readonly togglePause: () => void;
  readonly restart: () => void;
  /** One engine tick. Driven by `createGameLoop`, never by a widget. */
  readonly tick: () => void;
}

/**
 * The engine's only reactive wrapper. Every command is an updater, so the
 * session never reads its own signal to write it — and because a transition
 * that changes nothing returns its input BY REFERENCE (ADR 0004) while the
 * signal's default equality is `===`, a rejected turn or a start on a running
 * round notifies nobody at all.
 */
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
          // Space is both "begin" and "play again" (spec §3). Outside those two
          // statuses `start` is the no-op the engine already defines, so this
          // needs two branches rather than a status enumeration.
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
