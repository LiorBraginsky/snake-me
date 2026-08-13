import { createEffect, createRoot, createSignal } from 'solid-js';
import { describe, expect, it } from 'vitest';

import { createGameSession } from './createGameSession';
import type { GameSession, GameSessionOptions } from './createGameSession';
import { DEFAULT_RULES, createInitialState } from '../../entities/game';
import type { GameState, Rng, Rules } from '../../entities/game';

// `solid-js` maps the `node` export condition to dist/server.js, where
// createEffect is `function createEffect(fn, value) {}` — a no-op. Under
// `environment: 'node'` that build would make every reactive assertion below
// vacuous. This test is the pin: it fails loudly if resolution ever slips.
describe('reactive substrate', () => {
  it('re-runs an effect when a signal is written', () => {
    const runs: number[] = [];
    const harness = createRoot((dispose) => {
      const [count, setCount] = createSignal(0);
      createEffect(() => {
        runs.push(count());
      });

      return { dispose, setCount };
    });

    expect(runs).toEqual([0]);
    harness.setCount(1);
    expect(runs).toEqual([0, 1]);
    harness.dispose();
  });
});

/** A 5x5 board keeps spawn and wall arithmetic checkable by hand, as in engine.test.ts. */
const TINY: Rules = { ...DEFAULT_RULES, cols: 5, rows: 5 };

/** Scripted draws, then throws — an unexpected extra draw is a failure, not a shrug. */
function stubRng(values: readonly number[]): Rng {
  let index = 0;

  return {
    next(): number {
      const value = values[index];
      if (value === undefined) {
        throw new Error(`stub rng exhausted after ${index} draws`);
      }
      index += 1;

      return value;
    },
  };
}

/**
 * Every session test is reactive, so it must be built inside a root — but the
 * root callback is one batch: writes queue and effects do not flush until it
 * returns. Acting and asserting happens outside, against the returned value.
 */
function withRoot<T>(build: () => T): { value: T; dispose: () => void } {
  let dispose = (): void => {};
  const value = createRoot((disposeRoot) => {
    dispose = disposeRoot;

    return build();
  });

  return { value, dispose };
}

function buildSession(options: GameSessionOptions): {
  session: GameSession;
  dispose: () => void;
} {
  const { value, dispose } = withRoot(() => createGameSession(options));

  return { session: value, dispose };
}

/**
 * Same as `buildSession`, plus an effect that records every state the signal
 * notifies — the only way to observe "nobody was notified" from outside.
 */
function buildTrackedSession(options: GameSessionOptions): {
  session: GameSession;
  runs: GameState[];
  dispose: () => void;
} {
  const { value, dispose } = withRoot(() => {
    const session = createGameSession(options);
    const runs: GameState[] = [];
    createEffect(() => {
      runs.push(session.state());
    });

    return { session, runs };
  });

  return { ...value, dispose };
}

