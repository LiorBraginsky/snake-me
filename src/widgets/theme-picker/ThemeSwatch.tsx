import type { JSX } from 'solid-js';

import type { Theme } from '../../features/theming';

export interface ThemeSwatchProps {
  readonly theme: Theme;
  readonly active: boolean;
  readonly onSelect: () => void;
}

export function ThemeSwatch(props: ThemeSwatchProps): JSX.Element {
  return (
    <button
      class="theme-swatch"
      type="button"
      aria-pressed={props.active}
      onClick={(event) => {
        props.onSelect();

        if (event.detail > 0) {
          event.currentTarget.blur();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === ' ') {
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
