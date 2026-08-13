import { describe, expect, it } from 'vitest';

import { createWebStorageStore } from './keyValueStore';
import type { WebStorage } from './keyValueStore';

/** Compile-time proof. Never executed — there is no `localStorage` under vitest's node env. */
export const _localStorageIsAWebStorage = (): WebStorage => localStorage;

/**
 * An in-memory stand-in for `Storage`. Duplicated in the theming and scoreboard
 * tests on purpose: a shared helper would need a home under `src/`, and every
 * file under `src/` must belong to a slice (`boundaries/no-unknown-files`).
 */
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

const asIs = (raw: unknown): unknown => raw;
const orFallback = (raw: unknown): string => (typeof raw === 'string' ? raw : 'fallback');

describe('createWebStorageStore', () => {
  it('reads back what it wrote, as JSON', () => {
    const storage = fakeWebStorage();
    const store = createWebStorageStore(() => storage);

    store.set('k', { a: 1 });

    expect(storage.cells.get('k')).toBe('{"a":1}');
    expect(store.get('k', asIs)).toEqual({ a: 1 });
  });

  it('decodes `undefined` for a missing key', () => {
    const store = createWebStorageStore(() => fakeWebStorage());

    expect(store.get('nope', orFallback)).toBe('fallback');
  });

  it('decodes `undefined` for corrupt JSON', () => {
    const store = createWebStorageStore(() => fakeWebStorage({ k: '{oops' }));

    expect(store.get('k', orFallback)).toBe('fallback');
  });

  it('survives a provider that throws (blocked storage: even the read of the property throws)', () => {
    const store = createWebStorageStore(() => {
      throw new Error('SecurityError');
    });

    expect(store.get('k', orFallback)).toBe('fallback');
    expect(() => store.set('k', 1)).not.toThrow();
  });

  it('survives a provider that returns nothing', () => {
    const store = createWebStorageStore(() => undefined);

    expect(store.get('k', orFallback)).toBe('fallback');
    expect(() => store.set('k', 1)).not.toThrow();
  });

  it('survives a throwing getItem', () => {
    const store = createWebStorageStore(() => ({
      getItem: (): string | null => {
        throw new Error('SecurityError');
      },
      setItem: (): void => undefined,
    }));

    expect(store.get('k', orFallback)).toBe('fallback');
  });

  it('swallows a throwing setItem and keeps working (quota, private mode)', () => {
    const storage = fakeWebStorage({ k: '"stored"' });
    const store = createWebStorageStore(() => ({
      getItem: storage.getItem,
      setItem: (): void => {
        throw new Error('QuotaExceededError');
      },
    }));

    expect(() => store.set('k', 'new')).not.toThrow();
    expect(store.get('k', orFallback)).toBe('stored');
  });
});
