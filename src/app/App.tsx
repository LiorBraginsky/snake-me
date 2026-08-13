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
  // The composition root, and the only place ambient capability is read:
  // `window` satisfies both the FrameScheduler and the KeyDownTarget port
  // structurally, and Date.now() is the one production non-determinism this
  // codebase allows (ADR 0004, ADR 0005).
  const session = createGameSession({ rules: DEFAULT_RULES, rng: createSeededRng(Date.now()) });

  createGameLoop({
    state: session.state,
    rules: DEFAULT_RULES,
    frames: window,
    advance: session.tick,
  });

  onCleanup(createKeyboardControls(window, session.dispatch));

  // One store, two versioned keys (spec §7). `window.localStorage` arrives as a
  // lazy provider because reading that property itself throws when storage is
  // blocked — the adapter catches it, the composition root does not have to.
  const store = createWebStorageStore(() => window.localStorage);
  // Applied here, synchronously inside render(), so the stored theme is on
  // `:root` before the browser's first paint — there is no theme bootstrap in
  // main.tsx and no flash of the dark-checker default.
  const themeState = createThemeState({ store, apply: applyTheme });
  // `Date` is read here and nowhere below: the composition root is the one place
  // production non-determinism originates (ADR 0004).
  const scoreboard = createScoreboardState({ store, now: () => new Date().toISOString() });

  // Keyed on a memo of `status`, not on the state signal, so a tick cannot
  // re-enter this effect — the same reason `createGameLoop` memoises status
  // (ADR 0005). Solid flushes user effects before the browser paints, so the
  // overlay's first frame already carries the round that just ended.
  //
  // Declared below `scoreboard`, not above it: this callback closes over
  // `scoreboard`, and `createRoot` only *happens* to defer effects past the
  // end of this function body today — hoisting this block to the top (as it
  // shipped before this fix) relies on that deferral rather than on scoping,
  // so a future switch to `createRenderEffect` would turn it into a TDZ
  // `ReferenceError` that no lint rule or type check would catch.
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
