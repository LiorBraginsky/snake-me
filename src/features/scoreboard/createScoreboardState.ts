import { createSignal, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';

import { addScore } from '../../entities/game';
import type { ScoreEntry } from '../../entities/game';
import type { KeyValueStore } from '../../shared/storage';

const SCOREBOARD_STORAGE_KEY = 'snake-me:scoreboard:v1';

export interface ScoreboardStateOptions {
  readonly store: KeyValueStore;
  /**
   * ISO 8601 timestamp supplier. The composition root passes
   * `() => new Date().toISOString()` — this slice is inside
   * `no-restricted-globals`' glob and never reads the clock (ADR 0004, 0005).
   */
  readonly now: () => string;
}

export interface ScoreboardState {
  readonly entries: Accessor<readonly ScoreEntry[]>;
  /** Called once per finished round, by the composition root. */
  readonly record: (score: number) => void;
}

/**
 * The cross-round record (spec §3), restored from storage and written back after
 * every round. Ordering and the top-five cut are `entities/game`'s `addScore` —
 * this slice adds persistence and a signal, never a second copy of the ranking.
 */
export function createScoreboardState(options: ScoreboardStateOptions): ScoreboardState {
  const [entries, setEntries] = createSignal(
    options.store.get(SCOREBOARD_STORAGE_KEY, decodeScoreboard),
  );

  return {
    entries,
    // `untrack`, not `entries()` directly: calling the accessor here would be
    // a subscribe-then-write in the same statement (solid/reactivity) — this
    // codebase's own rule, stated at `createThemeState.ts`'s initial read. It
    // only worked before because `App.tsx` happens to call `record` from
    // inside `on()`, which untracks; a future caller in a tracked scope would
    // subscribe and then write to the same signal, re-entering infinitely.
    record: (score) => {
      const next = addScore(untrack(entries), { score, date: options.now() });

      setEntries(next);
      options.store.set(SCOREBOARD_STORAGE_KEY, next);
    },
  };
}

/**
 * Anything on disk is untrusted: a hand-edited or half-written value can be the
 * wrong type, hold the wrong shapes, or be longer and less sorted than the
 * board ever is. Survivors are re-ranked through `addScore`, so a load can
 * never produce a board the game itself could not have produced (spec §7).
 */
function decodeScoreboard(raw: unknown): readonly ScoreEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  let board: readonly ScoreEntry[] = [];
  for (const value of raw) {
    if (isScoreEntry(value)) {
      board = addScore(board, value);
    }
  }

  return board;
}

function isScoreEntry(value: unknown): value is ScoreEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'score' in value &&
    typeof value.score === 'number' &&
    Number.isFinite(value.score) &&
    'date' in value &&
    typeof value.date === 'string'
  );
}
