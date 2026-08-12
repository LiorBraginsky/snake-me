import { describe, expect, it } from 'vitest';

import {
  createInitialState,
  restart,
  start,
  tick,
  tickIntervalMs,
  togglePause,
  turn,
} from './engine';
import { createSeededRng } from './rng';
import type { Rng } from './rng';
import { DEFAULT_RULES } from './rules';
import type { Rules } from './rules';
import type { GameState } from './types';

/** A 5x5 board keeps spawn and wall arithmetic checkable by hand. */
const TINY: Rules = { ...DEFAULT_RULES, cols: 5, rows: 5 };

/**
 * Returns the scripted draws, then throws. Throwing is the point: scripting N
 * draws asserts the engine makes exactly N, which is how the tick phase order
 * (plan D13) stays pinned.
 */
function stubRng(values: readonly number[]): Rng & { calls: () => number } {
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
    calls: () => index,
  };
}

/**
 * A running round on the 5x5 board: snake heading right along y = 2 from
 * (2,2), apple parked at (4,0) where the default path never reaches it, so a
 * plain tick consumes no draws.
 */
function running(overrides: Partial<GameState> = {}): GameState {
  const base: GameState = {
    status: 'running',
    snake: [
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ],
    direction: 'right',
    queue: [],
    food: { kind: 'food', at: { x: 4, y: 0 } },
    boost: undefined,
    score: 0,
    boostTicksRemaining: 0,
  };

  return { ...base, ...overrides };
}

describe('lifecycle', () => {
  it('starts idle, centered, heading right, three segments long', () => {
    const state = createInitialState(DEFAULT_RULES, stubRng([0]));

    expect(state.status).toBe('idle');
    expect(state.direction).toBe('right');
    expect(state.snake).toEqual([
      { x: 12, y: 8 },
      { x: 11, y: 8 },
      { x: 10, y: 8 },
    ]);
    expect(state.score).toBe(0);
    expect(state.queue).toEqual([]);
    expect(state.boost).toBeUndefined();
    expect(state.boostTicksRemaining).toBe(0);
  });

  it('takes its starting direction from the rules, not from a hardcoded one', () => {
    const state = createInitialState({ ...DEFAULT_RULES, initialDirection: 'down' }, stubRng([0]));

    expect(state.direction).toBe('down');
  });

  it('places the first apple with one draw, on a cell the snake does not hold', () => {
    expect(createInitialState(DEFAULT_RULES, stubRng([0])).food).toEqual({
      kind: 'food',
      at: { x: 0, y: 0 },
    });

    // A draw that discriminates: the snake's three cells are excluded, so the
    // free list is 381 long and floor(0.53 * 381) = 201 -> (9,8). Spread over
    // all 384 cells the same draw would give (11,8) — a snake segment — so this
    // is what pins that the apple never spawns under the snake.
    expect(createInitialState(DEFAULT_RULES, stubRng([0.53])).food).toEqual({
      kind: 'food',
      at: { x: 9, y: 8 },
    });
  });

  it('begins a round from idle, and from nowhere else', () => {
    const idle = createInitialState(DEFAULT_RULES, stubRng([0]));
    const started = start(idle);
    const paused = togglePause(started);
    const over: GameState = { ...started, status: 'game-over' };

    expect(started.status).toBe('running');
    expect(start(started)).toBe(started);
    expect(start(paused)).toBe(paused);
    // A finished round must never resume: `start` here would hand back the dead
    // snake with its score intact instead of requiring a `restart`.
    expect(start(over)).toBe(over);
  });

  it('toggles pause both ways', () => {
    const started = start(createInitialState(DEFAULT_RULES, stubRng([0])));
    const paused = togglePause(started);

    expect(paused.status).toBe('paused');
    expect(togglePause(paused).status).toBe('running');
  });

  it('ignores togglePause while idle or after game over', () => {
    const idle = createInitialState(DEFAULT_RULES, stubRng([0]));
    const over: GameState = { ...idle, status: 'game-over' };

    expect(togglePause(idle)).toBe(idle);
    expect(togglePause(over)).toBe(over);
  });

  it('neither ticks nor queues input while idle', () => {
    const idle = createInitialState(DEFAULT_RULES, stubRng([0]));

    expect(tick(idle, DEFAULT_RULES, stubRng([]))).toBe(idle);
    expect(turn(idle, DEFAULT_RULES, 'up')).toBe(idle);
  });

  it('neither ticks nor queues input while paused', () => {
    const paused = togglePause(start(createInitialState(DEFAULT_RULES, stubRng([0]))));

    expect(tick(paused, DEFAULT_RULES, stubRng([]))).toBe(paused);
    expect(turn(paused, DEFAULT_RULES, 'up')).toBe(paused);
  });

  it('neither ticks nor queues input after game over', () => {
    const over: GameState = { ...running(), status: 'game-over' };

    expect(tick(over, TINY, stubRng([]))).toBe(over);
    expect(turn(over, TINY, 'up')).toBe(over);
  });

  it('restart hands back a fresh running round', () => {
    const fresh = restart(DEFAULT_RULES, stubRng([0]));

    expect(fresh.status).toBe('running');
    expect(fresh.score).toBe(0);
    expect(fresh.snake).toHaveLength(3);
    expect(fresh.queue).toEqual([]);
    expect(fresh.boost).toBeUndefined();
    expect(fresh.boostTicksRemaining).toBe(0);
  });
});

