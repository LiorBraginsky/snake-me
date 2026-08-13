import type { Theme, ThemeTokens } from './types';

/**
 * The only bridge from TypeScript to paint (ADR 0003). It writes the 14 theme
 * tokens and `data-theme`, and NOTHING else — never a geometry property, which
 * would put a layout number in `themes.ts` (CLAUDE.md).
 *
 * The target is `document.documentElement` (`:root`), never a mount node: `body`
 * paints `background-color: var(--hud-bg)` and inherits nothing from a
 * descendant, so writing lower would leave the page background stuck on the
 * `dark-checker` default while the board and HUD switched (docs/architecture.md
 * § CSS custom property contract). An inline style outranks every `@layer`,
 * which is why `tokens.css` can keep the defaults and `theme.css` carries no
 * tokens.
 *
 * `features/theming` is deliberately outside `eslint.config.js`'s
 * `no-restricted-globals` glob for exactly this function (ADR 0005).
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;

  for (const [property, value] of Object.entries(themeCustomProperties(theme.tokens))) {
    root.style.setProperty(property, value);
  }

  root.setAttribute('data-theme', theme.id);
}

/**
 * camelCase -> `--kebab-case`, with no lookup table: the property name IS the
 * field name, which is what keeps the frozen contract mechanical.
 */
function themeCustomProperties(tokens: ThemeTokens): Readonly<Record<string, string>> {
  const properties: Record<string, string> = {};

  for (const [field, value] of Object.entries(tokens)) {
    properties[`--${field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`] = value;
  }

  return properties;
}
