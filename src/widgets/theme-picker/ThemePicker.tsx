import { For } from 'solid-js';
import type { JSX } from 'solid-js';

import { THEME_LIST } from '../../features/theming';
import type { ThemeId } from '../../features/theming';
import { ThemeSwatch } from './ThemeSwatch';

export interface ThemePickerProps {
  readonly activeId: ThemeId;
  readonly onSelect: (id: ThemeId) => void;
}

/**
 * Enumerates the registry rather than a hand-written list, so registry and UI
 * cannot drift apart (ADR 0003). Six independent buttons with plain tab stops:
 * no roving tabindex, so arrows keep steering the snake while a swatch has
 * focus.
 */
export function ThemePicker(props: ThemePickerProps): JSX.Element {
  return (
    <div class="theme-picker" role="group" aria-label="Theme">
      <For each={THEME_LIST}>
        {(theme) => (
          <ThemeSwatch
            theme={theme}
            active={theme.id === props.activeId}
            onSelect={() => props.onSelect(theme.id)}
          />
        )}
      </For>
    </div>
  );
}
