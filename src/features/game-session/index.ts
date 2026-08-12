// Public API of the `game-session` feature: createGameSession, createGameLoop
// (spec §4). Impurity — rng, rules, frames, key target — is injected by the
// composition root; nothing here reaches for a global (ADR 0005).
export type { GameSession, GameSessionOptions } from './createGameSession';
export { createGameSession } from './createGameSession';
export type { FrameScheduler, GameLoopOptions } from './createGameLoop';
export { createGameLoop } from './createGameLoop';
