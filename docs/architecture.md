# snake-me — architecture map

**Living document.** It describes what exists *now* plus where the not-yet-built
parts will go. Every chunk that adds or fills a slice updates the inventory
below in the same PR; chunk 06 does the final sync.

Frozen reasoning lives in `docs/adr/`. Gameplay and visual truth live in
`docs/specs/2026-08-12-snake-game-design.md`. This file is the map, not the
territory and not the argument.

- **Last synced:** chunk 03 — input, session, loop
- **State of the tree:** `app/` still renders a placeholder shell and owns the
  CSS cascade; `entities/game`, `shared/input` and `features/game-session` are
  live. The remaining five slices are `index.ts` stubs (a comment plus
  `export {}`).

## Layers

```
app       composition — assembles widgets, owns the session, boots the theme
  │
widgets   composed UI blocks — one component per file
  │
features  reactive behaviour — session, game loop, theming
  │
entities  domain — the pure game core
  │
shared    framework-agnostic ports & adapters — input, storage
```

**Direction rule:** imports point strictly **downward**. A layer may import from
layers below it, never above and never sideways — two slices of the same layer
do not import each other; anything they both need moves down a layer.

**Public API rule:** a slice is reached only through its `index.ts`. Deep imports
across a slice boundary are forbidden.

**Purity rule:** `entities/game` imports **nothing** — not `shared`, not Solid,
not the DOM, not an npm package. Determinism comes from an injected RNG port.

**Membership rule:** every file under `src/` belongs to a slice. A module that
matches no slice is not "unowned", it is an error.

