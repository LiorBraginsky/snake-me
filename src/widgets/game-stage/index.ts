// Public API of the `game-stage` widget. `app` composes exactly one component
// from this slice — GameStage — and the layer stack it owns (BoardLayer,
// EntityLayer, SnakeView, SnakeSegment, ItemView, the sprites and both
// overlays) is internal by construction: every boundaries allow-policy targets
// this file only (docs/architecture.md § Adding a new slice).
export type { BoardStyle } from './BoardLayer';
export type { GameStageProps } from './GameStage';
export { GameStage } from './GameStage';
