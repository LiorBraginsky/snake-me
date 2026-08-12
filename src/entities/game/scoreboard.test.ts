import { describe, expect, it } from 'vitest';

import { SCOREBOARD_SIZE } from './rules';
import { addScore } from './scoreboard';
import type { ScoreEntry } from './scoreboard';

function entry(score: number, hour: string): ScoreEntry {
  return { score, date: `2026-08-13T${hour}:00:00.000Z` };
}

describe('addScore', () => {
  it('orders results by score, highest first', () => {
    const board = addScore(addScore([], entry(10, '10')), entry(30, '11'));

    expect(board.map((result) => result.score)).toEqual([30, 10]);
  });

  it('keeps the older result ahead on a tie, whichever order they arrive in', () => {
    const older = entry(10, '10');
    const newer = entry(10, '11');

    expect(addScore([older], newer)).toEqual([older, newer]);
    expect(addScore([newer], older)).toEqual([older, newer]);
  });

  it('keeps at most SCOREBOARD_SIZE results', () => {
    let board: readonly ScoreEntry[] = [];

    for (let i = 1; i <= 8; i += 1) {
      board = addScore(board, entry(i * 10, `0${i}`));
    }

    expect(board).toHaveLength(SCOREBOARD_SIZE);
    expect(board.map((result) => result.score)).toEqual([80, 70, 60, 50, 40]);
  });

  it('drops a result that does not make the top five', () => {
    const full = [
      entry(50, '01'),
      entry(40, '02'),
      entry(30, '03'),
      entry(20, '04'),
      entry(10, '05'),
    ];

    expect(addScore(full, entry(5, '09'))).toEqual(full);
  });

  it('does not mutate the board it was given', () => {
    const board = [entry(10, '10')];

    addScore(board, entry(20, '11'));

    expect(board).toEqual([entry(10, '10')]);
  });
});
