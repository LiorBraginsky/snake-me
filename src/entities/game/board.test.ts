import { describe, expect, it } from 'vitest';

import { freeCells, isOnBoard, isOpposite, pickFreeCell, samePoint, step } from './board';
import type { Rng } from './rng';
import { DEFAULT_RULES } from './rules';
import type { Rules } from './rules';

const TINY: Rules = { ...DEFAULT_RULES, cols: 3, rows: 3 };

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

describe('board geometry', () => {
  it('steps one cell per direction, with y growing downward', () => {
    expect(step({ x: 5, y: 5 }, 'up')).toEqual({ x: 5, y: 4 });
    expect(step({ x: 5, y: 5 }, 'down')).toEqual({ x: 5, y: 6 });
    expect(step({ x: 5, y: 5 }, 'left')).toEqual({ x: 4, y: 5 });
    expect(step({ x: 5, y: 5 }, 'right')).toEqual({ x: 6, y: 5 });
  });

  it('treats the edges as walls, not as a torus', () => {
    expect(isOnBoard({ x: 0, y: 0 }, DEFAULT_RULES)).toBe(true);
    expect(isOnBoard({ x: 23, y: 15 }, DEFAULT_RULES)).toBe(true);
    expect(isOnBoard({ x: -1, y: 0 }, DEFAULT_RULES)).toBe(false);
    expect(isOnBoard({ x: 24, y: 0 }, DEFAULT_RULES)).toBe(false);
    expect(isOnBoard({ x: 0, y: -1 }, DEFAULT_RULES)).toBe(false);
    expect(isOnBoard({ x: 0, y: 16 }, DEFAULT_RULES)).toBe(false);
  });

  it('recognises reversals and only reversals', () => {
    expect(isOpposite('up', 'down')).toBe(true);
    expect(isOpposite('left', 'right')).toBe(true);
    expect(isOpposite('up', 'up')).toBe(false);
    expect(isOpposite('up', 'left')).toBe(false);
  });

  it('compares points by value', () => {
    expect(samePoint({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
    expect(samePoint({ x: 1, y: 2 }, { x: 2, y: 1 })).toBe(false);
  });
});

describe('freeCells', () => {
  it('lists every unoccupied cell in row-major order', () => {
    const occupied = [
      { x: 0, y: 0 },
      { x: 2, y: 2 },
    ];

    expect(freeCells(TINY, occupied)).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
    ]);
  });
});

describe('pickFreeCell', () => {
  it('maps one draw onto the row-major free list', () => {
    expect(pickFreeCell(TINY, [{ x: 0, y: 0 }], stubRng([0.5]))).toEqual({ x: 2, y: 1 });
  });

  it('picks the first cell on a 0 draw and the last just below 1', () => {
    expect(pickFreeCell(TINY, [], stubRng([0]))).toEqual({ x: 0, y: 0 });
    expect(pickFreeCell(TINY, [], stubRng([0.999999]))).toEqual({ x: 2, y: 2 });
  });

  it('returns undefined on a full board, and still consumes one draw', () => {
    const rng = stubRng([0.5]);

    expect(pickFreeCell(TINY, freeCells(TINY, []), rng)).toBeUndefined();
    expect(rng.calls()).toBe(1);
  });
});
