export interface WebStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface KeyValueStore {
  get<T>(key: string, decode: (raw: unknown) => T): T;
  set(key: string, value: unknown): void;
}

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
    /* empty */
  }
}