describe('turn', () => {
  it('queues a legal turn', () => {
    expect(turn(running(), TINY, 'up').queue).toEqual(['up']);
  });

  it('queues two quick turns, in order', () => {
    const state = turn(turn(running(), TINY, 'up'), TINY, 'left');

    expect(state.queue).toEqual(['up', 'left']);
  });

  it('drops a third turn — the queue is two deep', () => {
    let state = turn(running(), TINY, 'up');
    state = turn(state, TINY, 'left');
    const full = state;
    state = turn(state, TINY, 'down');

    expect(state.queue).toEqual(['up', 'left']);
    expect(state).toBe(full);
  });

  it('rejects a 180° turn against the current direction', () => {
    const state = running();

    expect(turn(state, TINY, 'left').queue).toEqual([]);
    // By reference, not a clone: chunk 03 feeds this into a Solid signal, so a
    // fresh object would re-render the board on every repeat of a held key.
    expect(turn(state, TINY, 'left')).toBe(state);
  });

  it('rejects a 180° turn against the last queued direction', () => {
    // right -> up is legal, but up -> down would reverse into the neck on the
    // following tick, so it must be rejected while `up` is still queued.
    const state = turn(running(), TINY, 'up');

    expect(turn(state, TINY, 'down').queue).toEqual(['up']);
    expect(turn(state, TINY, 'down')).toBe(state);
  });

  it('ignores a turn that repeats the queued direction', () => {
    const state = turn(running(), TINY, 'up');

    expect(turn(state, TINY, 'up').queue).toEqual(['up']);
    expect(turn(state, TINY, 'up')).toBe(state);
  });

  it('ignores a turn in the direction the snake already travels', () => {
    const state = running();

    expect(turn(state, TINY, 'right').queue).toEqual([]);
    expect(turn(state, TINY, 'right')).toBe(state);
  });
});

describe('tickIntervalMs', () => {
  it('is the base interval with no boost active', () => {
    expect(tickIntervalMs(running(), DEFAULT_RULES)).toBe(150);
  });

  it('is the boosted interval while the effect lasts', () => {
    // 150 / 1.6 is 93.749999... in binary floating point, hence toBeCloseTo.
    expect(tickIntervalMs(running({ boostTicksRemaining: 1 }), DEFAULT_RULES)).toBeCloseTo(93.75);
  });
});

describe('tick — movement', () => {
  it('moves the head one cell and drags the tail', () => {
    const next = tick(running(), TINY, stubRng([]));

    expect(next.snake).toEqual([
      { x: 3, y: 2 },
      { x: 2, y: 2 },
      { x: 1, y: 2 },
    ]);
    expect(next.score).toBe(0);
    expect(next.status).toBe('running');
  });

  it('consumes one queued turn per tick, in order', () => {
    let state = turn(turn(running(), TINY, 'up'), TINY, 'left');

    state = tick(state, TINY, stubRng([]));
    expect(state.direction).toBe('up');
    expect(state.queue).toEqual(['left']);
    expect(state.snake[0]).toEqual({ x: 2, y: 1 });

    state = tick(state, TINY, stubRng([]));
    expect(state.direction).toBe('left');
    expect(state.queue).toEqual([]);
    expect(state.snake[0]).toEqual({ x: 1, y: 1 });
  });
});

