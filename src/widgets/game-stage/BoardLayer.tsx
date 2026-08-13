import type { JSX } from 'solid-js';

import type { BoardStyle } from '../../features/theming';

export interface BoardLayerProps {
  readonly boardStyle: BoardStyle;
}

export function BoardLayer(props: BoardLayerProps): JSX.Element {
  return (
    <div
      class="stage__layer stage__layer--board"
      data-board-style={props.boardStyle}
      aria-hidden="true"
    />
  );
}
