# snake-me — architecture map

**Living document.** It describes what exists *now* plus where the not-yet-built
parts will go. Every chunk that adds or fills a slice updates the inventory
below in the same PR; chunk 06 did the final sync.

Frozen reasoning lives in `docs/adr/`. Gameplay and visual truth live in
`docs/specs/2026-08-12-snake-game-design.md`. This file is the map, not the
territory and not the argument.

- **Last synced:** chunk 06 — e2e smoke, README, closeout
- **State of the tree:** the game is feature-complete and every slice in the
  inventory below is `live`. `app/` composes the session, the loop, the keyboard
  adapter, the theme state and the scoreboard state, and owns the CSS cascade.
  The theme is applied to `:root` from `App` before the first paint; the player
  can switch among six themes through `widgets/theme-picker`, and the pick and
  the top-5 scoreboard both persist across a reload through `shared/storage`'s
  `KeyValueStore`. `features/scoreboard` was the last slice added (chunk 05).
  Chunk 06 added no slice and changed no file under `src/`: it turned
  `pnpm test:e2e` from a stub script into one real Chromium round
  (`e2e/smoke.spec.ts`) and gave the repo a `README.md`, which is the only
  public record of how it was built — the chunk contracts, plans and
  orchestration substrate under `.claude/` are untracked.

## Layers

