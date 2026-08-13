# ADR 0007: The e2e plays the real game — the test adapts, production grows no seam

- **Status:** proposed
- **Date:** 2026-08-13
- **Deciders:** Lior

## Context

Spec §8 buys exactly one end-to-end gate: *"Playwright, 1 spec: start → snake
moves → score grows"*. Chunk 01 wired `pnpm test:e2e` into `ci.yml` as an echo
stub so the workflow would not have to change later; chunk 06 has to put a real
round behind it.

Two standing decisions make that harder than it sounds, and both are load-bearing
elsewhere:

- **Production is deliberately non-deterministic.** `App.tsx` seeds the engine
  with `createSeededRng(Date.now())` (ADR 0004), so the apple lands on a
  different cell every run. No fixed key sequence reaches it twice.
- **The test suite is logic-only.** `vitest` runs in `environment: 'node'` as a
  *final* state, not a staging one (`docs/architecture.md` § Enforcement,
  "Engine determinism"); there are no render, markup or snapshot tests. 138
  tests cover the engine, the session, the loop, storage and the scoreboard —
  and none of them has ever seen a DOM node. The browser is therefore the only
  place where rendering, the coordinate contract, the keyboard adapter and
  `applyTheme`'s DOM effects are exercised at all.

The obvious way out is to make the game testable: pin the seed, or expose a
`?seed=` parameter, or hang a hook on `window`. Every one of those is a test
seam in production code, which is the exact thing this codebase's port
discipline exists to avoid (ADR 0005) — and it would gate a game no player ever
plays.

## Decision

**The e2e adapts to the game. The game grows nothing for the e2e.**

`e2e/smoke.spec.ts` is one Chromium spec with one test that plays a real,
`Date.now()`-seeded round: it clicks Start, then chases the apple with real
arrow-key presses until the score moves.

**It reads the DOM contract that already exists.** The chase reads three
values — `--x` / `--y` off `.snake__segment--head` and `.item--food`, and
`data-direction` off `.snake__face` — atomically, in one round trip, every
25 ms, and presses at most one arrow per poll. Board size comes from
`--board-cols` / `--board-rows` on `.stage`. All of these are frozen in
`docs/architecture.md` § CSS custom property contract, so the spec restates
**no** gameplay number: it asserts the score *grows*, never that it equals 10,
and an engine-constant change cannot break it.

**Nothing under `src/` changed in chunk 06** — no `?seed=`, no `window` hook,
no `data-testid`, not one attribute added for the test's benefit. Every locator
in the spec matched the shipped DOM on the first run, with zero corrections.

**The chase is not expected to lose the round before it scores**, and the
argument is recorded in the spec's header rather than trusted to luck:

- Self-collision is structurally impossible — the snake starts at 3 segments
  (`rules.ts`) and the shortest self-collision loop needs 5; the chase ends at
  the first apple, i.e. at length 4.
- The chase never steers into a wall — `nextTurn` always turns toward the
  apple or perpendicular to break a stale row/column, and only declines to
  turn when the apple already sits ahead on the current heading. The one
  remaining wall exposure is timing, not steering: a sweep of all 381 legal
  apple positions against `nextTurn` plus the real engine (`engine.ts`) found
  that in 20 of them (~5%) the chase reaches an edge cell with its heading
  already pointing off-board, where survival needs the already-decided
  perpendicular turn to land inside that same 150 ms tick (`rules.ts`'s
  `BASE_TICK_MS`). The spec reads the head cell, the apple cell and the
  heading atomically in one round trip — three separate reads could straddle
  a tick and waste a poll at exactly this moment — and polls every 25 ms, so
  the turn gets several chances to land before the tick fires.
