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
    direction: rules.initialDirection,
    queue: [],
    food: cell === undefined ? undefined : { kind: 'food', at: cell },
    boost: undefined,
    score: 0,
    boostTicksRemaining: 0,
  };
}

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

export function restart(rules: Rules, rng: Rng): GameState {
  return start(createInitialState(rules, rng));
}

export function turn(state: GameState, rules: Rules, direction: Direction): GameState {
  if (state.status !== 'running' || state.queue.length >= rules.directionQueueDepth) {
    return state;
  }

  const previous = state.queue.at(-1) ?? state.direction;
  if (direction === previous || isOpposite(direction, previous)) {
    return state;
  }

  return { ...state, queue: [...state.queue, direction] };
}

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

  if (!isOnBoard(head, rules)) {
    return { ...state, status: 'game-over' };
  }

  const eatsFood = state.food !== undefined && samePoint(head, state.food.at);
  const body = eatsFood ? state.snake : state.snake.slice(0, -1);

  if (body.some((segment) => samePoint(segment, head))) {
    return { ...state, status: 'game-over' };
  }

  const snake: Snake = [head, ...body];
  let score = state.score;
  let boostTicksRemaining = Math.max(0, state.boostTicksRemaining - 1);
  let boost = state.boost;
  let food = state.food;

  if (boost !== undefined && samePoint(head, boost.at)) {
    score += rules.boostScore;
    boost = undefined;
    boostTicksRemaining = rules.boostDurationTicks;
  }

  if (boost !== undefined) {
    const ttlTicks = boost.ttlTicks - 1;
    boost = ttlTicks > 0 ? { ...boost, ttlTicks } : undefined;
  }

  if (eatsFood) {
    score += rules.foodScore;

    const occupied: Point[] = boost === undefined ? [...snake] : [...snake, boost.at];
    const foodCell = pickFreeCell(rules, occupied, rng);

    if (foodCell === undefined) {
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
  const y = Math.floor(rules.rows / 2);
  const headX = Math.floor(rules.cols / 2);
  const body: Point[] = [];

  for (let offset = 1; offset < rules.initialSnakeLength; offset += 1) {
    body.push({ x: headX - offset, y });
  }

  return [{ x: headX, y }, ...body];
}
