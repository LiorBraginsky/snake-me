import { describe, expect, it } from 'vitest';

import { createScoreboardState } from './createScoreboardState';
import { createWebStorageStore } from '../../shared/storage';

const KEY = 'snake-me:scoreboard:v1';

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
  let stamp = 0;
  const state = createScoreboardState({
    store: createWebStorageStore(() => storage),
    now: () => {
      stamp += 1;

      return `2026-08-13T0${stamp}:00:00.000Z`;
    },
  });

  return { storage, state };
}

describe('createScoreboardState', () => {
  it('starts empty', () => {
    expect(harness().state.entries()).toEqual([]);
  });

  it('records a round with the injected date and persists it', () => {
    const { storage, state } = harness();

    state.record(30);

    expect(state.entries()).toEqual([{ score: 30, date: '2026-08-13T01:00:00.000Z' }]);
    expect(storage.cells.get(KEY)).toBe('[{"score":30,"date":"2026-08-13T01:00:00.000Z"}]');
  });

  it('keeps the top five, highest first (ordering is addScore, not restated here)', () => {
    const { state } = harness();

    for (const score of [10, 70, 30, 90, 50, 20]) {
      state.record(score);
    }

    expect(state.entries().map((entry) => entry.score)).toEqual([90, 70, 50, 30, 20]);
  });

  it('survives a reload: a second state over the same storage sees the results', () => {
    const storage = fakeWebStorage();
    const store = createWebStorageStore(() => storage);
    const now = (): string => '2026-08-13T01:00:00.000Z';
    createScoreboardState({ store, now }).record(40);

    expect(createScoreboardState({ store, now }).entries()).toEqual([
      { score: 40, date: '2026-08-13T01:00:00.000Z' },
    ]);
  });

  it.each(['{oops', '"not an array"', '42', 'null'])('falls back to empty for %s', (stored) => {
    expect(harness({ [KEY]: stored }).state.entries()).toEqual([]);
  });

  it('drops entries of the wrong shape and re-ranks what is left', () => {
    // Hand-written JSON, not `JSON.stringify`: `1e999` is a valid JSON number
    // literal that overflows to `Infinity` once parsed — `JSON.stringify`
    // could never produce it from a JS value (it serialises `Infinity` to
    // `null`), so the only way to feed it to the decoder is as raw text.
    const stored =
      '[' +
      '{"score":10,"date":"2026-08-13T01:00:00.000Z"},' +
      '{"score":"high","date":"2026-08-13T02:00:00.000Z"},' +
      '{"date":"2026-08-13T03:00:00.000Z"},' +
      '{"score":50},' + // no date at all
      '{"score":50,"date":42},' + // date present, but not a string
      '{"score":1e999,"date":"2026-08-13T05:00:00.000Z"},' + // valid JSON, parses to Infinity
      '{"score":80,"date":"2026-08-13T04:00:00.000Z"}' +
      ']';

    expect(
      harness({ [KEY]: stored })
        .state.entries()
        .map((entry) => entry.score),
    ).toEqual([80, 10]);
  });

  it('normalises an over-long unsorted stored list to the sorted top five', () => {
    const stored = JSON.stringify(
      [10, 80, 20, 90, 30, 70, 40].map((score, index) => ({
        score,
        date: `2026-08-13T0${index}:00:00.000Z`,
      })),
    );

    expect(
      harness({ [KEY]: stored })
        .state.entries()
        .map((entry) => entry.score),
    ).toEqual([90, 80, 70, 40, 30]);
  });

  it('keeps working when storage is unavailable', () => {
    const state = createScoreboardState({
      store: createWebStorageStore(() => undefined),
      now: () => '2026-08-13T01:00:00.000Z',
    });

    state.record(10);

    expect(state.entries()).toHaveLength(1);
  });
});
