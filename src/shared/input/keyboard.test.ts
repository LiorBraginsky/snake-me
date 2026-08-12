import { describe, expect, it } from 'vitest';

import { createKeyboardControls } from './keyboard';
import type { ControlDirection, ControlSignal, KeyDownEvent, KeyDownTarget } from './keyboard';
import type { Direction } from '../../entities/game';

/** Compile-time proofs. Never executed — `window` does not exist under vitest's node env. */
export const _windowIsAKeyDownTarget = (): KeyDownTarget => window;
export const _controlDirectionsAreEngineDirections = (): readonly Direction[] =>
  ['up', 'down', 'left', 'right'] satisfies readonly ControlDirection[];
export const _engineDirectionsAreControlDirections = (): readonly ControlDirection[] =>
  ['up', 'down', 'left', 'right'] satisfies readonly Direction[];

function fakeTarget() {
  const listeners = new Set<(event: KeyDownEvent) => void>();

  return {
    addEventListener(_type: 'keydown', listener: (event: KeyDownEvent) => void): void {
      listeners.add(listener);
    },
    removeEventListener(_type: 'keydown', listener: (event: KeyDownEvent) => void): void {
      listeners.delete(listener);
    },
    listenerCount: (): number => listeners.size,
    /** Returns how many times the adapter claimed the key. */
    press(key: string, repeat = false): number {
      let prevented = 0;
      const event: KeyDownEvent = {
        key,
        repeat,
        preventDefault: (): void => {
          prevented += 1;
        },
      };
      for (const listener of listeners) {
        listener(event);
      }

      return prevented;
    },
  };
}

function capture(): {
  target: ReturnType<typeof fakeTarget>;
  seen: ControlSignal[];
  stop: () => void;
} {
  const target = fakeTarget();
  const seen: ControlSignal[] = [];
  const stop = createKeyboardControls(target, (signal) => seen.push(signal));

  return { target, seen, stop };
}

describe('keyboard controls', () => {
  it('maps arrows and WASD, either case, to the same turn signals', () => {
    const { target, seen } = capture();

    for (const key of [
      'ArrowUp',
      'w',
      'W',
      'ArrowDown',
      's',
      'ArrowLeft',
      'a',
      'ArrowRight',
      'd',
    ]) {
      target.press(key);
    }

    expect(seen).toEqual([
      { kind: 'turn', direction: 'up' },
      { kind: 'turn', direction: 'up' },
      { kind: 'turn', direction: 'up' },
      { kind: 'turn', direction: 'down' },
      { kind: 'turn', direction: 'down' },
      { kind: 'turn', direction: 'left' },
      { kind: 'turn', direction: 'left' },
      { kind: 'turn', direction: 'right' },
      { kind: 'turn', direction: 'right' },
    ]);
  });

  it('maps P, Esc to pause and Space to confirm', () => {
    const { target, seen } = capture();

    target.press('p');
    target.press('P');
    target.press('Escape');
    target.press(' ');

    expect(seen).toEqual([
      { kind: 'togglePause' },
      { kind: 'togglePause' },
      { kind: 'togglePause' },
      { kind: 'confirm' },
    ]);
  });

  it('ignores keys it does not own, and leaves their default behaviour alone', () => {
    const { target, seen } = capture();

    expect(target.press('Enter')).toBe(0);
    expect(target.press('q')).toBe(0);
    expect(seen).toEqual([]);
  });

  it('claims the default action of every key it owns', () => {
    const { target } = capture();

    expect(target.press('ArrowUp')).toBe(1);
    expect(target.press(' ')).toBe(1);
  });

  it('suppresses auto-repeat but still claims the key', () => {
    const { target, seen } = capture();

    expect(target.press('p', true)).toBe(1);
    expect(seen).toEqual([]);
  });

  it('detaches its listener on stop', () => {
    const { target, seen, stop } = capture();

    expect(target.listenerCount()).toBe(1);
    stop();
    expect(target.listenerCount()).toBe(0);

    target.press('ArrowUp');
    expect(seen).toEqual([]);
  });
});
