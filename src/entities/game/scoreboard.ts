import { SCOREBOARD_SIZE } from './rules';

/**
 * One finished round. `date` is an ISO 8601 string supplied by the caller: the
 * slice stays deterministic, so it never reads the clock itself.
 */
export interface ScoreEntry {
  readonly score: number;
  readonly date: string;
}

/**
 * Inserts a result and returns the top SCOREBOARD_SIZE, highest score first.
 * Pure: the input array is never touched.
 */
export function addScore(board: readonly ScoreEntry[], entry: ScoreEntry): readonly ScoreEntry[] {
  return [...board, entry].sort(byRank).slice(0, SCOREBOARD_SIZE);
}

/**
 * Higher score first; a tie goes to the earlier date, so an equal score never
 * displaces the result that got there first. ISO 8601 strings compare
 * chronologically with `<`, and `localeCompare` is deliberately avoided — it
 * is locale-dependent, which would make the ordering depend on the
 * environment. Equal score and date keep insertion order (Array#sort is
 * stable), so an existing entry stays ahead of an identical new one.
 */
function byRank(a: ScoreEntry, b: ScoreEntry): number {
  if (a.score !== b.score) {
    return b.score - a.score;
  }
  if (a.date !== b.date) {
    return a.date < b.date ? -1 : 1;
  }

  return 0;
}
