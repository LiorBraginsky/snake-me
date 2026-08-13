/**
 * The subset of `Storage` this adapter needs. `window.localStorage` satisfies it
 * structurally, so production wiring is one lambda at the composition root and
 * nothing here names an ambient global (ADR 0005, as amended in chunk 05).
 */
export interface WebStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * JSON key-value persistence (spec §7). `get` hands the parsed value to
 * `decode`, and hands it `undefined` for a missing key, unreadable storage or
 * unparseable JSON — so the default is chosen in exactly one place, by the
 * caller who knows the shape. That is the difference between "corrupt JSON
 * falls back" and "valid JSON of the wrong shape crashes the game later".
 */
export interface KeyValueStore {
  get<T>(key: string, decode: (raw: unknown) => T): T;
  set(key: string, value: unknown): void;
}

/**
 * `openStorage` is called once, inside a try: in a blocked-cookies or private
 * context, reading the `localStorage` PROPERTY itself throws, so a store built
 * from an already-dereferenced object could not survive its own construction.
 * Every operation degrades silently — the game must never crash because of
 * storage (spec §7).
 */
export function createWebStorageStore(openStorage: () => WebStorage | undefined): KeyValueStore {
  const storage = open(openStorage);

  return {
    get: (key, decode) => decode(read(storage, key)),
    set: (key, value) => {
      write(storage, key, value);
    },
  };
}

function open(openStorage: () => WebStorage | undefined): WebStorage | undefined {
  try {
    return openStorage();
  } catch {
    // Blocked storage: there is nothing to fall back to but the defaults.
    return undefined;
  }
}

function read(storage: WebStorage | undefined, key: string): unknown {
  if (storage === undefined) {
    return undefined;
  }

  try {
    const raw = storage.getItem(key);

    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    // Missing, unreadable or corrupt: all one case to the caller (spec §7).
    return undefined;
  }
}

function write(storage: WebStorage | undefined, key: string, value: unknown): void {
  if (storage === undefined) {
    return;
  }

  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or private mode. Losing a preference is not worth a crash.
  }
}
