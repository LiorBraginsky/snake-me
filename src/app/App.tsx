import { onCleanup } from 'solid-js';
import type { JSX } from 'solid-js';

import { DEFAULT_RULES, createSeededRng } from '../entities/game';
import { createGameLoop, createGameSession } from '../features/game-session';
import { createKeyboardControls } from '../shared/input';
import { GameStage } from '../widgets/game-stage';

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

  return (
    <main class="app">
      <h1 class="app__title">snake-me</h1>
      <div
        class="app__game"
        style={{ '--board-cols': DEFAULT_RULES.cols, '--board-rows': DEFAULT_RULES.rows }}
      >
        <GameStage
          cols={DEFAULT_RULES.cols}
          rows={DEFAULT_RULES.rows}
          boardStyle="checker"
          state={session.state()}
          onStart={session.start}
          onRestart={session.restart}
        />
      </div>
    </main>
  );
}
