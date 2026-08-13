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
      onClick={(event) => {
        props.onSelect();

        // Blur only for a real pointer click (`event.detail`, the click
        // count, is >=1 for a mouse and 0 for a keyboard-synthesised
        // activation): a mouse click otherwise leaves the swatch focused, so
        // Space re-activates it instead of reaching the global "start / play
        // again" binding (spec §3), making `GameOverOverlay`'s "Space plays
        // again too" text false until focus moves elsewhere. A keyboard user
        // keeps focus on purpose: they have a visible `:focus-visible` ring,
        // so a swatch holding Space is not surprising, unlike the invisible
        // focus a mouse click leaves behind. That focus does NOT make Space
        // available to the adapter — `onKeyDown` below calls
        // `stopPropagation()` for Space specifically, so while a swatch is
        // focused, Space always activates the swatch and never reaches the
        // adapter (ADR 0005 § Amendment).
        if (event.detail > 0) {
          event.currentTarget.blur();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === ' ') {
          // The keyboard adapter listens on `window`, and Solid delegates
          // `keydown` at `document` — both sit above this button in the
          // bubble path, so calling `stopPropagation()` here (inside the
          // delegated listener Solid attaches at `document`, synthesising the
          // walk up from `event.target`) stops the walk before it reaches
          // either one, leaving Space's native button activation intact and
          // the round untouched. `stopPropagation()` does NOT stop other
          // listeners on the SAME node, so this convention would silently
          // break if `createKeyboardControls` were ever attached to
          // `document` instead of `window` (docs/architecture.md §
          // Enforcement, "Not yet executable"). Nothing else the adapter owns
          // (arrows, WASD, P, Esc) has a default action on a <button>, so
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
