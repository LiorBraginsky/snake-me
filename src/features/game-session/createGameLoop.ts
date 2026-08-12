import { createEffect, createMemo, onCleanup } from 'solid-js';
import type { Accessor } from 'solid-js';

import type { GameState, Rules } from '../../entities/game';
import { tickIntervalMs } from '../../entities/game';

/**
 * The part of `Window` the loop needs. The real `window` satisfies it
 * structurally (proven at compile time in createGameLoop.test.ts), so
 * production passes `window` and a test passes a fake that fires frames on
 * command — which is how the loop is tested under `environment: 'node'` with no
 * jsdom. The clock is not a second port: rAF hands each frame its own
 * timestamp, so the accumulator never asks anything what time it is.
 */
export interface FrameScheduler {
  requestAnimationFrame(callback: (timeMs: number) => void): number;
  cancelAnimationFrame(handle: number): void;
}

export interface GameLoopOptions {
  readonly state: Accessor<GameState>;
  readonly rules: Rules;
  readonly frames: FrameScheduler;
  /** Advances the engine one tick — `session.tick` in production. */
  readonly advance: () => void;
}

/**
 * Drives the engine from animation frames. Starts and stops itself from the
 * status and cancels its pending frame on cleanup, so it must be called inside
 * a reactive root.
 */
export function createGameLoop(options: GameLoopOptions): void {
  const { state, rules, frames, advance } = options;

  let scheduled: number | undefined;
  let previousMs: number | undefined;
  let accumulated = 0;
  // A plain mirror of the tracked status: the frame callback is not a tracked
  // scope, so it must never read a signal.
  let isRunning = false;

  const onFrame = (timeMs: number): void => {
    scheduled = undefined;

    if (previousMs === undefined) {
      // First frame of a run only starts the clock, so a round never inherits
      // the wall time that passed while it was idle or paused.
      previousMs = timeMs;
    } else {
      accumulated += timeMs - previousMs;
      previousMs = timeMs;

      // Re-derived every frame: this is the one place the boost multiplier is
      // applied (ADR 0004), so nothing here restates 1.6.
      const interval = tickIntervalMs(state(), rules);

      if (accumulated >= interval) {
        // One tick per frame, and `%` drops a backlog rather than carrying it:
        // frames arrive an order of magnitude faster than ticks, so a
        // multi-interval gap means the tab was asleep, not that the snake owes
        // the player twenty moves into a wall.
        accumulated %= interval;
        advance();
      }
    }

    if (isRunning && scheduled === undefined) {
      scheduled = frames.requestAnimationFrame(onFrame);
    }
  };

  // Only the status is tracked, so a tick does not re-enter this effect.
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
    if (scheduled !== undefined) {
      frames.cancelAnimationFrame(scheduled);
      scheduled = undefined;
    }
  });
}
