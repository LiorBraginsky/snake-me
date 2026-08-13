import { SCOREBOARD_SIZE } from './rules';

export interface ScoreEntry {
  readonly score: number;
  readonly date: string;
}

export function addScore(board: readonly ScoreEntry[], entry: ScoreEntry): readonly ScoreEntry[] {
  return [...board, entry].sort(byRank).slice(0, SCOREBOARD_SIZE);
}

function byRank(a: ScoreEntry, b: ScoreEntry): number {
  if (a.score !== b.score) {
    return b.score - a.score;
  }
  if (a.date !== b.date) {
    return a.date < b.date ? -1 : 1;
  }

  return 0;
}
