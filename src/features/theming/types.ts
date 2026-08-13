export type ThemeId =
  'dark-checker' | 'dark-solid' | 'light-checker' | 'light-solid' | 'nokia' | 'neon';

/**
 * How a theme paints the board (spec §6 / ADR 0003): `checker` alternates the
 * two cell colours, `solid` paints one background. The canonical home — chunk 04
 * declared it in `BoardLayer.tsx` only because a feature may not import a widget.
 */
export type BoardStyle = 'checker' | 'solid';

/**
 * One colour per field, and the CSS custom property name is the exact kebab-case
 * of the field name (`boardBg` -> `--board-bg`). Those 14 names are a FROZEN
 * contract shared with `app/styles/tokens.css`; nothing type-checks the strings,
 * so a rename lands in both places in one commit (docs/architecture.md
 * § CSS custom property contract).
 */
export interface ThemeTokens {
  readonly boardBg: string;
  readonly boardCellA: string;
  readonly boardCellB: string;
  readonly boardBorder: string;
  readonly snakeHead: string;
  readonly snakeBody: string;
  readonly snakeTail: string;
  readonly snakeShadow: string;
  readonly itemFood: string;
  readonly itemFoodAccent: string;
  readonly itemBoost: string;
  readonly hudBg: string;
  readonly hudText: string;
  readonly hudAccent: string;
}

/**
 * A theme carries palette and board structure — no components. The one detailed
 * SVG set lives in `widgets/game-stage` and recolours through the tokens above;
 * a theme that needs a different treatment ships a `[data-theme]` rule in
 * `app/styles/theme.css` (ADR 0006, narrowing ADR 0003).
 */
export interface Theme {
  readonly id: ThemeId;
  readonly label: string;
  readonly boardStyle: BoardStyle;
  readonly tokens: ThemeTokens;
}
