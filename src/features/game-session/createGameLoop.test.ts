import { createRoot, createSignal } from 'solid-js';
import { describe, expect, it } from 'vitest';

import { createGameLoop } from './createGameLoop';
import type { FrameScheduler } from './createGameLoop';
import { createGameSession } from './createGameSession';
import { DEFAULT_RULES } from '../../entities/game';
import type { GameState, Rng, Rules } from '../../entities/game';

/**
 * A scriptable stand-in for `window`: `requestAnimationFrame` records the
 * callback instead of scheduling it, and `frame()` fires it on command. The
 * ordering inside `frame()` is load-bearing: `pending` is cleared BEFORE the
 * callback runs, so a frame the callback re-requests (the normal case, every
 * running frame re-arms itself) registers as the new pending frame instead of
 * being wiped out by a clear that runs after the callback returns.
 */
function fakeFrames() {
  let nextHandle = 1;
  let pending: { handle: number; callback: (timeMs: number) => void } | undefined;
  let cancels = 0;
  let requests = 0;

  return {
    requestAnimationFrame(callback: (timeMs: number) => void): number {
      const handle = nextHandle;
      nextHandle += 1;
      requests += 1;
      pending = { handle, callback };

      return handle;
    },
    cancelAnimationFrame(handle: number): void {
      cancels += 1;
      if (pending?.handle === handle) {
        pending = undefined;
      }
    },
    isPending: (): boolean => pending !== undefined,
    cancels: (): number => cancels,
    /** Total `requestAnimationFrame` calls across the fake's lifetime. */
    requests: (): number => requests,
    /** Fires the pending frame at `timeMs`. Clearing first is deliberate. */
    frame(timeMs: number): void {
      const current = pending;
      if (current === undefined) {
        throw new Error('no frame is pending');
      }
      pending = undefined;
      current.callback(timeMs);
    },
  };
}

type FakeFrames = ReturnType<typeof fakeFrames>;

/**
 * Unlike `fakeFrames`, which overwrites a single `pending` slot, this tracks
 * every outstanding handle in a `Map` — so a second `requestAnimationFrame`
 * call issued before the first is cancelled shows up as two pending handles
 * instead of silently replacing one fake frame with another. That distinction
 * is the whole point: a real browser keeps both rAF registrations alive as
 * two independent chains — a leaked handle plus a doubled tick rate — which a
 * single-slot fake cannot reveal because the second `requestAnimationFrame`
 * call just clobbers the first one's record.
 */
function fakeMultiSlotFrames() {
  let nextHandle = 1;
  const pending = new Map<number, (timeMs: number) => void>();

  return {
    requestAnimationFrame(callback: (timeMs: number) => void): number {
      const handle = nextHandle;
      nextHandle += 1;
      pending.set(handle, callback);

      return handle;
    },
    cancelAnimationFrame(handle: number): void {
      pending.delete(handle);
    },
    pendingCount: (): number => pending.size,
    /** Fires the SOLE pending frame; throws if there isn't exactly one. */
    frame(timeMs: number): void {
      if (pending.size !== 1) {
        throw new Error(`expected exactly one pending frame, found ${pending.size}`);
      }
      const [handle] = [...pending.keys()];
      if (handle === undefined) {
        throw new Error('no frame is pending');
      }
      const callback = pending.get(handle);
      if (callback === undefined) {
        throw new Error('no frame is pending');
      }
      pending.delete(handle);
      callback(timeMs);
    },
  };
}

/** Compile-time proof, never executed: `window` satisfies `FrameScheduler`. */
export const _windowIsAFrameScheduler = (): FrameScheduler => window;

/** A 5x5 board keeps the acceptance run's spawn arithmetic checkable by hand. */
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
 * Every reactive test is built inside a root — but the root callback is one
 * batch, so acting and asserting happens outside, against the returned value.
 */
function withRoot<T>(build: () => T): { value: T; dispose: () => void } {
  let dispose = (): void => {};
  const value = createRoot((disposeRoot) => {
    dispose = disposeRoot;

    return build();
  });

  return { value, dispose };
}

