# ADR 0005: Headless session — time and input as structural ports

- **Status:** proposed
- **Date:** 2026-08-13
- **Deciders:** Lior

## Context

Chunk 03 wires the pure engine (ADR 0004) into a reactive session and a
`requestAnimationFrame` loop, and drives both through logic tests only —
`docs/architecture.md` § Enforcement, "Engine determinism" row, fixes
`environment: 'node'` as the **final** test environment, not a staging one, so
jsdom never enters the picture.

That constraint forces a decision before a line of `createGameLoop` is
written: `window`, `document`, `requestAnimationFrame` and `Date` do not exist
under Node. Any module that names one of them directly cannot run in a `node`
test at all, let alone be driven deterministically. Three call sites need
exactly this kind of ambient access:

- `shared/input` needs an `EventTarget` to attach a `keydown` listener to.
- `createGameLoop` needs a scheduler to request and cancel animation frames.
- Both need a source of time — the loop to accumulate elapsed milliseconds,
  and production non-determinism (ADR 0004) needs `Date.now()` to seed the rng.

`entities/game` already answers the same question for randomness: `Rng` is a
port, injected, never a module-level `Math.random()` call. This ADR extends
that answer to input and the clock, and states where the answer is enforced.

## Decision

**Every ambient capability the session and loop need arrives as a value the
caller injects, shaped as a structural subset of `Window`.**

```ts
export interface KeyDownTarget {
  addEventListener(type: 'keydown', listener: (event: KeyDownEvent) => void): void;
  removeEventListener(type: 'keydown', listener: (event: KeyDownEvent) => void): void;
}

export interface FrameScheduler {
  requestAnimationFrame(callback: (timeMs: number) => void): number;
  cancelAnimationFrame(handle: number): void;
}
```

`KeyDownEvent` is likewise the three members `createKeyboardControls` reads off
a `KeyboardEvent` (`key`, `repeat`, `preventDefault()`) — there is no
`KeyboardEvent` constructor in Node, so a test could not build a real one even
if it wanted to; declaring the subset lets a test emit a plain object with no
cast.

**The clock is not a fourth port.** `requestAnimationFrame` already hands its
callback a timestamp (a `DOMHighResTimeStamp` in the browser, a plain `number`
here); `createGameLoop`'s accumulator uses only the deltas between those
timestamps. Nothing in the session or the loop calls `Date.now()` or
`performance.now()` — a test drives time by passing numbers to a fake
scheduler, which is what removes fake timers from the test suite entirely.

**All three ports are structural subsets of `Window`, so production wiring is
literally `window` — no adapter module, no extra slice:**

```tsx
// src/app/App.tsx — chunk 04
const session = createGameSession({ rules: DEFAULT_RULES, rng: createSeededRng(Date.now()) });
createGameLoop({ state: session.state, rules: DEFAULT_RULES, frames: window, advance: session.tick });
onCleanup(createKeyboardControls(window, session.dispatch));
```

Two compile-time proofs (checked by `pnpm typecheck`, never executed) pin that
`window` keeps satisfying both ports:

```ts
export const _windowIsAKeyDownTarget = (): KeyDownTarget => window;
export const _windowIsAFrameScheduler = (): FrameScheduler => window;
```

`Date.now()` stays a single call, in `App.tsx`, above every slice this ADR
covers — the one place production non-determinism is allowed to originate
(ADR 0004).

**The technical half ships as a lint rule, not a comment.** A missed injection
is a missing import to `boundaries/dependencies` — a global is not one — so it
cannot see this. `no-restricted-globals` plus a narrow `no-restricted-properties`
entry are added instead, scoped to `src/entities/**` and
`src/features/game-session/**`, tests excluded:

