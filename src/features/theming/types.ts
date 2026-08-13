export type ThemeId =
  'dark-checker' | 'dark-solid' | 'light-checker' | 'light-solid' | 'nokia' | 'neon';

export type BoardStyle = 'checker' | 'solid';

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

export interface Theme {
  readonly id: ThemeId;
  readonly label: string;
  readonly boardStyle: BoardStyle;
  readonly tokens: ThemeTokens;
}
