import { Show } from 'solid-js';
import type { JSX } from 'solid-js';

import type { Direction, Point } from '../../entities/game';

type SegmentRole = 'head' | 'body' | 'tail';

export interface SnakeSegmentProps {
  readonly at: Point;
  readonly role: SegmentRole;
  /** Head only: which way the face points. */
  readonly direction?: Direction;
}

/**
 * One cell-sized box, placed by transform alone. For an interior segment `at` is
 * a plain value handed over by <For>, so these two custom properties are written
 * once at creation and never again: the engine keeps every surviving segment's
 * Point object identity across a tick.
 */
export function SnakeSegment(props: SnakeSegmentProps): JSX.Element {
  return (
    <div
      class={`snake__segment snake__segment--${props.role}`}
      style={{ '--x': props.at.x, '--y': props.at.y }}
    >
      <Show when={props.role === 'head'}>
        <span class="snake__face" data-direction={props.direction}>
          <span class="snake__eye snake__eye--left" />
          <span class="snake__eye snake__eye--right" />
          <span class="snake__tongue" />
        </span>
      </Show>
    </div>
  );
}
