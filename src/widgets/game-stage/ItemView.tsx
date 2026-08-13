import { Show } from 'solid-js';
import type { JSX } from 'solid-js';

import type { Item, Point } from '../../entities/game';
import { AppleSprite } from './AppleSprite';
import { BoltSprite } from './BoltSprite';

export interface ItemViewProps {
  readonly kind: Item['kind'];
  readonly at: Point;
}

export function ItemView(props: ItemViewProps): JSX.Element {
  return (
    <div class={`item item--${props.kind}`} style={{ '--x': props.at.x, '--y': props.at.y }}>
      <Show when={props.kind === 'food'} fallback={<BoltSprite />}>
        <AppleSprite />
      </Show>
    </div>
  );
}