```
app       composition — assembles widgets, owns the session, boots the theme
  │
widgets   composed UI blocks — one component per file
  │
features  reactive behaviour — session, game loop, theming, scoreboard
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
| `App.tsx` | live | Composition root: owns the session (`createGameSession`), starts `createGameLoop`, binds `createKeyboardControls`, restores and applies the theme (`createThemeState` + `applyTheme`), restores and records the scoreboard (`createScoreboardState`), and renders `Hud` + `GameStage` + `ThemePicker`. Passes `window` as both the `FrameScheduler` and the `KeyDownTarget`, `createSeededRng(Date.now())` as the rng, and `() => window.localStorage` as the storage provider (ADR 0004, 0005) | 01 → 03 → 04 → 05 |
| `main.tsx` | live | Entry point: mounts `<App />`, imports the stylesheet. The theme bootstrap deliberately lives in `App` instead: the theme state is shared with the picker and the board, and `App`'s body runs synchronously inside `render()`, before the first paint, so there is nothing a pre-mount hook would add | 01 → 05 |
| `styles/` | live | `index.css` declares the cascade order `@layer reset, tokens, layout, theme` once and imports `reset`, `tokens`, `layout`, `stage`, `entities`, `hud`, `theme-picker`, `theme`. `tokens.css` holds the 14 `dark-checker` defaults plus the geometry properties; `stage.css`, `entities.css`, `hud.css` and `theme-picker.css` each wrap their contents in `@layer layout`; `theme.css` wraps its contents in `@layer theme` | 01 → 04, 05 |

`styles/theme.css` holds four `[data-theme='…']` escape-hatch treatments
(`nokia`'s monochrome eyes and tongue, `neon`'s apple halo and eye ring — the
tongue and eye ring are contrast fixes from the chunk 05 review — see
[ADR 0006](adr/0006-theme-carries-no-components.md)) and stays empty **of
token declarations**, which is what ADR 0003's original
sentence about this file was actually about: the layer existed from day one so
the cascade order never had to change when `features/theming` started writing
theme tokens in chunk 05, and it still holds none — `applyTheme` writes the 14
tokens as an inline style on `:root`, which outranks every `@layer` regardless
of what `theme.css` contains.

**Board dimensions: one home, resolved in chunk 04.** `DEFAULT_RULES.cols` /
`.rows` in `entities/game/rules.ts` are the only copy. They reach CSS as an
inline style at exactly two elements — `App` sets `--board-cols` / `--board-rows`
on `.app__game` so the HUD matches the board's width, and `GameStage` sets them
on `.stage` so the widget is self-sufficient wherever it is mounted. Both read
the same props/constants, so there is no second literal. `tokens.css`
deliberately defines **no fallback**: if the inline style is ever lost the board
collapses visibly instead of quietly rendering a stale copy of 24×16.

### `widgets/` — composed UI

| Slice | Status | Contents | Lands in |
|-------|--------|----------|----------|
| `game-stage/` | live | `GameStage` (layer stack + geometry root: sets `--board-cols` / `--board-rows`, is the container-query container), `BoardLayer` (z0, one gradient element; its only prop is the active theme's `boardStyle`), `EntityLayer` (z1, promoted compositor layer), `SnakeView`, `SnakeSegment`, `ItemView`, `AppleSprite`, `BoltSprite`, `StartOverlay`, `GameOverOverlay` (now also renders the persisted top-5 scoreboard, via a `scores` prop threaded from `App`). **Public API: `GameStage` only** (+ `GameStageProps`) — `BoardStyle` moved to `features/theming` in chunk 05, so it is no longer re-exported here | 04, 05 |
| `hud/` | live | `Hud`, `ScoreCounter`, `StatusBadge` + `statusBadgeVariant.ts` (`statusBadgeVariant` — the badge precedence, the one logic-tested function in `widgets`). **Public API: `Hud` only** (+ `HudProps`) | 04 |
| `theme-picker/` | live | `ThemePicker` (enumerates `THEME_LIST`, one `role="group"` of buttons), `ThemeSwatch` (one theme: a token-derived preview plus the Space `stopPropagation`, ADR 0005 § Amendment). **Public API: `ThemePicker` only** (+ `ThemePickerProps`) | 05 |

### `features/` — reactive behaviour

| Slice | Status | Contents | Lands in |
|-------|--------|----------|----------|
| `game-session/` | live | `createGameSession` (engine state in one signal, `dispatch`, start / togglePause / restart / tick), `createGameLoop` (rAF + accumulator, `FrameScheduler` port) | 03 |
| `theming/` | live | `types.ts` (`ThemeId`, `BoardStyle`, `ThemeTokens`, `Theme`), `themes.ts` (the six-theme registry — `THEMES` private, `THEME_LIST` public, `themeById` internal), `applyTheme` (the only module that touches `document`), `createThemeState` (`store` + `apply` injected, one signal). **Public API:** `Theme`, `ThemeId`, `BoardStyle`, `ThemeTokens`, `THEME_LIST`, `applyTheme`, `createThemeState` (+ `ThemeState`, `ThemeStateOptions`) | 05 |
| `scoreboard/` | live | `createScoreboardState` (`store` + `now` injected, one signal; ordering and the top-five cut are delegated to `entities/game`'s `addScore` — this slice never re-implements ranking). **Public API:** `createScoreboardState` (+ `ScoreboardState`, `ScoreboardStateOptions`) | 05 |

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
| `storage/` | live | `KeyValueStore` port (`get(key, decode)` / `set`), `createWebStorageStore` over an injected `WebStorage` provider; keys `snake-me:theme:v1`, `snake-me:scoreboard:v1` live with their consumers, not in `shared` | 05 |

## Data flow

```
keyboard (shared/input) ─ControlSignal─▶ game-session ─commands─▶ engine
engine state ─signals─▶ widgets (EntityLayer diffs cells; BoardLayer never re-renders)
theme state ─applyTheme─▶ :root custom properties + data-theme
round result ─addScore─▶ scoreboard ─KeyValueStore─▶ localStorage
```

The adapter listens on `window`, so a widget that needs one of the keys it
claims takes it back by calling `stopPropagation()` — local beats global, and
the port stays three members wide (`key`, `repeat`, `preventDefault`; ADR 0005
§ Amendment). `ThemeSwatch` is the one call site today: its `onKeyDown` calls
`event.stopPropagation()` for `' '` only, so the adapter's Space (start / play
again) never sees the keydown while the swatch's own native button activation
still fires — arrows have no default action on a `<button>`, so a focused
swatch still steers the snake.

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

## CSS custom property contract

Three disjoint namespaces live in `app/styles`: theme tokens (`features/theming`
owns these), geometry (chunk 04 owns these), and the swatch preview
(`ThemeSwatch` owns these). None of the three may write into either of the
other two.

### Theme tokens — 14, one per `ThemeTokens` field

The property name is the exact kebab-case of the field name, so `applyTheme`
is a mechanical camelCase→kebab transform with no lookup table (this contract
is now live, not pending — `applyTheme` writes it on every load and every
selection). Defaults for `dark-checker` sit on `:root` in `tokens.css` (`@layer
tokens`); `applyTheme` writes the same names inline on the game root, and an
inline style outranks every `@layer` — which is why the defaults belong in the
tokens layer and `theme.css` can carry zero token declarations (ADR 0003).

**The game root is `document.documentElement` (`:root`), not `#root` or any
other mount node.** `applyTheme` writes the 14 properties and
`data-theme` there. That is load-bearing, not a stylistic choice: `body` paints
`background-color: var(--hud-bg)` (`layout.css`), and every candidate mount
node (`#root`, `.app`, `.app__game`) is a *descendant* of `body`. Custom
properties inherit downward only, so if `applyTheme` wrote a lower element
instead, `body` would keep the `:root` default forever and a switch to a light
theme would repaint the HUD and the board while the page background stayed
dark. Writing `:root` puts the inline style above `body` in the inheritance
chain, so `body` — and everything under it — inherits every token, page
background included.

