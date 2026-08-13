import type { JSX } from 'solid-js';

export interface StartOverlayProps {
  readonly onStart: () => void;
}

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
