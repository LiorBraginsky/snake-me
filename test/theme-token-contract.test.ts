import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const EXPECTED_PROPERTY_NAMES = [
  '--board-bg',
  '--board-cell-a',
  '--board-cell-b',
  '--board-border',
  '--snake-head',
  '--snake-body',
  '--snake-tail',
  '--snake-shadow',
  '--item-food',
  '--item-food-accent',
  '--item-boost',
  '--hud-bg',
  '--hud-text',
  '--hud-accent',
].sort();

describe('theme token contract (features/theming <-> app/styles/tokens.css)', () => {
  it('declares all 14 frozen theme-token custom properties on :root', () => {
    const css = readFileSync(new URL('../src/app/styles/tokens.css', import.meta.url), 'utf-8');
    const rootBlock = /:root\s*{([^}]*)}/.exec(css)?.[1] ?? '';
    const declaredNames = new Set(
      [...rootBlock.matchAll(/(--[a-z-]+)\s*:/g)].map(([, name]) => name),
    );

    for (const property of EXPECTED_PROPERTY_NAMES) {
      expect(declaredNames.has(property)).toBe(true);
    }
  });
});