/**
 * A hand-built state: the timing tests need no engine setup to reach a
 * boosted round, only a status and a `boostTicksRemaining` to derive the
 * interval from.
 */
function stateFixture(overrides: Partial<GameState> = {}): GameState {
  return {
    status: 'running',
    snake: [{ x: 2, y: 2 }],
    direction: 'right',
    queue: [],
    food: undefined,
    boost: undefined,
    score: 0,
    boostTicksRemaining: 0,
    ...overrides,
  };
}

interface Harness {
  readonly frames: FakeFrames;
  readonly setState: (state: GameState) => void;
  readonly advances: () => number;
  readonly dispose: () => void;
}

function buildLoop(initial: GameState): Harness {
  const frames = fakeFrames();
  const [state, setState] = createSignal(initial);
  let advanceCount = 0;

  const { dispose } = withRoot(() => {
    createGameLoop({
      state,
      rules: TINY,
      frames,
      advance: () => {
        advanceCount += 1;
      },
    });
  });

  return { frames, setState, advances: () => advanceCount, dispose };
}

describe('createGameLoop', () => {
  it('requests no frame while idle', () => {
    const harness = buildLoop(stateFixture({ status: 'idle' }));

    expect(harness.frames.isPending()).toBe(false);

    harness.dispose();
  });

  it('requests a frame once the status flips to running', () => {
    const harness = buildLoop(stateFixture({ status: 'idle' }));

    harness.setState(stateFixture({ status: 'running' }));

    expect(harness.frames.isPending()).toBe(true);

    harness.dispose();
  });

  it('the first frame only starts the clock — nothing advances', () => {
    const harness = buildLoop(stateFixture());

    harness.frames.frame(0);

    expect(harness.advances()).toBe(0);

    harness.dispose();
  });

  it('ticks exactly once when a full interval has elapsed', () => {
    const harness = buildLoop(stateFixture());

    harness.frames.frame(0);
    harness.frames.frame(150);

    expect(harness.advances()).toBe(1);

    harness.dispose();
  });

  it('carries the remainder across frames until the interval is reached', () => {
    const harness = buildLoop(stateFixture());

    harness.frames.frame(0);
    harness.frames.frame(149);
    expect(harness.advances()).toBe(0);

    harness.frames.frame(151);
    expect(harness.advances()).toBe(1);

    harness.dispose();
  });

  it('re-derives the interval from the boost state every frame', () => {
    const boosted = buildLoop(stateFixture({ boostTicksRemaining: 5 }));
    boosted.frames.frame(0);
    boosted.frames.frame(100); // 100 >= 150 / 1.6 = 93.75
    expect(boosted.advances()).toBe(1);

    const unboosted = buildLoop(stateFixture());
    unboosted.frames.frame(0);
    unboosted.frames.frame(100); // 100 < 150
    expect(unboosted.advances()).toBe(0);

    boosted.dispose();
    unboosted.dispose();
  });

  it('re-derives the interval from the LIVE signal, not a value pinned at construction', () => {
    const frames = fakeFrames();
    const [state, setState] = createSignal(stateFixture());
    let advanceCount = 0;

    const { dispose } = withRoot(() =>
      createGameLoop({
        state,
        rules: TINY,
        frames,
        advance: () => {
          advanceCount += 1;
        },
      }),
    );

    frames.frame(0); // starts the clock, unboosted
    frames.frame(150); // 150 >= 150: ticks once, accumulated resets to 0
    expect(advanceCount).toBe(1);

    // Boost turns on on the SAME live signal the loop was built with — no new
    // loop, no new state object handed to `createGameLoop`.
    setState(stateFixture({ boostTicksRemaining: 5 }));

    frames.frame(250); // 100ms delta >= 150 / 1.6 = 93.75: must tick now
    expect(advanceCount).toBe(2);

    dispose();
  });

  it('drops a stalled backlog instead of fast-forwarding it', () => {
    const harness = buildLoop(stateFixture());

    harness.frames.frame(0);
    harness.frames.frame(1000);
    expect(harness.advances()).toBe(1);

    // 1000 % 150 = 100: the next tick needs only 50ms more, not another 150.
    harness.frames.frame(1049);
    expect(harness.advances()).toBe(1);
    harness.frames.frame(1050);
    expect(harness.advances()).toBe(2);

    harness.dispose();
  });

  it('pausing cancels the pending frame and requests no more', () => {
    const harness = buildLoop(stateFixture());
    const cancelsBefore = harness.frames.cancels();

    harness.setState(stateFixture({ status: 'paused' }));

    expect(harness.frames.cancels()).toBeGreaterThan(cancelsBefore);
    expect(harness.frames.isPending()).toBe(false);

    harness.dispose();
  });

  it('resuming requests a frame, and the first one after resume advances nothing', () => {
    const harness = buildLoop(stateFixture({ status: 'paused' }));

    harness.setState(stateFixture({ status: 'running' }));
    expect(harness.frames.isPending()).toBe(true);

    harness.frames.frame(500);
    expect(harness.advances()).toBe(0);

    harness.dispose();
  });

  it('resuming resets the accumulator: a stale partial interval is not owed', () => {
    const harness = buildLoop(stateFixture());

    harness.frames.frame(0);
    harness.frames.frame(100); // 100ms into the 150ms interval, unspent at pause

    harness.setState(stateFixture({ status: 'paused' }));
    harness.setState(stateFixture({ status: 'running' }));

    harness.frames.frame(1000); // first frame after resume only starts the clock
    expect(harness.advances()).toBe(0);

    // If the stale 100ms had survived the pause, this +100ms would already
    // reach the 150ms interval. It must not: the first two frames after
    // resume need a FULL 150ms, not the 50ms that was owed before pausing.
    harness.frames.frame(1100);
    expect(harness.advances()).toBe(0);

    harness.frames.frame(1150); // +150ms since the post-resume clock start
    expect(harness.advances()).toBe(1);

    harness.dispose();
  });

  it('stops requesting frames once advance ends the round', () => {
    const frames = fakeFrames();
    const [state, setState] = createSignal(stateFixture());
    const { dispose } = withRoot(() =>
      createGameLoop({
        state,
        rules: TINY,
        frames,
        advance: () => {
          setState(stateFixture({ status: 'game-over' }));
        },
      }),
    );

    frames.frame(0);
    frames.frame(150);

    expect(frames.isPending()).toBe(false);

    dispose();
  });

  it('cancels the pending frame on dispose', () => {
    const harness = buildLoop(stateFixture());

    expect(harness.frames.cancels()).toBe(0);

    harness.dispose();

    expect(harness.frames.cancels()).toBe(1);
    expect(harness.frames.isPending()).toBe(false);
  });

  it('an advance() that flips status re-entrantly leaves exactly one armed frame', () => {
    // `fakeFrames`'s single `pending` slot would hide a leaked second handle
    // by simply overwriting it — this needs every outstanding handle tracked.
    const frames = fakeMultiSlotFrames();
    const [state, setState] = createSignal(stateFixture());

    const { dispose } = withRoot(() =>
      createGameLoop({
        state,
        rules: TINY,
        frames,
        advance: () => {
          // Re-entrant, synchronous status flip from inside the tick this
          // frame is driving — before this frame's own tail decides whether
          // to re-arm itself.
          setState(stateFixture({ status: 'paused' }));
          setState(stateFixture({ status: 'running' }));
        },
      }),
    );

    frames.frame(0); // starts the clock
    frames.frame(150); // ticks -> advance() flips running -> paused -> running

    expect(frames.pendingCount()).toBe(1);

    dispose();
  });

  it('does not arm a new frame if advance() disposes the loop from inside onFrame', () => {
    // `dispose` does not exist until `withRoot` returns, but `advance` has to
    // call it from inside the frame it is disposing — a mutable box breaks
    // that ordering cycle.
    const disposeRef: { current: () => void } = { current: () => {} };
    const frames = fakeFrames();
    const [state] = createSignal(stateFixture());

    const { dispose } = withRoot(() =>
      createGameLoop({
        state,
        rules: TINY,
        frames,
        advance: () => {
          disposeRef.current();
        },
      }),
    );
    disposeRef.current = dispose;

    frames.frame(0); // starts the clock; nothing advances yet
    const requestsBeforeDispose = frames.requests();

    // A full interval elapses: onFrame calls advance(), which disposes the
    // loop's own root mid-callback, before onFrame's tail decides whether to
    // re-arm itself.
    frames.frame(150);

    expect(frames.requests()).toBe(requestsBeforeDispose);
    expect(frames.isPending()).toBe(false);
  });
});

