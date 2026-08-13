import { createEffect, createMemo, onCleanup } from 'solid-js';
import type { Accessor } from 'solid-js';

import type { GameState, Rules } from '../../entities/game';
import { tickIntervalMs } from '../../entities/game';

export interface FrameScheduler {
  requestAnimationFrame(callback: (timeMs: number) => void): number;
  cancelAnimationFrame(handle: number): void;
}

export interface GameLoopOptions {
  readonly state: Accessor<GameState>;
  readonly rules: Rules;
  readonly frames: FrameScheduler;
  readonly advance: () => void;
}

export function createGameLoop(options: GameLoopOptions): void {
  const { state, rules, frames, advance } = options;

  let scheduled: number | undefined;
  let previousMs: number | undefined;
  let accumulated = 0;
  let isRunning = false;

  const onFrame = (timeMs: number): void => {
    scheduled = undefined;

    if (previousMs === undefined) {
      previousMs = timeMs;
    } else {
      accumulated += timeMs - previousMs;
      previousMs = timeMs;

      const interval = tickIntervalMs(state(), rules);

      if (accumulated >= interval) {
        accumulated %= interval;
        advance();
      }
    }

    if (isRunning && scheduled === undefined) {
      scheduled = frames.requestAnimationFrame(onFrame);
    }
  };

  const status = createMemo(() => state().status);

  createEffect(() => {
    isRunning = status() === 'running';

    if (isRunning) {
      if (scheduled === undefined) {
        accumulated = 0;
        previousMs = undefined;
        scheduled = frames.requestAnimationFrame(onFrame);
      }
    } else if (scheduled !== undefined) {
      frames.cancelAnimationFrame(scheduled);
      scheduled = undefined;
    }
  });

  onCleanup(() => {
    isRunning = false;

    if (scheduled !== undefined) {
      frames.cancelAnimationFrame(scheduled);
      scheduled = undefined;
    }
  });
}
