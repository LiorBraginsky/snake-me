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
