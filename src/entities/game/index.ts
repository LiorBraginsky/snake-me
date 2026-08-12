// Public API of the `game` entity (spec §4). Chunks 03, 04 and 05 may import
// only what this file exports — deep imports across a slice boundary are a
// lint error. Board geometry (`board.ts`) is an engine internal and stays in.
//
// This slice imports NOTHING — not `shared`, not npm packages. Enforced by
// `boundaries/dependencies` in eslint.config.js, not by good intentions.
export type {
  BoostItem,
  Direction,
  FoodItem,
  GameState,
  GameStatus,
  Item,
  Point,
  Snake,
} from './types';
export type { Rules } from './rules';
export { DEFAULT_RULES, SCOREBOARD_SIZE } from './rules';
export type { Rng } from './rng';
export { createSeededRng } from './rng';
export {
  createInitialState,
  restart,
  start,
  tick,
  tickIntervalMs,
  togglePause,
  turn,
} from './engine';
export type { ScoreEntry } from './scoreboard';
export { addScore } from './scoreboard';