```js
{
  files: ['src/entities/**/*.{ts,tsx}', 'src/features/game-session/**/*.{ts,tsx}'],
  ignores: ['**/*.test.{ts,tsx}'],
  rules: {
    'no-restricted-globals': ['error',
      { name: 'window', message: 'Headless by contract: take a port (ADR 0005).' },
      { name: 'document', message: 'Headless by contract: take a port (ADR 0005).' },
      { name: 'localStorage', message: 'Headless by contract: take a port (ADR 0005).' },
      { name: 'requestAnimationFrame', message: 'Take a FrameScheduler port (ADR 0005).' },
      { name: 'cancelAnimationFrame', message: 'Take a FrameScheduler port (ADR 0005).' },
      { name: 'performance', message: 'Time arrives as the frame timestamp (ADR 0005).' },
      { name: 'Date', message: 'Determinism: the caller supplies clock values (ADR 0004).' },
      { name: 'setTimeout', message: 'ADR 0005 rejects setInterval/setTimeout: take a FrameScheduler port.' },
      { name: 'setInterval', message: 'ADR 0005 rejects setInterval/setTimeout: take a FrameScheduler port.' },
      { name: 'queueMicrotask', message: 'Headless by contract: take a port (ADR 0005).' },
      { name: 'self', message: 'Headless by contract: take a port (ADR 0005).' },
      { name: 'navigator', message: 'Headless by contract: take a port (ADR 0005).' },
      { name: 'crypto', message: 'Determinism: take the Rng port (ADR 0004).' },
      // Bans the bare identifier, not just a `globalThis.window`-shaped member
      // access — this catches every reference eslint-scope resolves to the
      // global variable `globalThis`, including one laundered through a type
      // assertion, e.g. `(globalThis as unknown as { window: Window }).window`.
      // A `no-restricted-properties` entry keyed on the object name
      // `globalThis` was tried first and rejected: it inspects
      // `MemberExpression.object.name`, which is `undefined` once the object
      // is a `TSAsExpression` rather than a bare `Identifier`, so it lints
      // that exact cast clean.
      { name: 'globalThis', message: 'Headless by contract: take a port (ADR 0005).' },
    ],
    'no-restricted-properties': ['error',
      // Targets the PROPERTY, not the object, so `Math.max` / `.floor` /
      // `.round` / `.imul` — all real call sites in `entities/game` — stay
      // legal. Cost accepted, not closed: `(Math as unknown as { random(): number }).random()`
      // launders past this the same way the rejected `globalThis` property
      // rule did, and no rule here catches it — banning the bare `Math`
      // identifier would take every legitimate use down with it.
      { object: 'Math', property: 'random', message: 'Determinism: take the Rng port (ADR 0004).' },
    ],
  },
},
```

`features/theming` is deliberately **not** in the glob: writing theme tokens
onto `document` is exactly that slice's job (ADR 0003), so banning `document`
there would be the rule fighting the architecture instead of guarding it.

