import { describe, expect, it } from 'vitest';

import { createThemeState } from './createThemeState';
import { THEME_LIST } from './themes';
import type { Theme } from './types';
import { createWebStorageStore } from '../../shared/storage';

const KEY = 'snake-me:theme:v1';

function fakeWebStorage(seed: Record<string, string> = {}) {
  const cells = new Map(Object.entries(seed));

  return {
    cells,
    getItem: (key: string): string | null => cells.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      cells.set(key, value);
    },
  };
}

function harness(seed: Record<string, string> = {}) {
  const storage = fakeWebStorage(seed);
  const applied: Theme[] = [];
  const state = createThemeState({
    store: createWebStorageStore(() => storage),
    apply: (theme) => applied.push(theme),
  });

  return { storage, applied, state };
}

describe('createThemeState', () => {
  it('starts on dark-checker and applies it once when nothing is stored', () => {
    const { applied, state } = harness();

    expect(state.theme().id).toBe('dark-checker');
    expect(applied.map((theme) => theme.id)).toEqual(['dark-checker']);
  });

  it('starts on the stored theme', () => {
    const { state } = harness({ [KEY]: '"neon"' });

    expect(state.theme().id).toBe('neon');
  });

  it.each(['"nope"', '42', 'null', '{oops'])('falls back to the default for %s', (stored) => {
    expect(harness({ [KEY]: stored }).state.theme().id).toBe('dark-checker');
  });

  it('applies and persists a selection', () => {
    const { storage, applied, state } = harness();

    state.select('light-solid');

    expect(state.theme().boardStyle).toBe('solid');
    expect(applied.map((theme) => theme.id)).toEqual(['dark-checker', 'light-solid']);
    expect(storage.cells.get(KEY)).toBe('"light-solid"');
  });

  it('survives a reload: a second state over the same storage restores the pick', () => {
    const storage = fakeWebStorage();
    const store = createWebStorageStore(() => storage);
    createThemeState({ store, apply: () => undefined }).select('nokia');

    expect(createThemeState({ store, apply: () => undefined }).theme().id).toBe('nokia');
  });

  it('keeps working when storage is unavailable', () => {
    const state = createThemeState({
      store: createWebStorageStore(() => undefined),
      apply: () => undefined,
    });

    state.select('neon');

    expect(state.theme().id).toBe('neon');
  });

  it('exposes every theme to the picker', () => {
    expect(THEME_LIST).toHaveLength(6);
  });
});