| `ThemeTokens` field | CSS property | Consumed by |
|---|---|---|
| `boardBg` | `--board-bg` | `.stage` background, the `solid` board style, the overlay veil, `nokia`'s tongue and eye (both `[data-theme]` escape hatches, chunk 05 fix round) |
| `boardCellA` | `--board-cell-a` | checker gradient |
| `boardCellB` | `--board-cell-b` | checker gradient |
| `boardBorder` | `--board-border` | the wall ring on `.stage` |
| `snakeHead` | `--snake-head` | head tile, `nokia`'s eye pupil (`[data-theme]` escape hatch, chunk 05 fix round) |
| `snakeBody` | `--snake-body` | body tiles |
| `snakeTail` | `--snake-tail` | tail tile, `neon`'s eye ring (`[data-theme]` escape hatch, chunk 05 fix round) |
| `snakeShadow` | `--snake-shadow` | bottom offset shadow on every segment |
| `itemFood` | `--item-food` | apple body, its outline/highlight mixes, and the HUD's game-over chip background; also the snake's tongue by default, though `nokia` overrides the tongue to `--board-bg` (`[data-theme]` escape hatch, chunk 05 fix round) |
| `itemFoodAccent` | `--item-food-accent` | apple stem + leaf |
| `itemBoost` | `--item-boost` | bolt body, its outline mix, its halo, the boost chip background |
| `hudBg` | `--hud-bg` | page background, HUD bar, overlay panel, button text |
| `hudText` | `--hud-text` | page text, HUD text and hairline, overlay text, focus ring, all three HUD chips' label text (chunk 05 fix round), and (`theme-picker.css`) the swatch pill's tint, its label text and its focus ring |
| `hudAccent` | `--hud-accent` | score value, default chip background, primary button, and (`theme-picker.css`) the swatch's `[aria-pressed='true']` ring |

Nothing type-checks these strings against `themes.ts`. A rename lands in both
places in one commit or the widgets silently lose their paint — the seam ADR 0003
accepts by name.

### Geometry — chunk 04 owns these names, and a theme must not write them

| Property | Declared by | Value |
|---|---|---|
| `--board-cols`, `--board-rows` | inline style from `DEFAULT_RULES`: `App` on `.app__game`, `GameStage` on `.stage` | the only crossing from `rules.ts` into CSS; no fallback on purpose |
| `--cell-size` | `.stage__layer` in `stage.css` | `calc(100cqi / var(--board-cols))` — `.stage` is the `container-type: inline-size` container, so no JS measures anything |
| `--segment-gap`, `--segment-radius`, `--snake-shadow-depth` | `.stage__layer` | fractions of `--cell-size` |
| `--head-rotation` | `.snake__face[data-direction]` | `0deg` / `90deg` / `180deg` / `270deg` |
| `--x`, `--y` | inline style per segment and item | grid coordinates, unitless, multiplied by `--cell-size` inside `transform` |
| `--app-font`, `--app-gap`, `--app-chrome-block-size`, `--stage-max-inline-size`, `--board-wall-width` | `:root` in `tokens.css` | page and stage sizing — `--app-chrome-block-size` is `13rem` as of chunk 05 (title + HUD + theme picker + gaps) |

