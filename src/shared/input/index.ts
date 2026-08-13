// Public API of `shared/input`: keyboard -> ControlSignal, with no knowledge of
// the game (spec §4). `keyboard.ts` imports nothing at all — the layer is
// framework-agnostic by construction, not only by lint.
export type { ControlDirection, ControlSignal, KeyDownEvent, KeyDownTarget } from './keyboard';
export { createKeyboardControls } from './keyboard';