describe('tick — collisions', () => {
  it('ends the round when the head leaves the board, changing nothing else', () => {
    const state = running({
      snake: [
        { x: 4, y: 2 },
        { x: 3, y: 2 },
        { x: 2, y: 2 },
      ],
      // Both survive the death tick untouched (D12): the queue head is read for
      // the move but not consumed, and the boost counter does not tick down.
      queue: ['right'],
      boostTicksRemaining: 7,
    });

    expect(tick(state, TINY, stubRng([]))).toEqual({ ...state, status: 'game-over' });
  });

  it('ends the round when the head leaves the board through the top', () => {
    // y = 0 is the top row, so one step up is off the board. Covered on its own
    // because `y < rows` and `y >= 0` are separate halves of the wall check.
    const state = running({
      snake: [
        { x: 2, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 0 },
      ],
      direction: 'up',
    });

    expect(tick(state, TINY, stubRng([]))).toEqual({ ...state, status: 'game-over' });
  });

  it('ends the round when the head runs into its own body', () => {
    // Built directly: `turn` can never produce this, which is the point — the
    // queued reversal walks the head straight back into the neck at (2,1).
    const coiled = running({
      snake: [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 2 },
        { x: 1, y: 2 },
        { x: 0, y: 2 },
      ],
      direction: 'down',
      queue: ['right'],
      boostTicksRemaining: 7,
    });

    expect(tick(coiled, TINY, stubRng([]))).toEqual({ ...coiled, status: 'game-over' });
  });

  it('lets the head enter the cell the tail vacates in the same tick', () => {
    const chasing = running({
      snake: [
        { x: 1, y: 2 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 2 },
      ],
    });

    const next = tick(chasing, TINY, stubRng([]));

    expect(next.status).toBe('running');
    expect(next.snake).toEqual([
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ]);
  });
});

describe('tick — apple', () => {
  it('grows by one segment and scores the apple', () => {
    const state = running({ food: { kind: 'food', at: { x: 3, y: 2 } } });
    // Draws: the new apple's cell, then the boost roll (0.9 fails).
    const next = tick(state, TINY, stubRng([0, 0.9]));

    expect(next.snake).toEqual([
      { x: 3, y: 2 },
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ]);
    expect(next.score).toBe(10);
    expect(next.food).toEqual({ kind: 'food', at: { x: 0, y: 0 } });
  });

  it('respawns the apple on a free cell — never under the snake or the boost', () => {
    const state = running({
      snake: [
        { x: 3, y: 2 },
        { x: 2, y: 2 },
        { x: 1, y: 2 },
      ],
      food: { kind: 'food', at: { x: 4, y: 2 } },
      boost: { kind: 'boost', at: { x: 0, y: 0 }, ttlTicks: 5 },
    });
    // Snake becomes (4,2),(3,2),(2,2),(1,2) and the boost still holds (0,0),
    // so the first free cell in row-major order is (1,0).
    const next = tick(state, TINY, stubRng([0]));

    expect(next.food).toEqual({ kind: 'food', at: { x: 1, y: 0 } });
  });

  it('never respawns the apple on an occupied cell, whatever the draw', () => {
    const state = running({
      snake: [
        { x: 3, y: 2 },
        { x: 2, y: 2 },
        { x: 1, y: 2 },
      ],
      food: { kind: 'food', at: { x: 4, y: 2 } },
      boost: { kind: 'boost', at: { x: 0, y: 0 }, ttlTicks: 5 },
    });
    // The five cells that are taken once the tick resolves: the grown snake
    // plus the boost, which still holds (0,0).
    const occupied = [
      { x: 4, y: 2 },
      { x: 3, y: 2 },
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 0 },
    ];
    const cells = Array.from(
      { length: 100 },
      (_, index) => tick(state, TINY, stubRng([index / 100])).food?.at,
    );

    expect(cells).not.toContainEqual(undefined);
    for (const cell of occupied) {
      expect(cells).not.toContainEqual(cell);
    }
  });

  it('ends the round when eating the last apple leaves no free cell', () => {
    const full: Rules = { ...DEFAULT_RULES, cols: 2, rows: 2 };
    const state: GameState = {
      status: 'running',
      snake: [
        { x: 1, y: 1 },
        { x: 0, y: 1 },
        { x: 0, y: 0 },
      ],
      direction: 'up',
      queue: [],
      food: { kind: 'food', at: { x: 1, y: 0 } },
      boost: undefined,
      score: 0,
      boostTicksRemaining: 0,
    };

    const next = tick(state, full, stubRng([0.5]));

    expect(next.status).toBe('game-over');
    expect(next.food).toBeUndefined();
    expect(next.score).toBe(10);
    expect(next.snake).toEqual([
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: 0, y: 0 },
    ]);
  });
});

