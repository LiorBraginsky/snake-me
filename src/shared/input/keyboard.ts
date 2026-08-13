export type ControlDirection = 'up' | 'down' | 'left' | 'right';

export type ControlSignal =
  | { readonly kind: 'turn'; readonly direction: ControlDirection }
  | { readonly kind: 'togglePause' }
  | { readonly kind: 'confirm' };

/**
 * The subset of `KeyboardEvent` the adapter reads. There is no `KeyboardEvent`
 * constructor in node, so a test could not build a real one — declaring only
 * the members this adapter uses lets a test emit a plain object with no cast.
 */
export interface KeyDownEvent {
  readonly key: string;
  readonly repeat: boolean;
  preventDefault(): void;
}

/**
 * The subset of `EventTarget` the adapter needs. `window` does not exist in
 * node, so reaching for it directly would make this module untestable
 * without jsdom — which `docs/architecture.md` bans permanently. A port keeps
 * production wiring at `window` while tests pass a fake.
 */
export interface KeyDownTarget {
  addEventListener(type: 'keydown', listener: (event: KeyDownEvent) => void): void;
  removeEventListener(type: 'keydown', listener: (event: KeyDownEvent) => void): void;
}

const SIGNALS: Readonly<Record<string, ControlSignal>> = {
  arrowup: { kind: 'turn', direction: 'up' },
  arrowdown: { kind: 'turn', direction: 'down' },
  arrowleft: { kind: 'turn', direction: 'left' },
  arrowright: { kind: 'turn', direction: 'right' },
  w: { kind: 'turn', direction: 'up' },
  s: { kind: 'turn', direction: 'down' },
  a: { kind: 'turn', direction: 'left' },
  d: { kind: 'turn', direction: 'right' },
  p: { kind: 'togglePause' },
  escape: { kind: 'togglePause' },
  ' ': { kind: 'confirm' },
};

export function createKeyboardControls(
  target: KeyDownTarget,
  onSignal: (signal: ControlSignal) => void,
): () => void {
  const listener = (event: KeyDownEvent): void => {
    const signal = SIGNALS[event.key.toLowerCase()];
    if (signal === undefined) {
      return;
    }

    // The key belongs to the game: arrows and Space would otherwise scroll the
    // page, and Space would also click whatever button holds focus.
    event.preventDefault();

    // Claimed first, suppressed second: holding an arrow must still not scroll,
    // but a held key must not strobe pause or re-restart a finished round.
    if (event.repeat) {
      return;
    }

    onSignal(signal);
  };

  target.addEventListener('keydown', listener);

  return () => {
    target.removeEventListener('keydown', listener);
  };
}
