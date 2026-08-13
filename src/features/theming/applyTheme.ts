import type { Theme, ThemeTokens } from './types';

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;

  for (const [property, value] of Object.entries(themeCustomProperties(theme.tokens))) {
    root.style.setProperty(property, value);
  }

  root.setAttribute('data-theme', theme.id);
}

export function themeCustomProperties(tokens: ThemeTokens): Readonly<Record<string, string>> {
  const properties: Record<string, string> = {};

  for (const [field, value] of Object.entries(tokens)) {
    properties[`--${field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`] = value;
  }

  return properties;
}
