// Public API of `shared/storage`: the KeyValueStore port and its Web Storage
// adapter (spec §4, §7). This slice imports nothing at all, and it names no
// ambient global: the composition root injects `() => window.localStorage`.
export type { KeyValueStore, WebStorage } from './keyValueStore';
export { createWebStorageStore } from './keyValueStore';