describe('createGameSession', () => {
  it('delegates its initial state to createInitialState', () => {
    const { session, dispose } = buildSession({ rules: TINY, rng: stubRng([0]) });

    expect(session.state()).toEqual(createInitialState(TINY, stubRng([0])));
    expect(session.state().status).toBe('idle');
    expect(session.state().snake[0]).toEqual({ x: 2, y: 2 });
    expect(session.state().snake).toHaveLength(3);
    expect(session.state().score).toBe(0);

    dispose();
  });

  it('confirm starts a round from idle', () => {
    const { session, dispose } = buildSession({ rules: TINY, rng: stubRng([0]) });

    session.dispatch({ kind: 'confirm' });

    expect(session.state().status).toBe('running');

    dispose();
  });

  it('a second confirm while running changes nothing and notifies nobody', () => {
    const { session, runs, dispose } = buildTrackedSession({ rules: TINY, rng: stubRng([0]) });

    session.dispatch({ kind: 'confirm' });
    const running = session.state();
    const runsAfterStart = runs.length;

    session.dispatch({ kind: 'confirm' });

    expect(session.state()).toBe(running);
    expect(runs).toHaveLength(runsAfterStart);

    dispose();
  });

  it('togglePause pauses a running round and resumes it', () => {
    const { session, dispose } = buildSession({ rules: TINY, rng: stubRng([0]) });

    session.dispatch({ kind: 'confirm' });
    session.dispatch({ kind: 'togglePause' });
    expect(session.state().status).toBe('paused');

    session.dispatch({ kind: 'togglePause' });
    expect(session.state().status).toBe('running');

    dispose();
  });

  it('confirm while paused changes nothing and notifies nobody', () => {
    const { session, runs, dispose } = buildTrackedSession({ rules: TINY, rng: stubRng([0]) });

    session.dispatch({ kind: 'confirm' });
    session.dispatch({ kind: 'togglePause' });
    const paused = session.state();
    const runsBeforeConfirm = runs.length;

    session.dispatch({ kind: 'confirm' });

    expect(session.state()).toBe(paused);
    expect(runs).toHaveLength(runsBeforeConfirm);

    dispose();
  });

  it('tick is a no-op while paused, by reference', () => {
    const { session, dispose } = buildSession({ rules: TINY, rng: stubRng([0]) });

    session.dispatch({ kind: 'confirm' });
    session.dispatch({ kind: 'togglePause' });
    const paused = session.state();

    session.tick();

    expect(session.state()).toBe(paused);

    dispose();
  });

  it('honors two quick turns, in order, one per tick', () => {
    const { session, dispose } = buildSession({ rules: TINY, rng: stubRng([0]) });

    session.dispatch({ kind: 'confirm' });
    session.dispatch({ kind: 'turn', direction: 'up' });
    session.dispatch({ kind: 'turn', direction: 'left' });

    session.tick();
    expect(session.state().snake[0]).toEqual({ x: 2, y: 1 });

    session.tick();
    expect(session.state().snake[0]).toEqual({ x: 1, y: 1 });

    dispose();
  });

  it('rejects a 180° turn against the current direction, notifying nobody', () => {
    const { session, runs, dispose } = buildTrackedSession({ rules: TINY, rng: stubRng([0]) });

    session.dispatch({ kind: 'confirm' });
    const running = session.state();
    const runsAfterStart = runs.length;

    session.dispatch({ kind: 'turn', direction: 'left' });

    expect(session.state()).toBe(running);
    expect(runs).toHaveLength(runsAfterStart);

    dispose();
  });

  it('confirm on a game-over state restarts a fresh running round', () => {
    const { session, dispose } = buildSession({ rules: TINY, rng: stubRng([0, 0]) });

    session.dispatch({ kind: 'confirm' }); // idle -> running

    // Three ticks along the default heading walk the head off a 5-wide board:
    // (2,2) -> (3,2) -> (4,2) -> off-board at x = 5.
    session.tick();
    session.tick();
    session.tick();
    expect(session.state().status).toBe('game-over');

    session.dispatch({ kind: 'confirm' });

    expect(session.state().status).toBe('running');
    expect(session.state().score).toBe(0);
    expect(session.state().snake).toHaveLength(3);
    expect(session.state().snake[0]).toEqual({ x: 2, y: 2 });

    dispose();
  });

  it('start() begins a round from idle', () => {
    const { session, dispose } = buildSession({ rules: TINY, rng: stubRng([0]) });

    session.start();

    expect(session.state().status).toBe('running');

    dispose();
  });

  it('togglePause() pauses a running round and resumes it', () => {
    const { session, dispose } = buildSession({ rules: TINY, rng: stubRng([0]) });

    session.start();
    session.togglePause();
    expect(session.state().status).toBe('paused');

    session.togglePause();
    expect(session.state().status).toBe('running');

    dispose();
  });

  it('restart() produces a fresh running round from a dirtied running state', () => {
    const { session, dispose } = buildSession({ rules: TINY, rng: stubRng([0, 0]) });

    session.dispatch({ kind: 'confirm' });
    session.tick();
    session.tick();

    // Two ticks along the default heading walk the head off (2,2), and the
    // state object with it — this is the "dirtied" state restart() must undo.
    const dirtied = session.state();
    expect(dirtied.snake[0]).toEqual({ x: 4, y: 2 });

    session.restart();

    expect(session.state()).not.toBe(dirtied);
    expect(session.state().status).toBe('running');
    expect(session.state().score).toBe(0);
    expect(session.state().snake).toHaveLength(3);
    expect(session.state().snake[0]).toEqual({ x: 2, y: 2 });

    dispose();
  });

  it('notifies on real transitions only — three effect runs across two no-ops', () => {
    const { session, runs, dispose } = buildTrackedSession({ rules: TINY, rng: stubRng([0]) });

    session.dispatch({ kind: 'confirm' }); // idle -> running: notifies
    session.dispatch({ kind: 'confirm' }); // already running: no-op
    session.dispatch({ kind: 'turn', direction: 'left' }); // 180°: no-op
    session.tick(); // real tick: notifies

    expect(runs).toHaveLength(3);
    expect(runs[0]?.status).toBe('idle');
    expect(runs[1]?.status).toBe('running');
    expect(runs[2]?.snake[0]).toEqual({ x: 3, y: 2 });

    dispose();
  });
});