`src/shared/**` is outside the glob too, but not because `shared/input` (a
named call site above, and where `KeyDownTarget` lives) needs shielding — it
never reaches for `window` itself, only declares the port shape and reads off
whatever the caller injects: the actual reason is that chunk 05's
`shared/storage` is specified as a `localStorage` adapter
(`docs/architecture.md`'s slice inventory), which this rule's `localStorage`
entry would ban outright, so the glob stops at `features/game-session` for
now rather than reaching one layer further down.

**Loop semantics decided alongside the ports, so they do not become five open
questions in chunk 04's review:**

- At most one tick per frame; a stalled backlog is dropped with
  `accumulated %= interval`, not replayed with a catch-up loop.
- The interval is re-derived every frame from `tickIntervalMs(state(), rules)`
  — the boost multiplier is applied there and nowhere else (ADR 0004).
- Start/stop is reactive, keyed on a `createMemo` of `status` only, so a tick
  does not re-enter the effect; `isRunning` is mirrored into a plain boolean so
  the frame callback — not a tracked scope — never reads a signal to decide
  whether to keep scheduling itself.
- Resuming resets the clock (`previousMs = undefined`, `accumulated = 0`), so a
  pause of any length injects no delta and produces no tick storm on return.
- `onCleanup` cancels the pending frame.

## Consequences

- The session and the loop are testable under `environment: 'node'` with no
  jsdom, keeping `docs/architecture.md`'s "`node` is final" decision intact
  through chunk 03 rather than forcing a reopening.
- **Cost — every composition-root call site threads three ports plus `Rules`.**
  `App.tsx` passes `window` twice and `DEFAULT_RULES` twice. That is the same
  trade ADR 0004 already accepted for `rules` — explicit dependencies over
  hidden ones — extended to input and time.
- **Cost — a missing injection is a compile error, not a graceful fallback.**
  There is no default parameter that reaches for `window` when nothing is
  passed. That is deliberate: a default would make a forgotten injection work
  silently in a browser and fail only in a test (or vice versa), which is a
  worse failure mode than a type error at the call site.
- **Cost — `no-restricted-globals` is a second, unrelated mechanism from
  `boundaries/dependencies`.** The two rules do not compose or share
  configuration; a reviewer verifying "this slice is headless" has to know both
  exist. Mitigated by the same deliberate-violation discipline
  `docs/architecture.md` § Trap already requires for the boundaries rule: this
  PR's body carries the failing `pnpm lint` output that proves the new rule
  fired before it shipped.
- Chunk 04's `App.tsx` is now specified down to the exact three call
  arguments; there is no remaining design decision at the composition root,
  only wiring.

## Alternatives considered

- **A `shared/scheduler` slice with a real `requestAnimationFrame` adapter** —
  mirrors how `shared/input` and `shared/storage` are organized. Rejected: it
  would be an extra slice and an untested module standing in for four lines
  (`window.requestAnimationFrame` / `cancelAnimationFrame`) that the
  composition root can hold directly, with no behaviour of its own to test.
- **Default parameters that fall back to `window` when nothing is injected** —
  shortens every production call site by one argument. Rejected: a forgotten
  injection would then silently work in a browser and only die in a test
  environment where `window` does not exist — the opposite of failing loudly,
  and the same failure class as the resolver trap in
  `docs/architecture.md` § Trap.
- **`setInterval` instead of `requestAnimationFrame`** — simpler API, no frame
  timestamp bookkeeping. Rejected on two counts: it hands the callback no
  timestamp, so the accumulator would need `Date.now()` after all, and it keeps
  firing in a backgrounded tab instead of pausing with the browser's paint
  loop — turning "the tab was asleep" into "the snake kept dying offscreen."
- **A catch-up `while` loop that ticks once per elapsed interval instead of
  `accumulated %= interval`** — would replay exactly the missed ticks instead
  of dropping them. Rejected (OQ-2): on the default 24×16 board a ten-second
  tab stall is roughly 66 ticks, which fast-forwards the snake into a wall the
  instant the tab regains focus. Dropping the backlog is the safer default;
  nothing in spec §3 asks for replay.
- **jsdom plus `@solidjs/testing-library`** — the conventional way to test
  Solid reactivity and DOM adapters together. Rejected: it contradicts
  `docs/architecture.md`'s permanent `node`-environment decision, and buys
  nothing here — spec §8 and Lior's 2026-08-13 policy scope this project's
  tests to logic only, never render or markup, so there is nothing a DOM would
  let this chunk assert that a plain object fake does not already cover.

## Amendment — chunk 05 (2026-08-13)

Two decisions this ADR left open are now closed.

**The glob reaches `src/shared/**`.** The reason it stopped at
`features/game-session` was `shared/storage`'s specified `localStorage`
adapter. That adapter instead takes the storage object as an injected provider
— `createWebStorageStore(() => window.localStorage)`, the same shape as
`createKeyboardControls(window, …)` — so nothing under `src/shared/**` names an
ambient global and the glob widens with no carve-out. `src/features/scoreboard`
joins the glob for the same reason `game-session` is in it: the ISO date is an
injected `now: () => string`, never a `Date` read. `features/theming` stays out
(ADR 0003: writing tokens onto the document is its job). A carve-out variant —
widening plus a per-file exemption for the adapter — was rejected: exempting a
file from `no-restricted-globals` unguards its `document`, `Date` and `crypto`
access too, so it trades one hole for a smaller one instead of closing it. The
widened rule was re-proven with a deliberate violation before merge.

**`KeyDownEvent` was deliberately NOT widened with `target`.** Chunk 03's review
flagged that the adapter `preventDefault()`s every key it owns, so a widget that
needs one of those keys never sees it. The fix ships in the widget, not the
port: `ThemePicker`'s swatches call `event.stopPropagation()` for Space (the one
key a `<button>` and the adapter both want — arrows have no default action on a
button). The adapter listens on `window` and Solid delegates `keydown` at
`document`, so any handler between the target and `window` wins; that is the
DOM's own "this element owns this key" mechanism, and it costs the port nothing.
Adding `target` would have cost the port a lot: `KeyboardEvent.target` is
`EventTarget | null`, which structurally has no `tagName`, so a
`target: { tagName: string } | null` member makes `KeyboardEvent` and
`KeyDownEvent` incompatible in both directions and
`_windowIsAKeyDownTarget` stops compiling. The only proof-preserving typing is
`target: unknown` plus a runtime shape guard inside a slice whose contract is
"imports nothing" — and the guard needs two tiers to be correct (every key for
`INPUT`/`TEXTAREA`/`SELECT`/contenteditable, Space only for `BUTTON`/`A`),
because a focused button must keep steering the snake. Revisit when the tree
actually grows a text input or a `<select>`; until then this is a predicate with
no caller.

## References

- Design spec §3 (loop-relevant rules), §4 (Engine API this session wraps),
  §8 (logic-only testing policy) — `docs/specs/2026-08-12-snake-game-design.md`
- ADR 0004 — Engine API: the no-op-by-reference contract this session's signal
  relies on, and the precedent for injected configuration over ambient access
- `docs/architecture.md` § Enforcement, "Engine determinism" row — `node` as
  the final test environment, not staging
- `docs/architecture.md` § Trap — why a green `pnpm lint` is not by itself
  evidence a rule ran, and the deliberate-violation discipline this ADR's lint
  rule follows
- `src/shared/input/keyboard.ts` — `KeyDownTarget`, `KeyDownEvent`
- `src/features/game-session/createGameLoop.ts` — `FrameScheduler`, the
  accumulator and its stall-dropping `%`
- `src/features/game-session/createGameSession.ts` — the reactive wrapper this
  ADR's ports feed
- `eslint.config.js` — the `no-restricted-globals` block
