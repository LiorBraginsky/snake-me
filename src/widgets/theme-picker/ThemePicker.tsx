import { For } from 'solid-js';
import type { JSX } from 'solid-js';

import { THEME_LIST } from '../../features/theming';
import type { ThemeId } from '../../features/theming';
import { ThemeSwatch } from './ThemeSwatch';

export interface ThemePickerProps {
  readonly activeId: ThemeId;
  readonly onSelect: (id: ThemeId) => void;
}

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
