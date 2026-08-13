import type { JSX } from 'solid-js';

import type { BoardStyle } from '../../features/theming';

export interface BoardLayerProps {
  readonly boardStyle: BoardStyle;
}

/**
 * z0: the static board. Its only prop is the active theme's board style, so the
 * component never re-runs and a TICK cannot invalidate it — the one dynamic
 * binding here is the `data-board-style` attribute, and it changes only when the
 * player picks a theme. The checkerboard stays one gradient element rather than
 * 384 nodes (spec §5, ADR 0001).
 */
export function BoardLayer(props: BoardLayerProps): JSX.Element {
  return (
    <div
      class="stage__layer stage__layer--board"
      data-board-style={props.boardStyle}
      aria-hidden="true"
    />
  );
}
