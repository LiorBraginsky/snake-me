import { isOnBoard, isOpposite, pickFreeCell, samePoint, step } from './board';
import type { Rng } from './rng';
import type { Rules } from './rules';
import type { Direction, GameState, Point, Snake } from './types';

export function createInitialState(rules: Rules, rng: Rng): GameState {
  const snake = initialSnake(rules);
  const cell = pickFreeCell(rules, snake, rng);

  return {
    status: 'idle',
    snake,
    direction: 'right',
    queue: [],
    food: cell === undefined ? undefined : { kind: 'food', at: cell },
    boost: undefined,
    score: 0,
    boostTicksRemaining: 0,
  };
}

/** Never auto-starts: only the idle state can begin a round (spec §3). */
export function start(state: GameState): GameState {
  return state.status === 'idle' ? { ...state, status: 'running' } : state;
}

export function togglePause(state: GameState): GameState {
  if (state.status === 'running') {
    return { ...state, status: 'paused' };
  }
  if (state.status === 'paused') {
    return { ...state, status: 'running' };
  }

  return state;
}

/**
 * A fresh round, already running (spec §3: game-over -> running on restart).
 * The finished state carries nothing forward — score resets and the scoreboard
 * lives outside the engine — so it is not a parameter.
 */
export function restart(rules: Rules, rng: Rng): GameState {
  return start(createInitialState(rules, rng));
}

export function turn(state: GameState, rules: Rules, direction: Direction): GameState {
  if (state.status !== 'running' || state.queue.length >= rules.directionQueueDepth) {
    return state;
  }

  // Validated against the direction the snake will be travelling when this
  // turn is applied — the last queued one, not the current one. Otherwise
  // right -> up -> down would enqueue a reversal that kills the snake.
  const previous = state.queue.at(-1) ?? state.direction;
  if (direction === previous || isOpposite(direction, previous)) {
    return state;
  }

  return { ...state, queue: [...state.queue, direction] };
}

/** Spec §4: the interval is derived from the state, never stored in it. */
export function tickIntervalMs(state: GameState, rules: Rules): number {
  return state.boostTicksRemaining > 0
    ? rules.baseTickMs / rules.boostMultiplier
    : rules.baseTickMs;
}

export function tick(state: GameState, rules: Rules, rng: Rng): GameState {
  if (state.status !== 'running') {
    return state;
  }

  const direction = state.queue[0] ?? state.direction;
  const queue = state.queue.slice(1);
  const head = step(state.snake[0], direction);

  // Death is a pure status flip: the snake stays where it was, so nothing
  // downstream has to render a head outside the board or inside a segment.
  if (!isOnBoard(head, rules)) {
    return { ...state, status: 'game-over' };
  }

  const eatsFood = state.food !== undefined && samePoint(head, state.food.at);
  // The tail vacates its cell on this very tick unless the snake grows, so
  // moving into it is legal.
  const body = eatsFood ? state.snake : state.snake.slice(0, -1);

  if (body.some((segment) => samePoint(segment, head))) {
    return { ...state, status: 'game-over' };
  }

  const snake: Snake = [head, ...body];
  let score = state.score;
  let boostTicksRemaining = Math.max(0, state.boostTicksRemaining - 1);
  let boost = state.boost;
  let food = state.food;

  // Pickup before expiry, so a boost is pickable on the last tick of its ttl.
  if (boost !== undefined && samePoint(head, boost.at)) {
    score += rules.boostScore;
    boost = undefined;
    // Extends the effect to its full duration; the multiplier never stacks.
    boostTicksRemaining = rules.boostDurationTicks;
  }

  if (boost !== undefined) {
    const ttlTicks = boost.ttlTicks - 1;
    boost = ttlTicks > 0 ? { ...boost, ttlTicks } : undefined;
  }

  if (eatsFood) {
    score += rules.foodScore;

    // Expiry ran first, so a boost that aged out this tick has already freed
    // its cell for the new apple.
    const occupied: Point[] = boost === undefined ? [...snake] : [...snake, boost.at];
    const foodCell = pickFreeCell(rules, occupied, rng);

    if (foodCell === undefined) {
      // The snake fills the board, so there is nowhere to put the next apple.
      // Spec §3's status set has no `won`, so the round simply ends — with the
      // apple scored and `food` honestly empty.
      return {
        ...state,
        status: 'game-over',
        snake,
        direction,
        queue,
        food: undefined,
        boost,
        score,
        boostTicksRemaining,
      };
    }

    food = { kind: 'food', at: foodCell };

    // 20% chance, and only when the board has no boost on it already: with one
    // sitting there, there is nothing to spawn, so no draw is made either.
    if (boost === undefined && rng.next() < rules.boostSpawnChance) {
      const boostCell = pickFreeCell(rules, [...occupied, foodCell], rng);
      boost =
        boostCell === undefined
          ? undefined
          : { kind: 'boost', at: boostCell, ttlTicks: rules.boostTtlTicks };
    }
  }

  return { ...state, snake, direction, queue, food, boost, score, boostTicksRemaining };
}

function initialSnake(rules: Rules): Snake {
  // "Centered" is arithmetic on the board, not a tunable rule: the halving
  // below is the definition of a centre, not a gameplay number.
  const y = Math.floor(rules.rows / 2);
  const headX = Math.floor(rules.cols / 2);
  const body: Point[] = [];

  for (let offset = 1; offset < rules.initialSnakeLength; offset += 1) {
    body.push({ x: headX - offset, y });
  }

  return [{ x: headX, y }, ...body];
}
