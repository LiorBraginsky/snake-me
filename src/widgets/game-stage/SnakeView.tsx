import { For, Show, createMemo } from 'solid-js';
import type { JSX } from 'solid-js';

import type { Direction, Snake } from '../../entities/game';
import { SnakeSegment } from './SnakeSegment';

export interface SnakeViewProps {
  readonly snake: Snake;
  readonly direction: Direction;
}

/**
 * Head, interior, tail — three renders instead of one indexed list, because the
 * engine builds each tick's snake as [newHead, ...previousSegments]: every
 * interior Point survives BY REFERENCE, so a reference-keyed <For> inserts one
 * row, removes one row, and never touches the rows in between. That makes a tick
 * cost exactly two transform writes (head and tail) regardless of length. One
 * <For> over the whole snake would work too, but a prepend shifts every index,
 * so N index signals would fire per tick to recompute roles that did not change.
 * <Index> would be strictly wrong here: it keys by position, so all N segments
 * would rewrite their transform every tick.
 */
export function SnakeView(props: SnakeViewProps): JSX.Element {
  const interior = createMemo(() => props.snake.slice(1, -1));
  const tail = createMemo(() =>
    props.snake.length > 1 ? props.snake[props.snake.length - 1] : undefined,
  );
  // Memoized so the head's data-direction attribute effect depends on the
  // VALUE, not on the GameState signal it is drawn from: without this, the
  // only dynamic binding on `.snake__face` re-runs on every tick (7-11x/s)
  // instead of only on an actual turn.
  const direction = createMemo(() => props.direction);

  return (
    <>
      <SnakeSegment at={props.snake[0]} role="head" direction={direction()} />
      <For each={interior()}>{(segment) => <SnakeSegment at={segment} role="body" />}</For>
      <Show when={tail()}>{(at) => <SnakeSegment at={at()} role="tail" />}</Show>
    </>
  );
}
