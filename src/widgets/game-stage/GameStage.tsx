import type { JSX } from 'solid-js';

import type { GameState } from '../../entities/game';
import { BoardLayer } from './BoardLayer';
import type { BoardStyle } from './BoardLayer';
import { EntityLayer } from './EntityLayer';

export interface GameStageProps {
  /** Board width in cells. The composition root passes `DEFAULT_RULES.cols`. */
  readonly cols: number;
  /** Board height in cells. The composition root passes `DEFAULT_RULES.rows`. */
  readonly rows: number;
  readonly boardStyle: BoardStyle;
  readonly state: GameState;
  readonly onStart: () => void;
  readonly onRestart: () => void;
}

/**
 * The layer stack, and the geometry root: this element is the container query
 * container the whole stage measures itself against, and the one place the board
 * dimensions cross from `entities/game/rules.ts` into CSS. `--cell-size` is
 * derived from these two in `stage.css` — nothing here measures the DOM.
 */
export function GameStage(props: GameStageProps): JSX.Element {
  return (
    <div class="stage" style={{ '--board-cols': props.cols, '--board-rows': props.rows }}>
      <BoardLayer boardStyle={props.boardStyle} />
      <EntityLayer
        snake={props.state.snake}
        direction={props.state.direction}
        food={props.state.food}
        boost={props.state.boost}
      />
    </div>
  );
}
