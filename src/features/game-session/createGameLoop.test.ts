import { createRoot, createSignal } from 'solid-js';
import { describe, expect, it } from 'vitest';

import { createGameLoop } from './createGameLoop';
import type { FrameScheduler } from './createGameLoop';
import { createGameSession } from './createGameSession';
import { DEFAULT_RULES } from '../../entities/game';
import type { GameState, Rng, Rules } from '../../entities/game';

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
    requests: (): number => requests,
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

export const _windowIsAFrameScheduler = (): FrameScheduler => window;

const TINY: Rules = { ...DEFAULT_RULES, cols: 5, rows: 5 };

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

function withRoot<T>(build: () => T): { value: T; dispose: () => void } {
  let dispose = (): void => {};
  const value = createRoot((disposeRoot) => {
    dispose = disposeRoot;

    return build();
  });

  return { value, dispose };
}

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
    boosted.frames.frame(100);
    expect(boosted.advances()).toBe(1);

    const unboosted = buildLoop(stateFixture());
    unboosted.frames.frame(0);
    unboosted.frames.frame(100);
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

    frames.frame(0);
    frames.frame(150);
    expect(advanceCount).toBe(1);

    setState(stateFixture({ boostTicksRemaining: 5 }));

    frames.frame(250);
    expect(advanceCount).toBe(2);

    dispose();
  });

  it('drops a stalled backlog instead of fast-forwarding it', () => {
    const harness = buildLoop(stateFixture());

    harness.frames.frame(0);
    harness.frames.frame(1000);
    expect(harness.advances()).toBe(1);

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
    harness.frames.frame(100);

    harness.setState(stateFixture({ status: 'paused' }));
    harness.setState(stateFixture({ status: 'running' }));

    harness.frames.frame(1000);
    expect(harness.advances()).toBe(0);

    harness.frames.frame(1100);
    expect(harness.advances()).toBe(0);

    harness.frames.frame(1150);
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
    const frames = fakeMultiSlotFrames();
    const [state, setState] = createSignal(stateFixture());

    const { dispose } = withRoot(() =>
      createGameLoop({
        state,
        rules: TINY,
        frames,
        advance: () => {
          setState(stateFixture({ status: 'paused' }));
          setState(stateFixture({ status: 'running' }));
        },
      }),
    );

    frames.frame(0);
    frames.frame(150);

    expect(frames.pendingCount()).toBe(1);

    dispose();
  });

  it('does not arm a new frame if advance() disposes the loop from inside onFrame', () => {
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

    frames.frame(0);
    const requestsBeforeDispose = frames.requests();

    frames.frame(150);

    expect(frames.requests()).toBe(requestsBeforeDispose);
    expect(frames.isPending()).toBe(false);
  });
});

describe('acceptance — a full game driven end to end by synthetic signals', () => {
  it('runs start, eat, turn, pause, resume, wall death, restart, dispose', () => {
    const ACCEPTANCE: Rules = { ...DEFAULT_RULES, cols: 5, rows: 5, boostSpawnChance: 0 };
    const frames = fakeFrames();
    const rng = stubRng([0.46, 0, 0.5, 0]);

    const { value: session, dispose } = withRoot(() => {
      const built = createGameSession({ rules: ACCEPTANCE, rng });
      createGameLoop({ state: built.state, rules: ACCEPTANCE, frames, advance: built.tick });

      return built;
    });

    expect(session.state().status).toBe('idle');
    expect(session.state().snake[0]).toEqual({ x: 2, y: 2 });
    expect(session.state().food).toEqual({ kind: 'food', at: { x: 3, y: 2 } });

    session.dispatch({ kind: 'confirm' });
    expect(session.state().status).toBe('running');
    expect(frames.isPending()).toBe(true);

    frames.frame(0);

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
    expect(session.state()).toBe(paused);

    session.dispatch({ kind: 'togglePause' });
    expect(session.state().status).toBe('running');
    expect(frames.isPending()).toBe(true);

    frames.frame(1000);
    expect(session.state().snake[0]).toEqual({ x: 3, y: 1 });

    frames.frame(1150);
    expect(session.state().snake[0]).toEqual({ x: 3, y: 0 });

    frames.frame(1300);
    expect(session.state().status).toBe('game-over');
    expect(session.state().score).toBe(10);
    expect(session.state().snake[0]).toEqual({ x: 3, y: 0 });
    expect(frames.isPending()).toBe(false);

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
