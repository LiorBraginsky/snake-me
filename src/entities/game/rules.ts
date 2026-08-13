import type { Direction } from './types';

const BOARD_WIDTH = 24;
const BOARD_HEIGHT = 16;

const BASE_TICK_MS = 150;
const BOOST_MULTIPLIER = 1.6;
const BOOST_DURATION_MS = 5000;

const BOOST_DURATION_TICKS = Math.round(BOOST_DURATION_MS / (BASE_TICK_MS / BOOST_MULTIPLIER));

const BOOST_TTL_TICKS = 30;
const BOOST_SPAWN_CHANCE = 0.2;

const FOOD_SCORE = 10;
const BOOST_SCORE = 5;

const INITIAL_SNAKE_LENGTH = 3;
const INITIAL_DIRECTION: Direction = 'right';

const DIRECTION_QUEUE_DEPTH = 2;

export const SCOREBOARD_SIZE = 5;

export interface Rules {
  readonly cols: number;
  readonly rows: number;
  readonly baseTickMs: number;
  readonly boostMultiplier: number;
  readonly boostDurationTicks: number;
  readonly boostTtlTicks: number;
  readonly boostSpawnChance: number;
  readonly foodScore: number;
  readonly boostScore: number;
  readonly initialSnakeLength: number;
  readonly initialDirection: Direction;
  readonly directionQueueDepth: number;
}

export const DEFAULT_RULES: Rules = {
  cols: BOARD_WIDTH,
  rows: BOARD_HEIGHT,
  baseTickMs: BASE_TICK_MS,
  boostMultiplier: BOOST_MULTIPLIER,
  boostDurationTicks: BOOST_DURATION_TICKS,
  boostTtlTicks: BOOST_TTL_TICKS,
  boostSpawnChance: BOOST_SPAWN_CHANCE,
  foodScore: FOOD_SCORE,
  boostScore: BOOST_SCORE,
  initialSnakeLength: INITIAL_SNAKE_LENGTH,
  initialDirection: INITIAL_DIRECTION,
  directionQueueDepth: DIRECTION_QUEUE_DEPTH,
};
