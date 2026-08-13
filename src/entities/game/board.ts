import type { Rng } from './rng';
import type { Rules } from './rules';
import type { Direction, Point } from './types';

const STEP: Readonly<Record<Direction, Point>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

export function step(from: Point, direction: Direction): Point {
  const delta = STEP[direction];

  return { x: from.x + delta.x, y: from.y + delta.y };
}

export function isOnBoard(point: Point, rules: Rules): boolean {
  return point.x >= 0 && point.x < rules.cols && point.y >= 0 && point.y < rules.rows;
}

export function isOpposite(a: Direction, b: Direction): boolean {
  const one = STEP[a];
  const other = STEP[b];

  return one.x + other.x === 0 && one.y + other.y === 0;
}

export function freeCells(rules: Rules, occupied: readonly Point[]): readonly Point[] {
  const taken = new Set(occupied.map(cellKey));
  const free: Point[] = [];

  for (let y = 0; y < rules.rows; y += 1) {
    for (let x = 0; x < rules.cols; x += 1) {
      const cell = { x, y };
      if (!taken.has(cellKey(cell))) {
        free.push(cell);
      }
    }
  }

  return free;
}

export function pickFreeCell(
  rules: Rules,
  occupied: readonly Point[],
  rng: Rng,
): Point | undefined {
  const free = freeCells(rules, occupied);

  return free[Math.floor(rng.next() * free.length)];
}

function cellKey(point: Point): string {
  return `${point.x},${point.y}`;
}
