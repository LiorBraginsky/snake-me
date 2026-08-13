import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * The other half of ADR 0003's "frozen contract": that `app/styles/tokens.css`
 * actually declares all 14 `ThemeTokens` custom-property names `applyTheme.ts`
 * emits. `src/features/theming/applyTheme.test.ts` proves the emit side (the
 * camelCase -> `--kebab-case` transform); this file proves the CSS side.
 *
 * It lives here, not in `src/features/theming/`, because it is a cross-check
 * between two layers, not a fixture inside one slice: `app/styles/tokens.css`
 * sits at the top of `app -> widgets -> features -> entities -> shared`
 * (CLAUDE.md: imports point down only), and `app` is not a sibling slice the
 * test carve-out (`boundaries/dependencies: off` for `src/**\/*.test.*`) is
 * scoped to cover — that carve-out's accepted cost is a test reaching into a
 * SIBLING slice's internals, never the layer above both. `test/` is the right
 * home: it already exists (`test/toolchain.test.ts`), is included by both
 * `vite.config.ts` and `tsconfig.json`, and sits outside `boundaries`'
 * `src/**` glob entirely, so this file is invisible to that rule rather than
 * exempted from it.
 *
 * The 14 names are spelled out literally here, duplicated from
 * `applyTheme.test.ts`'s own literal, rather than imported from
 * `features/theming` or derived from `themeCustomProperties`: a name that
 * silently vanished from BOTH the transform and this list at once would
 * escape every check, but a hardcoded list is the only version that still
 * fails if the transform's own list drifts without this one following.
 */
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

    // Filtered against the 14-name literal above, not by trying to classify
    // what else lives in :root — the geometry properties are legitimately
    // there too, and are not theme tokens. This is a subset check, not proof
    // of exhaustiveness the other way: a name renamed in `themes.ts` but
    // never removed from `tokens.css` would still pass (ADR 0003).
    for (const property of EXPECTED_PROPERTY_NAMES) {
      expect(declaredNames.has(property)).toBe(true);
    }
  });
});
