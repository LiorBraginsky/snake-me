import { describe, expect, it } from 'vitest';

import { themeCustomProperties } from './applyTheme';
import { THEME_LIST } from './themes';
import type { ThemeTokens } from './types';

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
