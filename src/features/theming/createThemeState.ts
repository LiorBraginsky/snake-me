import { createSignal } from 'solid-js';
import type { Accessor } from 'solid-js';

import { DEFAULT_THEME_ID, THEME_LIST, themeById } from './themes';
import type { Theme, ThemeId } from './types';
import type { KeyValueStore } from '../../shared/storage';

const THEME_STORAGE_KEY = 'snake-me:theme:v1';

export interface ThemeStateOptions {
  readonly store: KeyValueStore;
  readonly apply: (theme: Theme) => void;
}

export interface ThemeState {
  readonly theme: Accessor<Theme>;
  readonly select: (id: ThemeId) => void;
}

export function createThemeState(options: ThemeStateOptions): ThemeState {
  const initialId = options.store.get(THEME_STORAGE_KEY, decodeThemeId);
  const [id, setId] = createSignal(initialId);

  const select = (next: ThemeId): void => {
    setId(next);
    options.store.set(THEME_STORAGE_KEY, next);
    options.apply(themeById(next));
  };

  options.apply(themeById(initialId));

  return { theme: () => themeById(id()), select };
}

function decodeThemeId(raw: unknown): ThemeId {
  return THEME_LIST.find((theme) => theme.id === raw)?.id ?? DEFAULT_THEME_ID;
}
