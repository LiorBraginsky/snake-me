import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';

import type { ScoreEntry } from '../../entities/game';

export interface GameOverOverlayProps {
  readonly score: number;
  readonly scores: readonly ScoreEntry[];
  readonly onRestart: () => void;
}

/**
 * The final score plus the persisted top-5 (spec §3): `scores` arrives from
 * `features/scoreboard` through `GameStage` — this widget renders it, it does
 * not rank it.
 */
export function GameOverOverlay(props: GameOverOverlayProps): JSX.Element {
  return (
    <div class="stage__overlay">
      <div class="overlay-panel">
        <p class="overlay-panel__title">Game over</p>
        <p class="overlay-panel__score">{props.score}</p>
        <Show when={props.scores.length > 0}>
          <p class="overlay-panel__hint">Best</p>
          <ol class="overlay-panel__scores">
            <For each={props.scores}>
              {(entry, index) => (
                <li class="overlay-panel__score-row">
                  <span class="overlay-panel__score-rank">{index() + 1}</span>
                  <span class="overlay-panel__score-value">{entry.score}</span>
                  {/* The ISO prefix, not toLocaleDateString(): a widget must not
                      depend on the host locale or time zone, and the date is
                      provenance, not prose. */}
                  <span class="overlay-panel__score-date">{entry.date.slice(0, 10)}</span>
                </li>
              )}
            </For>
          </ol>
        </Show>
        <button class="overlay-panel__button" type="button" onClick={() => props.onRestart()}>
          Play again
        </button>
        <p class="overlay-panel__hint">Space plays again too</p>
      </div>
    </div>
  );
}
