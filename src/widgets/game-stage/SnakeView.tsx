import { For, Show, createMemo } from 'solid-js';
import type { JSX } from 'solid-js';

import type { Direction, Snake } from '../../entities/game';
import { SnakeSegment } from './SnakeSegment';

export interface SnakeViewProps {
  readonly snake: Snake;
  readonly direction: Direction;
}

export function SnakeView(props: SnakeViewProps): JSX.Element {
  const interior = createMemo(() => props.snake.slice(1, -1));
  const tail = createMemo(() =>
    props.snake.length > 1 ? props.snake[props.snake.length - 1] : undefined,
  );
  const direction = createMemo(() => props.direction);

  return (
    <>
      <SnakeSegment at={props.snake[0]} role="head" direction={direction()} />
      <For each={interior()}>{(segment) => <SnakeSegment at={segment} role="body" />}</For>
      <Show when={tail()}>{(at) => <SnakeSegment at={at()} role="tail" />}</Show>
    </>
  );
}