Structure that is data rather than colour travels as attributes:
`data-board-style` (`checker` \| `solid` — ADR 0003's board branch) and
`data-direction` on the head's face.

`--x`, `--y`, `--board-cols` / `--board-rows` and `data-direction` are also the
e2e's read surface: chunk 06's smoke steers by reading them off the DOM instead
of seeding the game, which is what keeps a seed seam out of production
([ADR 0007](adr/0007-e2e-plays-the-real-game.md)). Renaming one of them now
fails `pnpm test:e2e`, deliberately.

**Trap — an element cannot query itself.** `.stage` establishes the container
`--cell-size` is measured against, so no declaration *on `.stage`* may use
`--cell-size`; a `100cqi` there would resolve against the viewport instead. That
is why the wall is a fixed `--board-wall-width` ring and why every cell-derived
property is declared on `.stage__layer`, one level in.

### Swatch preview — 3, a third namespace owned by `ThemeSwatch`

| Property | Declared by | Value |
|---|---|---|
| `--swatch-board` | inline style per swatch in `ThemeSwatch` | that theme's `tokens.boardCellA` |
| `--swatch-snake` | inline style per swatch in `ThemeSwatch` | that theme's `tokens.snakeBody` |
| `--swatch-item` | inline style per swatch in `ThemeSwatch` | that theme's `tokens.itemFood` |

Disjoint from the frozen 14 and from the geometry names above on purpose
(ADR 0006). `ThemeSwatch` is the one place in the tree that reads token
*values* in JS instead of consuming `var(--…)`: the cascade only ever carries
the **active** theme, so previewing the other five themes cannot come from a
custom property. Bounded to three tokens, never the frozen fourteen, never a
geometry property.

**The only literal colours in the tree** are `#fff` (eye) and `#101418` (pupil)
in `entities.css`: `ThemeTokens` has no eye token and spec §5 fixes the eyes as
white everywhere else. `#000` / `#fff` otherwise appear only as `color-mix()`
anchors, never as paint. `nokia` needs different eyes — a hole in `--board-bg`
with an ink pupil in `--snake-head` — and gets them through ADR 0003's
`data-theme` escape hatch rather than a 15th token, as ADR 0006 formalises.

### Why a tick cannot repaint the board

Three mechanisms, in the order they stop work happening (spec §5, ADR 0001):

1. `BoardLayer`'s only prop is the active theme's `boardStyle`, so `GameState`
   never reaches it and a tick has nothing to invalidate — Solid re-runs a
   component only when a signal it reads changes, and this one reads none of
   the session's. The one dynamic binding left is the `data-board-style`
   attribute, and it changes only when the player picks a theme through
   `ThemePicker`, never on a tick. The checkerboard is still one gradient
   element rather than 384 nodes; the invariant survives chunk 05 even though
   `BoardLayer` is no longer literally propless. As of chunk 06 this mechanism
   is asserted, not only reasoned: `pnpm test:e2e` counts zero mutation records
   on `.stage__layer--board` across a live round (Enforcement row below).
2. The engine keeps every surviving segment's `Point` object identity across a
   tick, so a reference-keyed `<For>` over `snake.slice(1, -1)` inserts one row
   and removes one row; the interior rows are never touched. Head and tail are
   declared directly in `SnakeView`'s JSX, outside that list, so each is one
   persistent DOM element: a tick writes fresh `--x` / `--y` coordinate custom
   properties onto the head element (the engine always builds a new head
   `Point`) and, because the segment that now plays the tail role is a
   different `Point` reference than a tick ago, onto the tail element too. The
   `transform` itself is a static `calc()` in `entities.css` and is never
   rewritten from script — only its two inputs are. `<Index>` would be wrong
   here, and both items go through a non-keyed `<Show>` because the engine
   rebuilds the boost object every tick to decrement `ttlTicks`. The head half
   of this is asserted too: the same e2e round holds a reference to the head
   element across the round and compares it by identity at the end, so a
   rebuilt head node instead of a coordinate rewrite fails the gate. The `<For>`
   half — that interior rows are never touched — is not: nothing bounds the
   entities counter, so swapping `<For>` for `<Index>` would leave the head
   node intact and merely make that counter larger. It stays reasoned, not
   violation-proven.
3. Movement only ever writes the two coordinate custom properties (`--x`,
   `--y`); the `transform` that turns them into a pixel offset is declared once
   in CSS and never touched from script. `.stage__layer--entities` carries
   `will-change: transform` so the moving half of the stage owns its own
   compositor layer. That is the one `will-change` in the tree and it is
   load-bearing. Verified, not asserted: DevTools → Rendering → Paint flashing
   during a live round, per the chunk 04 demo criterion.

The e2e's zero-mutation assertion proves script never invalidates the board —
Solid never re-renders it and no tick rewrites its one dynamic attribute. It
proves nothing about the compositor: `will-change` is a hint, promotion is the
browser's decision, and no automated check in this repo observes paint. Paint
verification stays the manual DevTools "Paint flashing" pass from the chunk 04
demo criterion, and that is a deliberate stopping point, not an omission.

Compositor promotion is the browser's decision, not this codebase's —
`will-change` is a hint, not a guarantee. If paint flashing ever shows the
checkerboard repainting, the first suspect is not `will-change` but that
`.stage` clips its children with `overflow: hidden` **plus** `border-radius`,
and also carries `contain: layout style inline-size` via
`container-type: inline-size` — a rounded clip on an ancestor is a classic
reason Chrome masks or declines a promotion.

### Resolved in chunk 05

Every question the previous "Hand-off to chunk 05" section left open is now
closed:

- **Sprites stay where chunk 04 put them, permanently.** `Theme` carries no
  `SpriteSet` and never will: the one detailed SVG set lives in
  `widgets/game-stage` and recolours through the 14 `ThemeTokens` fields, so
  every theme already has its own apple and its own bolt with zero component
  threading. A theme that needs a different *treatment* ships a `[data-theme]`
  rule in `app/styles/theme.css` instead — see
  [ADR 0006](adr/0006-theme-carries-no-components.md), which narrows ADR 0003.
- **`BoardStyle` moved.** The canonical union now lives in
  `features/theming/types.ts`; `widgets/game-stage` imports it downward, and
  `game-stage`'s public API no longer re-exports it.
- **`applyTheme` writes the 14 names and `data-theme`, nothing else.** Geometry
  properties stay chunk 04's, per the contract above.
- **Eye and pupil colours use the `data-theme` escape hatch, not a 15th
  token.** `nokia`'s eyes and `neon`'s apple halo are the two live examples in
  `theme.css` (ADR 0006).
- **`applyTheme` writes to `document.documentElement` (`:root`)**, called
  synchronously from `App`, before the first paint — confirmed, not merely
  planned: there is no separate bootstrap in `main.tsx`.

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
| The 14-name emit contract (`applyTheme.ts`'s camelCase -> `--kebab-case` transform) | `pnpm test` | Split across two files by layer, not by assertion type. `features/theming/applyTheme.test.ts` (chunk 05 fix round) asserts the transform emits exactly the 14 frozen property names for a sample `ThemeTokens`, and that every registered theme's 14 values survive the transform unchanged. `test/theme-token-contract.test.ts` (chunk 05 second fix round) cross-checks, via `readFileSync` on `app/styles/tokens.css` — not an import — that all 14 names are declared on its `:root`; it sits in `test/` rather than the slice because that check spans `features/theming` and `app`, and `app` is not a sibling the slice test's boundaries carve-out covers. Review-enforced before either row landed, now gate-enforced on the emit side; the CSS side is checked as a subset, not proven exhaustive. `applyTheme`'s DOM effects (writing `document.documentElement`, calling `setAttribute`, and the `data-theme` value itself) stay outside `pnpm test` — no jsdom, per spec §8 — and are carried by the demo gate, plus, as of chunk 06, one `pnpm test:e2e` assertion that `<html>` carries a non-empty `data-theme` after boot: that gates the *fact* of the write, never the 14 values |
| TS strict across the repo | `pnpm typecheck` | `tsc --noEmit`, `strict: true` |
| Engine determinism (seeded RNG, golden tests) | `pnpm test` | vitest, environment `node` — and `node` is the **final** state, not a staging one: the project tests logic only (spec §8), so jsdom is never added |
| Session, engine, scoreboard and `shared/**` are headless (no ambient DOM, clock, scheduling or randomness) | `pnpm lint` | Two rules, scoped as of chunk 05 to `src/entities/**`, `src/features/game-session/**`, `src/features/scoreboard/**` and `src/shared/**`, tests excluded. `no-restricted-globals` bans direct references to `window`, `document`, `localStorage`, `requestAnimationFrame`, `cancelAnimationFrame`, `performance`, `Date`, `setTimeout`, `setInterval`, `queueMicrotask`, `self`, `navigator`, `crypto` and `globalThis` — it flags every reference eslint-scope resolves to that identifier, so a type-cast wrapper (`(globalThis as unknown as { window: Window }).window`) does not launder it past the rule. `no-restricted-properties` separately bans the *property* `Math.random` — `Math.max` / `.floor` / `.round` / `.imul` stay legal — but only when `Math` is a bare identifier: a cast on `Math` itself (`(Math as unknown as { random(): number }).random()`) is NOT caught by either rule, and that is where the rule deliberately stops. Closing it means banning the bare `Math` identifier, which takes every legitimate call site in `entities/game` down with it, and the residual hole is acceptable because that cast is not a slip anyone commits by accident — it is laundering written on purpose to get past a rule the author knew was there. This gate exists to keep production determinism safe from accidents; deliberate laundering is a review problem, not a lint problem. `features/theming` is deliberately out of scope ([ADR 0003](adr/0003-theme-model.md)): writing theme tokens onto `document` is that slice's job. `src/shared/**` joined the glob in chunk 05 **with no carve-out**: `shared/storage`'s `createWebStorageStore` takes the storage object as an injected provider (`() => window.localStorage`) rather than naming `localStorage` itself, so nothing under `shared/**` needs an ambient global; `features/scoreboard` joined for the same reason `game-session` is in the glob — the ISO date is an injected `now: () => string` ([ADR 0005 § Amendment](adr/0005-headless-session-ports.md)). The widened rule was re-proven with a deliberate violation before merge: a probe `localStorage.getItem(...)` in `shared/storage/keyValueStore.ts` produced `'localStorage' is restricted from being used. Headless by contract: take a port (ADR 0005)`, and the same probe pattern with `new Date().toISOString()` in `features/theming/applyTheme.ts` produced no `no-restricted-globals` error at all (only an unrelated unused-variable error) — proving both the rule's reach over `shared/**` and `features/theming`'s exclusion boundary in the same run |
| Behaviour end to end | `pnpm test:e2e` | `playwright test` — one Chromium project, one spec (`e2e/smoke.spec.ts`), one test: app loads → Start → the head leaves its starting cell → the score grows. It plays the real `createSeededRng(Date.now())` game rather than a seeded one and steers by reading `--x` / `--y` off the head and the apple plus `data-direction` off the head's face, so it restates no gameplay constant and production carries no seed param, no test hook and no `data-testid` ([ADR 0007](adr/0007-e2e-plays-the-real-game.md)). It also asserts `<html>` carries a non-empty `data-theme`. `webServer` runs `pnpm build && vite preview --port 4173 --strictPort` at Vite's `base`, so the round runs against the artifact Pages serves and a clean tree is green; `--strictPort` is load-bearing — without it Vite moves to 4174 and Playwright waits on 4173 until timeout. `retries: 0` on purpose: a retry would hide exactly the nondeterminism the chase design claims to have removed |
| A tick never invalidates the board layer | `pnpm test:e2e` | Two `MutationObserver`s installed before Start, watching `attributes` + `childList` + `subtree` + `characterData`: zero records on `.stage__layer--board` from before Start until the first apple is eaten, non-zero on `.stage__layer--entities` as the positive control (a probe that sees nothing anywhere proves nothing), plus board-node and head-node identity across the round — an observer on a node a tick replaced would report zero forever, for the wrong reason, so the zero-mutation count is only meaningful together with proof the observed node is still the live one. Covers mechanism 1 and the head half of mechanism 2 in [§ Why a tick cannot repaint the board](#why-a-tick-cannot-repaint-the-board); the compositor half stays the manual paint-flashing check. All of board-identity, entities and board counters were re-proven by deliberate violation before merge — aiming either counter's observer at the other layer, or replacing the board node under the board-identity observer, fails the run; the head-identity assertion is reasoned, not violation-proven |
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

**Trap — colocated names can collide on case alone.** Chunk 04 first named
`widgets/hud`'s logic module `statusBadge.ts`, next to `StatusBadge.tsx`; `tsc
--noEmit` refused with TS1149/TS1261 because TypeScript treats the two paths as
the same file regardless of filesystem case-sensitivity. It shipped as
`statusBadgeVariant.ts` — a slice-internal logic module cannot share a name with
the case-variant of a component file colocated beside it, and `tsc`, not the
filesystem, is what enforces that.

### The e2e sits outside `src/`, and that is what exempts it

`e2e/smoke.spec.ts` and `playwright.config.ts` live at the repo root, not under
`src/`, so `boundaries/dependencies`, `boundaries/no-unknown-files` and the
headless `no-restricted-globals` block — all three scoped to `src/**` — never
see them. That is why the spec may name `window`, `document` and
`MutationObserver` freely: it is the browser's side of the wire, not a slice.
It is outside vitest's `include` (`vite.config.ts`), so `pnpm test` never runs
it and the suite stays logic-only. It **is** inside `tsconfig.json`'s `include`,
so `pnpm typecheck` covers it — one compiler, no second config to drift.
Verified rather than assumed: a temporary `const x: number = 'oops';` in the
spec made `pnpm typecheck` fail with `error TS2322`, then it was reverted.

`eslint.config.js`'s `ignores` also lists `playwright-report/**` and
`test-results/**`, for a reason worth stating because CI never exposes it:
**ESLint does not read `.gitignore`.** Once a local `pnpm test:e2e` has created
those directories, `eslint .` walks into their generated JS and
`--max-warnings=0` fails on output nobody wrote. CI never hits it — lint runs
before the e2e — so it would only ever bite a developer. `.prettierignore`
carries the same two entries, belt and braces.

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

`verify` gained one step in chunk 06: `pnpm exec playwright install --with-deps
chromium`, immediately before `pnpm test:e2e`, because browsers do not come from
the pnpm store. The job name did not change and must not. The e2e's `webServer`
runs `pnpm build` itself, so it rebuilds what the `pnpm build` step produced two
lines earlier — kept deliberately: the build is a gate in its own right and has
to fail on its own line, and one `webServer` command keeps local and CI on a
single code path.

Not yet executable — enforced by review, and promoted to a lint rule if the
mistake recurs (`.claude/orchestration.md` § Harvest):

- one component per file; no grab-bag util module *inside* a slice — a grab-bag
  *outside* every slice is already a lint error (`boundaries/no-unknown-files`)
- all gameplay numbers as named constants in `entities/game/rules.ts` — with no
  exceptions since chunk 04 (`app/styles/tokens.css` no longer restates the
  board size; see [`app/`](#app--composition))
- zero `eslint-disable` comments anywhere in the tree — the boundaries exception
  for tests lives in `eslint.config.js` and nowhere else
- **the keyboard adapter's target stays `window`.** `ThemeSwatch`'s
  `stopPropagation()` convention (§ Data flow, ADR 0005 § Amendment) works
  because `createKeyboardControls` listens on `window`, one hop above where
  Solid delegates `keydown` (`document`); `stopPropagation()` does not stop
  other listeners on the *same* node, so attaching the adapter to `document`
  instead would put it on the same node as Solid's delegated listener and
  silently break the convention with no type error or lint failure

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
| [0006](adr/0006-theme-carries-no-components.md) | Theme carries palette and board style, not components | proposed |
| [0007](adr/0007-e2e-plays-the-real-game.md) | The e2e plays the real game: the test adapts, production grows no seed seam | proposed |
