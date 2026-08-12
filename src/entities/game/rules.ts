// Every gameplay number in the game, named exactly once (CLAUDE.md invariant,
// spec §3). No other production file may hold a gameplay literal.

/**
 * Landscape board: 24 columns x 16 rows (spec §3, as amended 2026-08-13).
 * `Rules` exposes them as `cols` / `rows` because that is the vocabulary the
 * CSS grid consumes (`--board-cols` / `--board-rows`, chunk 04).
 */
const BOARD_WIDTH = 24;
const BOARD_HEIGHT = 16;

/** Interval between ticks while unboosted, in milliseconds. */
const BASE_TICK_MS = 150;

/** Speed factor while a boost is active. */
const BOOST_MULTIPLIER = 1.6;

/** Wall-clock duration of the boost effect the tick count is derived from. */
const BOOST_DURATION_MS = 5000;

/**
 * The boost lasts 5 s, but the engine counts ticks, not wall clock (spec §3).
 * A boosted tick lasts BASE_TICK_MS / BOOST_MULTIPLIER = 93.75 ms, so
 * 5000 / 93.75 = 53.33 ticks. Rounded to the nearest whole tick: 53, which is
 * 4968.75 ms — closer to 5 s than 54 ticks (5062.5 ms) would be.
 */
const BOOST_DURATION_TICKS = Math.round(BOOST_DURATION_MS / (BASE_TICK_MS / BOOST_MULTIPLIER));

/** A boost nobody picks up disappears after this many ticks. */
const BOOST_TTL_TICKS = 30;

/** Probability that eating an apple also spawns a boost. */
const BOOST_SPAWN_CHANCE = 0.2;

const FOOD_SCORE = 10;
const BOOST_SCORE = 5;

const INITIAL_SNAKE_LENGTH = 3;

/** Two quick turns between ticks are both honored (spec §3). */
const DIRECTION_QUEUE_DEPTH = 2;

/**
 * Results the scoreboard keeps (spec §3). Not part of `Rules`: it is a
 * cross-round record, not something a round is played by.
 */
export const SCOREBOARD_SIZE = 5;

/**
 * The numbers a round is played by, injected into every transition that needs
 * them. Production code only ever passes `DEFAULT_RULES`; tests shrink the
 * board so spawn and collision arithmetic stays checkable by hand.
 */
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
  directionQueueDepth: DIRECTION_QUEUE_DEPTH,
};
