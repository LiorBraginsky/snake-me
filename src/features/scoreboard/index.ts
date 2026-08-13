// Public API of the `scoreboard` feature: the persisted cross-round record
// (spec §3, §7). Ordering lives in `entities/game`; the ISO date and the store
// are injected, so nothing here reads the clock or a global.
export type { ScoreboardState, ScoreboardStateOptions } from './createScoreboardState';
export { createScoreboardState } from './createScoreboardState';
