export type Direction = 'up' | 'down' | 'left' | 'right';

export type GameStatus = 'idle' | 'running' | 'paused' | 'game-over';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export type Snake = readonly [Point, ...Point[]];

export interface FoodItem {
  readonly kind: 'food';
  readonly at: Point;
}

export interface BoostItem {
  readonly kind: 'boost';
  readonly at: Point;
  readonly ttlTicks: number;
}

export type Item = FoodItem | BoostItem;

export interface GameState {
  readonly status: GameStatus;
  readonly snake: Snake;
  readonly direction: Direction;
  readonly queue: readonly Direction[];
  readonly food: FoodItem | undefined;
  readonly boost: BoostItem | undefined;
  readonly score: number;
  readonly boostTicksRemaining: number;
}
