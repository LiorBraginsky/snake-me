import { Show } from 'solid-js';
import type { JSX } from 'solid-js';

import type { BoostItem, Direction, FoodItem, Snake } from '../../entities/game';
import { ItemView } from './ItemView';
import { SnakeView } from './SnakeView';

export interface EntityLayerProps {
  readonly snake: Snake;
  readonly direction: Direction;
  readonly food: FoodItem | undefined;
  readonly boost: BoostItem | undefined;
}

/**
 * Each item goes through a NON-keyed <Show> rather than one <For> over
 * [food, boost]: the engine rebuilds the boost object on every tick to
 * decrement `ttlTicks`, so a reference-keyed <For> would tear the bolt's SVG
 * down and build a new one seven to eleven times a second. A non-keyed <Show>
 * keeps the element for as long as the item exists and forwards only the cell.
 */
export function EntityLayer(props: EntityLayerProps): JSX.Element {
  return (
    <div class="stage__layer stage__layer--entities" aria-hidden="true">
      <SnakeView snake={props.snake} direction={props.direction} />
      <Show when={props.food}>{(food) => <ItemView kind="food" at={food().at} />}</Show>
      <Show when={props.boost}>{(boost) => <ItemView kind="boost" at={boost().at} />}</Show>
    </div>
  );
}
