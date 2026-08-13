export type ControlDirection = 'up' | 'down' | 'left' | 'right';

export type ControlSignal =
  | { readonly kind: 'turn'; readonly direction: ControlDirection }
  | { readonly kind: 'togglePause' }
  | { readonly kind: 'confirm' };

export interface KeyDownEvent {
  readonly key: string;
  readonly repeat: boolean;
  preventDefault(): void;
}

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
    // page, and Space would also click whatever button holds focus. A widget
    // that needs one of these keys takes it back locally — the listener is on
    // `window`, so any handler between the event target and `window` wins by
    // calling stopPropagation() (see ThemeSwatch; ADR 0005 § Amendment).
    event.preventDefault();

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
