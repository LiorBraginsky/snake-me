import { createEffect, createMemo, on, onCleanup } from 'solid-js';
import type { JSX } from 'solid-js';

import { DEFAULT_RULES, createSeededRng } from '../entities/game';
import { createGameLoop, createGameSession } from '../features/game-session';
import { createScoreboardState } from '../features/scoreboard';
import { applyTheme, createThemeState } from '../features/theming';
import { createKeyboardControls } from '../shared/input';
import { createWebStorageStore } from '../shared/storage';
import { GameStage } from '../widgets/game-stage';
import { Hud } from '../widgets/hud';
import { ThemePicker } from '../widgets/theme-picker';

export function App(): JSX.Element {
  const session = createGameSession({ rules: DEFAULT_RULES, rng: createSeededRng(Date.now()) });

  createGameLoop({
    state: session.state,
    rules: DEFAULT_RULES,
    frames: window,
    advance: session.tick,
  });

  onCleanup(createKeyboardControls(window, session.dispatch));

  const store = createWebStorageStore(() => window.localStorage);
  const themeState = createThemeState({ store, apply: applyTheme });
  const scoreboard = createScoreboardState({ store, now: () => new Date().toISOString() });

  const status = createMemo(() => session.state().status);
  createEffect(
    on(status, (value) => {
      if (value === 'game-over') {
        scoreboard.record(session.state().score);
      }
    }),
  );

  return (
    <main class="app">
      <h1 class="app__title">snake-me</h1>
      <div
        class="app__game"
        style={{ '--board-cols': DEFAULT_RULES.cols, '--board-rows': DEFAULT_RULES.rows }}
      >
        <Hud
          score={session.state().score}
          status={session.state().status}
          boostTicksRemaining={session.state().boostTicksRemaining}
        />
        <GameStage
          cols={DEFAULT_RULES.cols}
          rows={DEFAULT_RULES.rows}
          boardStyle={themeState.theme().boardStyle}
          state={session.state()}
          scores={scoreboard.entries()}
          onStart={session.start}
          onRestart={session.restart}
        />
        <ThemePicker activeId={themeState.theme().id} onSelect={themeState.select} />
      </div>
    </main>
  );
}