All four are lint-enforced; see [Enforcement](#enforcement).

The lint config states the purity rule one notch stricter than `CLAUDE.md` does:
the ban applies to the whole `entities` **layer**, not to the `game` slice,
because `game` is the layer's only slice today. **Revisit trigger:** before a
second `entities` slice lands, re-decide whether the ban stays layer-wide or has
to be narrowed to `entities/game`.

**No path aliases.** Cross-slice imports are relative (`../../entities/game`). An
alias would have to be declared three times — `tsconfig.json`, `vite.config.ts`
and the boundaries resolver — and every copy is a chance for the architectural
gate and the compiler to disagree about what a specifier means.

Rationale and rejected alternatives: [ADR 0002](adr/0002-trimmed-fsd.md).

## Slice inventory

Status: `stub` — folder and public API exist, no behaviour · `partial` — some
of the slice is real · `live` — complete per spec.

### `app/` — composition

| Module | Status | Purpose | Lands in |
|--------|--------|---------|----------|
| `App.tsx` | partial | Assembles widgets, owns the game session — today a title plus a `stage-placeholder` box at the board's aspect ratio | 01 shell → 04 |
| `main.tsx` | partial | Entry point: mounts `<App />` into `#root`, imports the stylesheet; theme bootstrap still to come | 01 → 05 |
| `styles/` | partial | `index.css` declares the cascade order `@layer reset, tokens, layout, theme` once and imports the four files; each file wraps its own contents in its layer | 01 → 04, 05 |

`styles/theme.css` is deliberately **empty**: the layer exists from day one so
the cascade order never has to change when `features/theming` starts writing
theme tokens in chunk 05 ([ADR 0003](adr/0003-theme-model.md)).

**Known duplication — board dimensions, owner chunk 04.** `styles/tokens.css`
defines `--board-cols: 24` / `--board-rows: 16` and `styles/layout.css` derives
the placeholder box from them (`aspect-ratio: var(--board-cols) /
var(--board-rows)`). Those are gameplay numbers, and `CLAUDE.md` puts gameplay
numbers in `entities/game/rules.ts` — which exists as of chunk 02 and exports
them as `DEFAULT_RULES.cols` / `DEFAULT_RULES.rows`. This is a chunk-01
placeholder, not a second home for the board size: **chunk 04** must derive the
custom properties from `rules.ts` when it builds the real stage, and delete the
literals here. Until then the board size is stated in two places and nothing
checks that they agree.

### `widgets/` — composed UI

| Slice | Status | Contents | Lands in |
|-------|--------|----------|----------|
| `game-stage/` | stub | `GameStage` (layer stack, owns `--cell-size`), `BoardLayer` (z0, static), `EntityLayer` (z1), `SnakeView`, `ItemView`, `StartOverlay`, `GameOverOverlay` | 04 |
| `hud/` | stub | `Hud`, `ScoreCounter`, `StatusBadge` | 04 |
| `theme-picker/` | stub | `ThemePicker` | 05 |

### `features/` — reactive behaviour

| Slice | Status | Contents | Lands in |
|-------|--------|----------|----------|
| `game-session/` | live | `createGameSession` (engine state in one signal, `dispatch`, start / togglePause / restart / tick), `createGameLoop` (rAF + accumulator, `FrameScheduler` port) | 03 |
| `theming/` | stub | Theme registry (6 themes), `applyTheme`, `createThemeState` | 05 |

### `entities/` — domain

| Slice | Status | Contents | Lands in |
|-------|--------|----------|----------|
| `game/` | live | `types.ts`, `rules.ts` (all gameplay constants + `DEFAULT_RULES`), `board.ts` (board/direction geometry, slice-internal), `engine.ts` (pure reducer), `rng.ts` (`Rng` port + mulberry32 `createSeededRng`), `scoreboard.ts` | 02 |

The engine takes its configuration as a value: `Rules` and `Rng` are injected
into every transition that needs them (`createInitialState(rules, rng)`,
`turn(state, rules, direction)`, `tick(state, rules, rng)`,
`restart(rules, rng)`, `tickIntervalMs(state, rules)`). Spec §4 originally
sketched `tick(state, rng)`, a signature with no access to the board bounds it
needs; the snippet was corrected to match the code in chunk 02 — see ADR 0004.
Production code only ever passes `DEFAULT_RULES`; tests shrink the board so
spawn and collision arithmetic stays checkable by hand. `board.ts` is not
re-exported from `index.ts`: the public surface is the contract chunks 03–05
import against.

### `shared/` — ports & adapters

| Slice | Status | Contents | Lands in |
|-------|--------|----------|----------|
| `input/` | live | `createKeyboardControls`, `ControlSignal`, `KeyDownTarget` port; imports nothing at all | 03 |
| `storage/` | stub | `KeyValueStore` port + `localStorage` adapter, versioned keys | 05 |

## Data flow

```
keyboard (shared/input) ─ControlSignal─▶ game-session ─commands─▶ engine
engine state ─signals─▶ widgets (EntityLayer diffs cells; BoardLayer never re-renders)
theme state ─CSS custom properties─▶ stage & HUD
```

The engine is a pure reducer: `createInitialState`, `start`, `togglePause`,
`turn`, `tick`, `restart`, `tickIntervalMs` (spec §4). It is driven by
`createGameLoop` — `requestAnimationFrame` plus an accumulator that advances the
engine when the elapsed time exceeds `tickIntervalMs(state, rules)`. That is the
function the loop calls for the current (boost-derived) interval; the boost
multiplier is applied there and nowhere else, so no caller restates `1.6`.

The loop takes at most one tick per frame and drops a stalled backlog with
`accumulated %= interval` rather than replaying it — a multi-interval gap means
the tab was asleep, not that the snake owes the player a fast-forward into a
wall. The session and the loop are headless: `Rules`, `Rng`, a `FrameScheduler`
and a `KeyDownTarget` all arrive as injected values, none as an ambient global.
The composition root supplies all four in chunk 04 — `window` satisfies both
ports structurally, and `createSeededRng(Date.now())` supplies the rng, per
[ADR 0004](adr/0004-engine-api.md). See
[ADR 0005](adr/0005-headless-session-ports.md).

Theme tokens cross into CSS exactly once, in `applyTheme`; components read
`var(--token)` and never token values in JS ([ADR 0003](adr/0003-theme-model.md)).

## Enforcement

Invariants are commands, not paragraphs. If a rule below stops being executable,
it stops being a rule.

| Invariant | Gate | Mechanism |
|-----------|------|-----------|
| Layer direction `app → widgets → features → entities → shared` | `pnpm lint` | `boundaries/dependencies` — `default: "disallow"` plus one allow-policy per layer, each naming only the layers below it |
| No sideways imports between slices of a layer | `pnpm lint` | same rule — no policy lets a layer reach itself |
| Slices reached only via `index.ts` | `pnpm lint` | same rule — every allow-policy targets `fileInternalPath: "index.ts"` |
| `entities` imports nothing, npm and node builtins included | `pnpm lint` | same rule — the `entities` layer has **no** allow-policy at all; `checkAllOrigins: true` extends that beyond local files, `checkUnknownLocals: true` to local files matching no element pattern |
| Every file under `src/` belongs to a slice | `pnpm lint` | `boundaries/no-unknown-files: "error"` — a `.ts` / `.tsx` file matching no `boundaries/elements` pattern is an error in its own right, not merely unimportable |
| Solid reactivity / JSX correctness | `pnpm lint` | `eslint-plugin-solid` `flat/typescript` preset — its reactivity rules ship as `warn`, so `--max-warnings=0` is what turns them into a failure |
| Theme token completeness | `pnpm typecheck` | `ThemeTokens` is a closed required record |
| TS strict across the repo | `pnpm typecheck` | `tsc --noEmit`, `strict: true` |
| Engine determinism (seeded RNG, golden tests) | `pnpm test` | vitest, environment `node` — and `node` is the **final** state, not a staging one: the project tests logic only (spec §8), so jsdom is never added |
| Session and engine are headless (no ambient DOM, clock, scheduling or randomness) | `pnpm lint` | Two rules, scoped to `src/entities/**` and `src/features/game-session/**`, tests excluded. `no-restricted-globals` bans direct references to `window`, `document`, `localStorage`, `requestAnimationFrame`, `cancelAnimationFrame`, `performance`, `Date`, `setTimeout`, `setInterval`, `queueMicrotask`, `self`, `navigator`, `crypto` and `globalThis` — it flags every reference eslint-scope resolves to that identifier, so a type-cast wrapper (`(globalThis as unknown as { window: Window }).window`) does not launder it past the rule. `no-restricted-properties` separately bans the *property* `Math.random` — `Math.max` / `.floor` / `.round` / `.imul` stay legal — but only when `Math` is a bare identifier: a cast on `Math` itself (`(Math as unknown as { random(): number }).random()`) is NOT caught by either rule; no test in this codebase relies on that gap being closed. `features/theming` is deliberately out of scope ([ADR 0003](adr/0003-theme-model.md)), and so is `src/shared/**` — `shared/storage` is specified as a `localStorage` adapter (chunk 05) ([ADR 0005](adr/0005-headless-session-ports.md)) |
| Behaviour end to end | `pnpm test:e2e` | Playwright smoke — a stub script until chunk 06, already wired into CI so chunk 06 replaces a script body rather than the workflow |
| Formatting | `pnpm lint` | `prettier --check .` |

`pnpm lint` is `eslint . --max-warnings=0 && prettier --check .`. The flag is
part of the gate, not noise reduction — see the trap below.

The four *dependency* invariants are **one** ESLint rule:
`boundaries/dependencies` from `eslint-plugin-boundaries` v7. `element-types` and
`entry-point` are deprecated aliases of it in v7 and are not used here — do not
reintroduce them. The membership invariant is its companion,
`boundaries/no-unknown-files`, in the same config block. Both are scoped to
`src/**/*.{ts,tsx}`; `test/`, `vite.config.ts` and other tooling are not elements
and are not checked.

### Tests live colocated, and the exception lives in the config

Tests sit next to the code they test — `src/entities/game/engine.test.ts`, not a
parallel `test/` tree. `eslint.config.js` switches `boundaries/dependencies`
**off** for `src/**/*.test.{ts,tsx}` through a config glob (the block after the
boundaries config).

Why the exception is not a hole:

- The invariant guards the direction of **production** dependencies. A test that
  imports `vitest`, or reaches into a slice's internals to build a fixture, is
  not a production dependency.
- `*.test.*` files never enter the bundle — `vite build` only ever walks
  `src/app`'s import graph.
- A pure reducer has to be testable **directly**. Forcing engine tests through
  `entities/game/index.ts` would make the slice facade a testing artifact rather
  than a public API.

Only `boundaries/dependencies` is switched off. `boundaries/no-unknown-files`
still applies to tests, which costs nothing: a colocated test lives inside its
slice, so it is classified like any other file there.

**Accepted cost:** a test file *can* deep-import across a slice boundary,
deliberately. Production files gain nothing — the exception is scoped to the test
glob, so the same import in a non-test file still errors. Chunk 01 proved both
directions: `src/entities/game/engine.test.ts` importing `vitest` lints clean,
while a production `src/entities/game/probe.ts` with the identical import still
fails `pnpm lint`.

> **Standing condition — zero `eslint-disable` comments in the tree.** The test
> exception exists in `eslint.config.js` and nowhere else. A per-file or per-line
> disable moves the architecture out of the config and into whoever last needed
> to ship: it is reviewable in one place or it is not reviewable.

`eslint.config.js` and `tsconfig.json` are authoritative; this table is a
pointer. If a rule name or mechanism changes there, update this row.

### Trap: four things make the boundaries gate real

`boundaries/dependencies` classifies both ends of an import by resolving the
specifier. Three settings decide whether that classification produces a check at
all, and a fourth rule covers the case the other three structurally cannot.
Remove any one and the gate keeps printing green while enforcing less than the
table above claims.

| Setting / rule | What stops being checked without it |
|----------------|-------------------------------------|
| `import/resolver` → node `extensions` incl. `.ts` / `.tsx` | `eslint-import-resolver-node` defaults to `['.mjs', '.js', '.json', '.node']` — no TypeScript. Every relative import to a `.tsx` file or a directory's `index.ts` classifies as an "unknown" element and is skipped: the rule fires on **nothing**. |
| `checkAllOrigins: true` | Only local imports are checked. `entities/game` may import any npm package or node builtin — the purity rule becomes a comment. |
| `checkUnknownLocals: true` | Local imports whose *target* matches no `boundaries/elements` pattern are skipped. `entities/game` could import a `src/helpers.ts` grab-bag and lint stays green. |
| `boundaries/no-unknown-files: 'error'` | The *source* side goes unchecked. `boundaries/dependencies` registers no visitors at all for a file that is itself unclassified, so a stray `src/utils.ts` could import in any direction, unreported. |

The first of these is exactly how the rule behaved on its first pass in chunk 01
— a silent no-op — and only the deliberate-violation proof below exposed it.

> **Do not "clean up" the boundaries block in `eslint.config.js`.** Deleting any
> of the four raises no error. It silently deletes part of the architecture while
> `pnpm lint` keeps printing green. Any edit to the boundaries block or its
> resolver must be re-proven with a deliberate violation before it merges.

**Both sides of an import edge are now covered.** `checkUnknownLocals: true`
closes the target side — you cannot import an unclassified file;
`boundaries/no-unknown-files` closes the source side — an unclassified file
cannot exist under `src/` in the first place. Together they turn "every file
lives in a slice" from a review habit into a lint error. Proven the same way as
everything else here: a temporary `src/utils.ts` produced
`File does not match any file pattern and does not belong to any known element`
and exit code 1, then it was deleted and the clean tree re-verified.

The rules are scoped to `src/**/*.{ts,tsx}`, so the membership guarantee is a
TypeScript guarantee. A stray `.js` file under `src/` would fall outside the
block — but nothing in the TypeScript tree could import it either, because that
import is the target side and is still checked. It would be dead weight, not a
back door.

The gate is therefore proven live rather than assumed. Chunk 01 landed two
synthetic dependency violations — an upward `entities → app` import and a
sideways `features/game-session → features/theming` import — showed `pnpm lint`
failing on both, then removed them. A green `pnpm lint` is not by itself evidence
that the rule ran.

### Toolchain pins the gates depend on

Both are version constraints the gates rest on, not cosmetics.

- **`typescript` stays on 6.0.x.** `typescript-eslint@8.67.0` declares
  `typescript: ">=4.8.4 <6.1.0"`, so the refusal boundary is **TS 6.1** — not the
  next major. `^6.0.3` would let 6.1 in, so the dependency is `~6.0.3`. Crossing
  that line means dropping `pnpm lint` — and the boundaries gate with it. The
  compiler upgrade waits for typescript-eslint
  ([ADR 0001](adr/0001-solid-js.md)).
- **`eslint-plugin-solid@0.14.5` predates eslint 10.** Its peer range is
  `eslint: ^6 || ^7 || ^8 || ^9` while `eslint@10.8.1` is installed, and
  `pnpm install` prints no warning about it. The rules do load and fire today —
  `solid/no-destructure` errors on a destructured prop. Any eslint upgrade must
  re-verify that they still load: silent non-loading is the same failure class as
  the resolver trap — green output, no check.

### CI

`.github/workflows/ci.yml` runs all five gates in a single job named **`verify`**
— which is therefore the status-check context branch protection has to require.
Renaming the job renames the required check, and a required check that no longer
exists blocks nothing.

`ci.yml` triggers on `pull_request` **and** on `push` to `main`, because
`deploy.yml` runs no gates at all — it installs, builds and publishes. `main` is
verified by `ci.yml` or not at all. For the same reason `deploy.yml` has no
`workflow_dispatch` trigger: that would be a publish path around the gates.

Both workflows take Node from `node-version-file: .nvmrc`, not a hardcoded
version, so CI and a local `nvm use` cannot drift apart.

Not yet executable — enforced by review, and promoted to a lint rule if the
mistake recurs (`.claude/orchestration.md` § Harvest):

- one component per file; no grab-bag util module *inside* a slice — a grab-bag
  *outside* every slice is already a lint error (`boundaries/no-unknown-files`)
- all gameplay numbers as named constants in `entities/game/rules.ts` — with one
  live exception, the board dimensions in `app/styles/tokens.css` (see
  [`app/`](#app--composition)), owned by chunk 04
- zero `eslint-disable` comments anywhere in the tree — the boundaries exception
  for tests lives in `eslint.config.js` and nowhere else

## Adding a new slice

1. **Pick the layer by dependency need, not by topic.** What does it import? A
   module that needs `entities` cannot live in `shared`. A module that needs
   nothing belongs as low as it can go.
2. `src/<layer>/<slice-name>/` — kebab-case folder.
3. Add `index.ts` exporting only the public surface. Everything else in the
   slice is private by construction, because every allow-policy names
   `fileInternalPath: "index.ts"`.
4. A slice in an existing layer needs **no** config change: `boundaries/elements`
   matches `src/<layer>/*` by glob. A new *layer* is a different matter — it
   needs its own element type plus an allow-policy in each layer above it.
5. If it is a UI slice: one component per file, named for what it renders.
6. Add a row to the inventory above with status `stub` or `live`.
7. Run `pnpm lint && pnpm typecheck && pnpm test`.

**Before creating a slice, prefer not to.** A new slice is justified when it has
its own public API and its own reason to change — not when a file needs a home.
A file with nowhere to live does not get to sit at the root of `src/`: that is a
lint error, and the answer is to find the layer it belongs in.

## Decisions

| ADR | Subject | Status |
|-----|---------|--------|
| [0001](adr/0001-solid-js.md) | Solid.js + TypeScript (strict) + Vite; DOM rendering, no canvas | proposed |
| [0002](adr/0002-trimmed-fsd.md) | Trimmed FSD, one-way imports, pure `entities/game` | proposed |
| [0003](adr/0003-theme-model.md) | Typed theme registry + CSS custom properties | proposed |
| [0004](adr/0004-engine-api.md) | Engine API: injected `Rules` and `Rng`, no-op transitions return their input, board-full ends the round | proposed |
| [0005](adr/0005-headless-session-ports.md) | Headless session: time and input as ports the composition root supplies | proposed |