describe('tick — boost', () => {
  it('spawns a boost on a free cell when the roll succeeds', () => {
    const state = running({ food: { kind: 'food', at: { x: 3, y: 2 } } });
    // Draws: apple cell, roll (0.19 < 0.2), boost cell.
    const next = tick(state, TINY, stubRng([0, 0.19, 0]));

    expect(next.food).toEqual({ kind: 'food', at: { x: 0, y: 0 } });
    expect(next.boost).toEqual({ kind: 'boost', at: { x: 1, y: 0 }, ttlTicks: 30 });
  });

  it('spawns no boost when the roll fails at the boundary', () => {
    const state = running({ food: { kind: 'food', at: { x: 3, y: 2 } } });

    expect(tick(state, TINY, stubRng([0, 0.2])).boost).toBeUndefined();
  });

  it('does not roll at all while a boost is already on the board', () => {
    const rng = stubRng([0]);
    const state = running({
      food: { kind: 'food', at: { x: 3, y: 2 } },
      boost: { kind: 'boost', at: { x: 0, y: 0 }, ttlTicks: 5 },
    });

    tick(state, TINY, rng);

    expect(rng.calls()).toBe(1);
  });

  it('ages a boost out one tick at a time and removes it at zero', () => {
    let state = running({ boost: { kind: 'boost', at: { x: 0, y: 0 }, ttlTicks: 3 } });

    state = tick(state, DEFAULT_RULES, stubRng([]));
    expect(state.boost?.ttlTicks).toBe(2);

    state = tick(state, DEFAULT_RULES, stubRng([]));
    expect(state.boost?.ttlTicks).toBe(1);

    state = tick(state, DEFAULT_RULES, stubRng([]));
    expect(state.boost).toBeUndefined();
  });

  it('is still pickable on the last tick of its ttl', () => {
    const state = running({
      snake: [
        { x: 2, y: 2 },
        { x: 1, y: 2 },
        { x: 0, y: 2 },
      ],
      boost: { kind: 'boost', at: { x: 3, y: 2 }, ttlTicks: 1 },
    });

    const next = tick(state, TINY, stubRng([]));

    expect(next.score).toBe(5);
    expect(next.boostTicksRemaining).toBe(53);
  });

  it('extends the effect to full duration instead of stacking it', () => {
    const state = running({
      boost: { kind: 'boost', at: { x: 3, y: 2 }, ttlTicks: 10 },
      boostTicksRemaining: 10,
      score: 100,
    });

    const next = tick(state, TINY, stubRng([]));

    expect(next.boostTicksRemaining).toBe(53);
    expect(next.score).toBe(105);
    expect(next.boost).toBeUndefined();
    expect(next.snake).toHaveLength(3);
  });

  it('counts the active effect down one tick at a time', () => {
    expect(tick(running({ boostTicksRemaining: 2 }), TINY, stubRng([])).boostTicksRemaining).toBe(
      1,
    );
    expect(tick(running(), TINY, stubRng([])).boostTicksRemaining).toBe(0);
  });
});

describe('determinism', () => {
  it('replays an identical round from the same seeds', () => {
    const play = (): GameState => {
      const rng = createSeededRng(7);
      let state = start(createInitialState(DEFAULT_RULES, rng));

      for (let i = 0; i < 7; i += 1) {
        state = tick(state, DEFAULT_RULES, rng);
      }

      return state;
    };

    const first = play();

    expect(first.status).toBe('running');
    expect(first.snake[0]).toEqual({ x: 19, y: 8 });
    expect(first).toEqual(play());
  });

  it('pins a seeded round that spends four draws, as golden literals', () => {
    // Seed 408 is chosen because its whole RNG budget is observable: the first
    // apple lands at (15,8), three cells ahead of the starting head, so tick 3
    // eats it and spends draw 2 on the respawn, draw 3 on a boost roll that
    // succeeds and draw 4 on the boost's cell. The literals below therefore pin
    // the PRNG's actual output, not just that the engine is a pure function of
    // its inputs — swap mulberry32 for another generator and this test fails.
    const play = (): GameState => {
      const rng = createSeededRng(408);
      let state = start(createInitialState(DEFAULT_RULES, rng));

      expect(state.food).toEqual({ kind: 'food', at: { x: 15, y: 8 } });

      for (let i = 0; i < 3; i += 1) {
        state = tick(state, DEFAULT_RULES, rng);
      }

      return state;
    };

    const first = play();

    expect(first.status).toBe('running');
    expect(first.score).toBe(10);
    expect(first.snake).toEqual([
      { x: 15, y: 8 },
      { x: 14, y: 8 },
      { x: 13, y: 8 },
      { x: 12, y: 8 },
    ]);
    expect(first.food).toEqual({ kind: 'food', at: { x: 1, y: 1 } });
    expect(first.boost).toEqual({ kind: 'boost', at: { x: 23, y: 7 }, ttlTicks: 30 });
    expect(first.boostTicksRemaining).toBe(0);
    expect(first).toEqual(play());
  });
});
