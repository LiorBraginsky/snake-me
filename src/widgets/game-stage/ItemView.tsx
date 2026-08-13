import { Show } from 'solid-js';
import type { JSX } from 'solid-js';

import type { Item, Point } from '../../entities/game';
import { AppleSprite } from './AppleSprite';
import { BoltSprite } from './BoltSprite';

export interface ItemViewProps {
  readonly kind: Item['kind'];
  /**
   * The cell only, deliberately NOT the whole Item: the engine rebuilds the
   * boost object every tick to decrement `ttlTicks` while `at` keeps its
   * identity, so taking the item would make this view churn on a countdown it
   * does not display.
   */
  readonly at: Point;
}

export function ItemView(props: ItemViewProps): JSX.Element {
  return (
    // `item--food` / `item--boost` are a selector hook with no paint of their
    // own — no rule in `entities.css` targets them; the sprite components
    // style themselves.
    <div class={`item item--${props.kind}`} style={{ '--x': props.at.x, '--y': props.at.y }}>
      <Show when={props.kind === 'food'} fallback={<BoltSprite />}>
        <AppleSprite />
      </Show>
    </div>
  );
}