- A stale read is never fatal — every requested turn is perpendicular to the
  heading that was *read*; if the real heading has already moved on, the engine
  rejects the illegal turn (ADR 0004's no-op contract) and the next poll
  re-decides.
- `score > 0` can only mean the apple was eaten — a boost is drawn only inside
  the eat-food branch, so none can exist beforehand.

**`retries: 0`, stated with a comment in `playwright.config.ts`.** The argument
above does not claim the chase cannot fail — it names a real, if rare (~5%),
residual wall-exposure timing window. A retry would convert that real residual
failure mode into a quietly green run instead of evidence.

**Two riders travel in the same round, because a second `test()` would only
re-randomise the apple for zero extra coverage:**

- **The board-repaint carry-over from chunk 04.** Two `MutationObserver`s are
  installed before Start; afterwards the spec asserts `entities > 0` **first**,
  then `board === 0`, then board-node identity, then head-node identity. The
  positive control is not decoration: the board layer has no children, so a
  broken probe would report `0` for the honest reason and the assertion would
  pass while proving nothing (`docs/architecture.md` § Trap — a green gate is
  not by itself evidence the check ran). The board-node identity check closes
  the same gap a different way: a `MutationObserver` watches a *node*, so if a
  tick ever tore the board layer down and rebuilt it, the `childList` record
  would land on `.stage` (the parent), the observed node would already be
  detached, and `board` would read `0` forever — for the wrong reason. Zero
  mutations is only meaningful together with proof the observed node is still
  the live one.
- **One `applyTheme` assertion**: `<html>` carries a non-empty `data-theme`
  after boot. ADR 0003's DOM effects are the one thing the logic-only suite
  structurally cannot cover, and this is the cheapest true statement about them.

**One browser, and the artifact Pages serves.** Chromium only is the ratified
scope (spec §8). `webServer` runs `pnpm build && vite preview --port 4173
--strictPort` under Vite's `base`, so the round runs against the built artifact
at the same path shape GitHub Pages hosts, and `pnpm test:e2e` is green from a
clean tree with no prior build. `--strictPort` is load-bearing: without it Vite
silently moves to 4174 and Playwright waits on 4173 until it times out.

## Consequences

- **The spec is coupled to class names and to the coordinate contract.**
  `.stage`, `.stage__layer--board`, `.stage__layer--entities`,
  `.snake__segment--head`, `.snake__face`, `.item--food`, `.hud__score-value`,
  `--x` / `--y` / `--board-cols` / `--board-rows` and `data-direction` are now
  gate-relevant names. Accepted, and arguably the point: they were already
  frozen as a contract in `docs/architecture.md`, and a rename now fails
  `pnpm test:e2e` instead of silently drifting. That the spec matched the DOM
  with zero corrections is evidence the contract was real rather than
  retrofitted.
- **The safety argument rests on `initialSnakeLength = 3`.** It is the only
  gameplay constant the spec depends on, and it depends on it in prose, not in
  code. Raising the starting length to 5 or more makes self-collision reachable
  during the chase and the argument has to be re-checked — a comment in the
  spec header says so.
- **Cost — one browser.** A regression that only reproduces in Firefox or
  Safari ships unnoticed. A cross-browser matrix is YAGNI for a portfolio piece
  and triples the slowest gate.
- **Cost — the gate proves the DOM half, never paint.** The zero-mutation
  assertion proves script never invalidates the board layer. It proves nothing
  about the compositor: `will-change` is a hint, promotion is the browser's
  decision, and no automated check in this repo observes paint. Paint
  verification stays the manual DevTools → Rendering → Paint flashing pass from
  the chunk 04 demo criterion — a deliberate stopping point, not an omission.
- **Cost — beyond `data-theme` existing, theming correctness is still the demo
  gate's job.** No screenshot comparison, no computed-style assertion; six
  themes rendering correctly remains a human check.
- **`retries: 0` keeps a real, if rare, failure visible.** The chase's own
  residual ~5% wall-exposure timing window (see Decision) is a genuine failure
  mode, not a design flaw; a retry would convert it into a quietly green run
  instead of evidence it happened, so a flake shows up as a red CI run rather
  than as a quietly retried green one. The chase carries its own 30 s deadline
  inside the 60 s test timeout, with a message (`steered toward the apple but
  the score never grew`) that says which half broke.
- **`@playwright/test` is a devDependency and browsers are not in the pnpm
  store.** `ci.yml`'s `verify` job gained
  `pnpm exec playwright install --with-deps chromium` before `pnpm test:e2e`;
  a new local contributor needs the same command once. The job name is
  unchanged — it is the required status check.
- **The spec is outside every `src/` gate and inside the compiler.** `e2e/` sits
  at the repo root, so `boundaries/dependencies`, `boundaries/no-unknown-files`
  and the headless `no-restricted-globals` block never see it and it may name
  `window` / `document` / `MutationObserver` freely; it is outside vitest's
  `include`, so `pnpm test` still reports 138 logic tests; it **is** in
  `tsconfig.json`'s `include`, so `pnpm typecheck` covers it with no second
  compiler config to drift. See `docs/architecture.md` § The e2e sits outside
  `src/`.
- **Ratification pending.** Status stays `proposed`; Lior ratifies with the
  batch, and this ADR does not gate the chunk-06 merge.

## Alternatives considered

- **Stub `Date.now()` through `page.addInitScript`** — the standard way to make
  a seeded app deterministic under Playwright, and it would let the spec press
  a fixed key sequence. Rejected: it couples the spec to mulberry32's draw
  order and to the engine's tick phase order (both ADR 0004 contracts), so any
  legal change to the draw sequence silently relocates the apple and the fixed
  keys walk into a wall. It would also gate a game no player ever plays.
- **A `?seed=` URL parameter** — smaller than stubbing and reproducible on
  demand. Rejected harder: it is a test seam in production code and a new user-
  visible feature, both explicitly out of chunk 06's scope. ADR 0005 exists so
  that capabilities arrive as injected values at the composition root, not as
  runtime switches the browser can flip.
- **`data-testid` attributes on the stage, the head and the apple** — the
  conventional way to decouple a test from styling class names. Rejected: the
  class names and the `--x` / `--y` custom properties are *already* a frozen
  contract with a documented owner, so a testid would add a second, parallel
  naming scheme that nothing else reads — and it is production markup carrying
  test weight.
- **A cross-browser matrix (Chromium + Firefox + WebKit)** — real coverage of
  the CSS this project leans on (`container-type`, `color-mix`, `@layer`).
  Rejected as YAGNI for a one-spec portfolio gate: it triples the slowest CI
  step to re-run one round three times.
- **A second `test()` for the repaint probe** — cleaner separation, one
  assertion group per test. Rejected: it would re-create the round, double the
  runtime and re-randomise the apple, for zero extra coverage. The probe needs
  a live round, and there is one right there.
- **`vite dev` instead of `vite preview`** — no build step, so the gate would
  run in about a second less. Rejected: the deploy story is base-path-dependent
  (`base: '/snake-me/'`), and the e2e should exercise the artifact Pages
  actually serves, including its base path and its production bundle.
- **`retries: 1`** — the usual insurance against browser flake. Rejected: the
  chase has a real, if rare (~5%), residual wall-exposure timing window (see
  Decision); a retry would convert that real residual failure mode into a
  quietly green run instead of evidence.

## References

- Design spec §8 (quality gates — the one Playwright spec, the logic-only
  testing policy), §9 (CI/CD) — `docs/specs/2026-08-12-snake-game-design.md`
- ADR 0004 — `createSeededRng(Date.now())` as the single origin of production
  non-determinism, and the no-op transition contract the chase relies on when a
  turn is rejected
- ADR 0005 — ports over ambient access: the discipline that rules out a test
  hook in production code
- ADR 0003 — `applyTheme`'s DOM effects, the one thing the logic-only suite
  cannot reach and the reason for the `data-theme` assertion
- `docs/architecture.md` § CSS custom property contract — `--x` / `--y`,
  `--board-cols` / `--board-rows`, `data-direction`: the read surface this spec
  steers by
- `docs/architecture.md` § Enforcement — the "Behaviour end to end" and "A tick
  never invalidates the board layer" rows
- `docs/architecture.md` § The e2e sits outside `src/` — why no boundaries rule
  sees the spec and why `tsconfig.json` still does
- `e2e/smoke.spec.ts`, `playwright.config.ts` — the executable form of
  everything above
