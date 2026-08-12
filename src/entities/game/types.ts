// Vocabulary of the game core (spec §3, §4). Every field is readonly: engine
// transitions return new objects and never mutate their input.

export type Direction = 'up' | 'down' | 'left' | 'right';

export type GameStatus = 'idle' | 'running' | 'paused' | 'game-over';

export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Snake segments, head first. A non-empty readonly tuple on purpose: `snake[0]`
 * then typechecks as `Point` even under `noUncheckedIndexedAccess`, so the
 * engine never needs a non-null assertion or an unreachable throw to read the
 * head.
 */
export type Snake = readonly [Point, ...Point[]];

export interface FoodItem {
  readonly kind: 'food';
  readonly at: Point;
}

export interface BoostItem {
  readonly kind: 'boost';
  readonly at: Point;
  /** Ticks the boost stays on the board before it ages out. */
  readonly ttlTicks: number;
}

/** What the view layer renders: one component, two kinds (spec §5). */
export type Item = FoodItem | BoostItem;

export interface GameState {
  readonly status: GameStatus;
  readonly snake: Snake;
  readonly direction: Direction;
  /** Pending turns, oldest first. Never longer than `Rules.directionQueueDepth`. */
  readonly queue: readonly Direction[];
  /** The single apple. `undefined` only when the snake fills the board. */
  readonly food: FoodItem | undefined;
  /** At most one boost is ever on the board. */
  readonly boost: BoostItem | undefined;
  readonly score: number;
  /** Ticks the speed multiplier still applies for. 0 = no boost active. */
  readonly boostTicksRemaining: number;
}
