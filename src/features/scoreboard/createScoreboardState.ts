import { createSignal, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';

import { addScore } from '../../entities/game';
import type { ScoreEntry } from '../../entities/game';
import type { KeyValueStore } from '../../shared/storage';

const SCOREBOARD_STORAGE_KEY = 'snake-me:scoreboard:v1';

export interface ScoreboardStateOptions {
  readonly store: KeyValueStore;
  readonly now: () => string;
}

export interface ScoreboardState {
  readonly entries: Accessor<readonly ScoreEntry[]>;
  readonly record: (score: number) => void;
}

export function createScoreboardState(options: ScoreboardStateOptions): ScoreboardState {
  const [entries, setEntries] = createSignal(
    options.store.get(SCOREBOARD_STORAGE_KEY, decodeScoreboard),
  );

  return {
    entries,
    record: (score) => {
      const next = addScore(untrack(entries), { score, date: options.now() });

      setEntries(next);
      options.store.set(SCOREBOARD_STORAGE_KEY, next);
    },
  };
}

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
