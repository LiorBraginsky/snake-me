import type { JSX } from 'solid-js';

import type { Theme } from '../../features/theming';

export interface ThemeSwatchProps {
  readonly theme: Theme;
  readonly active: boolean;
  readonly onSelect: () => void;
}

/**
 * One theme, as a button. The preview is the only place in the tree that reads
 * token VALUES in JS (ADR 0006): the cascade only ever carries the ACTIVE
 * theme, so a preview of the other five cannot come from `var(--…)`. It is
 * bounded to three tokens and writes its own `--swatch-*` namespace — never the
 * frozen 14, never a geometry property.
 */
export function ThemeSwatch(props: ThemeSwatchProps): JSX.Element {
  return (
    <button
      class="theme-swatch"
      type="button"
      aria-pressed={props.active}
      onClick={() => props.onSelect()}
      onKeyDown={(event) => {
        if (event.key === ' ') {
          // The keyboard adapter listens on `window` and preventDefaults Space,
          // which it maps to "start / play again" (spec §3). This handler runs
          // on the button — below `document`, where Solid delegates keydown, and
          // below `window` — so stopping here leaves Space's native button
          // activation intact and the round untouched. Nothing else the adapter
          // owns (arrows, WASD, P, Esc) has a default action on a <button>, so
          // Space is the only key a swatch takes back (ADR 0005 § Amendment).
          event.stopPropagation();
        }
      }}
    >
      <span
        class="theme-swatch__preview"
        aria-hidden="true"
        style={{
          '--swatch-board': props.theme.tokens.boardCellA,
          '--swatch-snake': props.theme.tokens.snakeBody,
          '--swatch-item': props.theme.tokens.itemFood,
        }}
      />
      {props.theme.label}
    </button>
  );
}
