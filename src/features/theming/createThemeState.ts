import { createSignal } from 'solid-js';
import type { Accessor } from 'solid-js';

import { DEFAULT_THEME_ID, THEME_LIST, themeById } from './themes';
import type { Theme, ThemeId } from './types';
import type { KeyValueStore } from '../../shared/storage';

const THEME_STORAGE_KEY = 'snake-me:theme:v1';

export interface ThemeStateOptions {
  readonly store: KeyValueStore;
  /**
   * Where a theme becomes paint. Production passes `applyTheme`; a test passes a
   * recorder. This is the seam that keeps the slice's logic half runnable under
   * vitest's `node` environment — there is no jsdom in this project.
   */
  readonly apply: (theme: Theme) => void;
}

export interface ThemeState {
  readonly theme: Accessor<Theme>;
  readonly select: (id: ThemeId) => void;
}

/**
 * The active theme, restored from storage and applied before the first paint
 * (`App`'s body runs synchronously inside `render()`), then re-applied on every
 * selection. `select` is the only writer, so there is no `createEffect` here: an
 * effect would add a reactive hop and an owner requirement to a two-line
 * imperative sequence.
 */
export function createThemeState(options: ThemeStateOptions): ThemeState {
  // Read once, outside the signal: calling the accessor itself here (rather
  // than using the value already in hand) is a read outside any tracked scope
  // (solid/reactivity) — the same reason `createGameSession` never calls its
  // own `state()` and only ever writes through updaters.
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

/**
 * Valid JSON is not a valid theme id: `"nope"` would index the registry to
 * `undefined` and crash the first switch. Membership is checked against the
 * registry itself, so a new theme needs no edit here (spec §7's silent
 * fallback).
 */
function decodeThemeId(raw: unknown): ThemeId {
  return THEME_LIST.find((theme) => theme.id === raw)?.id ?? DEFAULT_THEME_ID;
}
