import type { JSX } from 'solid-js';

/**
 * How a theme paints the board (spec §6 / ADR 0003): `checker` alternates the
 * two cell colours, `solid` paints one background. Chunk 05 owns the canonical
 * copy of this union on `Theme.boardStyle` in `features/theming`; it cannot live
 * there yet, because a feature may not import a widget.
 */
export type BoardStyle = 'checker' | 'solid';

export interface BoardLayerProps {
  readonly boardStyle: BoardStyle;
}

/**
 * z0: the static board. It reads no accessor — its only prop chain terminates in
 * a literal at the composition root — so Solid never re-runs it, and the
 * checkerboard is one gradient rather than 384 elements. Both halves of "the
 * board never repaints on a tick" (spec §5, ADR 0001) are therefore structural,
 * not a habit: there is nothing here for a tick to invalidate.
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
