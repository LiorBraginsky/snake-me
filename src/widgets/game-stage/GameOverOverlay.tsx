import type { JSX } from 'solid-js';

export interface GameOverOverlayProps {
  readonly score: number;
  readonly onRestart: () => void;
}

/**
 * The final score only. The top-5 scoreboard spec §3 asks for needs storage and
 * lands in chunk 05 — deliberately deferred, not forgotten.
 */
export function GameOverOverlay(props: GameOverOverlayProps): JSX.Element {
  return (
    <div class="stage__overlay">
      <div class="overlay-panel">
        <p class="overlay-panel__title">Game over</p>
        <p class="overlay-panel__score">{props.score}</p>
        <button class="overlay-panel__button" type="button" onClick={() => props.onRestart()}>
          Play again
        </button>
        <p class="overlay-panel__hint">Space plays again too</p>
      </div>
    </div>
  );
}
