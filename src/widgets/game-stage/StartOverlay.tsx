import type { JSX } from 'solid-js';

export interface StartOverlayProps {
  readonly onStart: () => void;
}

/**
 * Shown while the round is idle — the game never auto-starts (spec §3). No key
 * handling here on purpose: `shared/input` owns the keyboard globally and
 * already maps Space to "begin", and it calls preventDefault(), which also stops
 * Space from activating this button a second time.
 */
export function StartOverlay(props: StartOverlayProps): JSX.Element {
  return (
    <div class="stage__overlay">
      <div class="overlay-panel">
        <p class="overlay-panel__title">Ready?</p>
        <p class="overlay-panel__hint">Arrows or WASD to steer · P or Esc to pause</p>
        <button class="overlay-panel__button" type="button" onClick={() => props.onStart()}>
          Start
        </button>
      </div>
    </div>
  );
}