describe('acceptance — a full game driven end to end by synthetic signals', () => {
  it('runs start, eat, turn, pause, resume, wall death, restart, dispose', () => {
    // boostSpawnChance: 0 keeps the boost roll's draw deterministic without
    // ever branching into boost bookkeeping this test does not exercise.
    const ACCEPTANCE: Rules = { ...DEFAULT_RULES, cols: 5, rows: 5, boostSpawnChance: 0 };
    const frames = fakeFrames();
    const rng = stubRng([0.46, 0, 0.5, 0]);

    const { value: session, dispose } = withRoot(() => {
      const built = createGameSession({ rules: ACCEPTANCE, rng });
      createGameLoop({ state: built.state, rules: ACCEPTANCE, frames, advance: built.tick });

      return built;
    });

    // Draw 1 (0.46): the apple, off the snake's row-major free list of 22.
    expect(session.state().status).toBe('idle');
    expect(session.state().snake[0]).toEqual({ x: 2, y: 2 });
    expect(session.state().food).toEqual({ kind: 'food', at: { x: 3, y: 2 } });

    session.dispatch({ kind: 'confirm' });
    expect(session.state().status).toBe('running');
    expect(frames.isPending()).toBe(true);

    frames.frame(0); // starts the clock; nothing advances yet

    // Draws 2 (0) and 3 (0.5): the tick eats, respawns the apple, rolls (and
    // skips, chance 0) a boost.
    frames.frame(150);
    expect(session.state().score).toBe(10);
    expect(session.state().snake).toHaveLength(4);
    expect(session.state().snake[0]).toEqual({ x: 3, y: 2 });
    expect(session.state().food).toEqual({ kind: 'food', at: { x: 0, y: 0 } });

    session.dispatch({ kind: 'turn', direction: 'up' });
    expect(session.state().queue).toEqual(['up']);

    frames.frame(300);
    expect(session.state().snake[0]).toEqual({ x: 3, y: 1 });
    expect(session.state().direction).toBe('up');

    session.dispatch({ kind: 'togglePause' });
    expect(session.state().status).toBe('paused');
    expect(frames.isPending()).toBe(false);
    const paused = session.state();
    expect(session.state()).toBe(paused); // nothing wrote while paused

    session.dispatch({ kind: 'togglePause' });
    expect(session.state().status).toBe('running');
    expect(frames.isPending()).toBe(true);

    frames.frame(1000); // clock restarted: the paused interval is not owed
    expect(session.state().snake[0]).toEqual({ x: 3, y: 1 });

    frames.frame(1150);
    expect(session.state().snake[0]).toEqual({ x: 3, y: 0 });

    frames.frame(1300); // wall death: a pure status flip, no move
    expect(session.state().status).toBe('game-over');
    expect(session.state().score).toBe(10);
    expect(session.state().snake[0]).toEqual({ x: 3, y: 0 });
    expect(frames.isPending()).toBe(false);

    // Draw 4 (0), the last: the restarted round's apple. A fifth draw would
    // throw, which is what pins that no hidden draw crept into this run.
    session.dispatch({ kind: 'confirm' });
    expect(session.state().status).toBe('running');
    expect(session.state().score).toBe(0);
    expect(session.state().snake[0]).toEqual({ x: 2, y: 2 });
    expect(session.state().food).toEqual({ kind: 'food', at: { x: 0, y: 0 } });
    expect(frames.isPending()).toBe(true);

    frames.frame(2000);
    frames.frame(2150);
    expect(session.state().snake[0]).toEqual({ x: 3, y: 2 });

    const cancelsBefore = frames.cancels();
    dispose();
    expect(frames.cancels()).toBeGreaterThan(cancelsBefore);
  });
});
