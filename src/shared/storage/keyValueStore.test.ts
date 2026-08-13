import { describe, expect, it } from 'vitest';

import { createWebStorageStore } from './keyValueStore';
import type { WebStorage } from './keyValueStore';

/** Compile-time proof. Never executed — there is no `localStorage` under vitest's node env. */
export const _localStorageIsAWebStorage = (): WebStorage => localStorage;

/**
 * An in-memory stand-in for `Storage`. Duplicated in the theming and scoreboard
 * tests on purpose — NOT because a shared helper has nowhere to live: a
 * top-level `test/` directory already exists (`test/toolchain.test.ts`), is in
 * `vite.config.ts`'s and `tsconfig.json`'s includes, and sits outside
 * `boundaries`' `src/**` glob, so a shared fixture could be added there
 * without touching the architecture. The real reason is colocation: each test
 * file stays readable and self-contained with its own ten-line fixture,
 * instead of asking a reader to jump to a shared module to understand what
 * `fakeWebStorage` does.
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

  it('hands `decode` the value `undefined` itself for a missing key, not `null`', () => {
    // `orFallback` above can't tell `undefined` and `null` apart (neither is a
    // string), so it would pass even if `read()` returned `null` — which is
    // exactly what `JSON.parse(raw as string)` does for a missing key, since
    // `JSON.parse(null)` coerces to `JSON.parse("null")` and returns `null`.
    // The port's contract (spec §7) is `undefined`, specifically.
    const store = createWebStorageStore(() => fakeWebStorage());

    expect(store.get('nope', asIs)).toBeUndefined();
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
