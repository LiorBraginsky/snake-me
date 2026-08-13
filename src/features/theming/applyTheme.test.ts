import { describe, expect, it } from 'vitest';

import { themeCustomProperties } from './applyTheme';
import { THEME_LIST } from './themes';
import type { ThemeTokens } from './types';

/**
 * `applyTheme` itself writes to `document.documentElement` and calls
 * `setAttribute` — both need a DOM to observe, and this project's testing
 * policy (spec §8, ADR 0005) fixes `environment: 'node'` permanently, with no
 * jsdom. Mutants in the DOM writes themselves therefore stay uncovered here on
 * purpose: swapping `documentElement` for `body`, dropping the `data-theme`
 * `setAttribute` call, and corrupting the `data-theme` write itself (e.g.
 * `'data-theme'` -> `'data-thema'`). Chasing them would mean either adding
 * jsdom (rejected repo-wide) or threading a fake-root parameter into
 * `applyTheme` for the sole purpose of being spied on in a test — shaping a
 * production API around a test's needs. All of them stay carried by the
 * chunk 05 demo gate instead.
 *
 * What IS fully mechanical — and was previously untested — is the transform
 * `themeCustomProperties` performs: camelCase field name -> `--kebab-case`
 * custom property, for exactly the 14 names `docs/architecture.md`'s CSS
 * custom property contract table promises. That is what this file makes
 * executable. The other half of that contract — that `app/styles/tokens.css`
 * actually declares all 14 names — is a cross-check between this slice and
 * `app`, which is not a sibling this test's carve-out covers (`CLAUDE.md`:
 * imports point down only); it lives in `test/theme-token-contract.test.ts`
 * instead, one layer above both.
 */

const SAMPLE_TOKENS: ThemeTokens = {
  boardBg: 'sample-board-bg',
  boardCellA: 'sample-board-cell-a',
  boardCellB: 'sample-board-cell-b',
  boardBorder: 'sample-board-border',
  snakeHead: 'sample-snake-head',
  snakeBody: 'sample-snake-body',
  snakeTail: 'sample-snake-tail',
  snakeShadow: 'sample-snake-shadow',
  itemFood: 'sample-item-food',
  itemFoodAccent: 'sample-item-food-accent',
  itemBoost: 'sample-item-boost',
  hudBg: 'sample-hud-bg',
  hudText: 'sample-hud-text',
  hudAccent: 'sample-hud-accent',
};

/** The frozen contract, spelled out literally rather than derived from the
 * transform under test — a derived list could not fail alongside a broken
 * transform. */
const FIELD_TO_PROPERTY: readonly (readonly [keyof ThemeTokens, string])[] = [
  ['boardBg', '--board-bg'],
  ['boardCellA', '--board-cell-a'],
  ['boardCellB', '--board-cell-b'],
  ['boardBorder', '--board-border'],
  ['snakeHead', '--snake-head'],
  ['snakeBody', '--snake-body'],
  ['snakeTail', '--snake-tail'],
  ['snakeShadow', '--snake-shadow'],
  ['itemFood', '--item-food'],
  ['itemFoodAccent', '--item-food-accent'],
  ['itemBoost', '--item-boost'],
  ['hudBg', '--hud-bg'],
  ['hudText', '--hud-text'],
  ['hudAccent', '--hud-accent'],
];

const EXPECTED_PROPERTY_NAMES = FIELD_TO_PROPERTY.map(([, property]) => property).sort();

describe('themeCustomProperties', () => {
  it('emits exactly the 14 frozen property names — no more, no fewer', () => {
    const properties = themeCustomProperties(SAMPLE_TOKENS);

    expect(Object.keys(properties).sort()).toEqual(EXPECTED_PROPERTY_NAMES);
  });

  it('emits every token for every registered theme, unchanged, under its frozen name', () => {
    for (const theme of THEME_LIST) {
      const properties = themeCustomProperties(theme.tokens);

      for (const [field, property] of FIELD_TO_PROPERTY) {
        expect(properties[property]).toBe(theme.tokens[field]);
      }
    }
  });
});
