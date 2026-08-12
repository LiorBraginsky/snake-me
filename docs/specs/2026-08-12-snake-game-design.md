---
status: draft
created: 2026-08-12
feeds: decompose (chunk cut)
---

# snake-me — Design Spec

A classic snake game built as a **portfolio showcase**: clean design patterns,
small well-bounded modules, and a disciplined agentic delivery pipeline.
Deployed to GitHub Pages.

## 1. Goals & non-goals

**Goals**

- Classic snake gameplay, polished feel, portrait board.
- Architecture that reads as a statement: trimmed FSD, one-way dependencies,
  a pure deterministic game core, a token-driven theme layer.
- Every rule that matters is *executable* (lint, typecheck, tests) — not prose.

**Non-goals**

- No backend, no accounts, no multiplayer. Persistence = `localStorage` only.
- No canvas/WebGL engine — DOM + CSS is a deliberate choice at this scale.
- No mobile/touch controls in v1 (keyboard only; layout stays responsive).

## 2. Ratified decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Framework | **Solid.js** + TypeScript (strict) + Vite |
| 2 | Rendering | **DOM grid + CSS custom properties** (no canvas) |
| 3 | Architecture | **Trimmed FSD**: `app → widgets → features → entities → shared` |
| 4 | Scene | Layered stage: static board layer / entity layer / HUD |
| 5 | Snake pattern | Square segments, gaps between, **bottom offset shadow** (2.5D tile) |
| 6 | Sprites | **Detailed SVG** (outlines, highlights); recolorable via theme tokens |
| 7 | Theming | Typed theme registry; `boardStyle` (checker/solid) is per-theme; 6 themes |
| 8 | Storage | `localStorage` behind a `KeyValueStore` port: theme + top-5 scoreboard |
| 9 | Package manager | pnpm |
| 10 | Delivery | Agentic conveyor: spec → chunks → orchestrated PRs → auto-merge on green CI |

## 3. Game rules

### Board & lifecycle

- Grid **16 × 24** (portrait, width × height). Walls are solid: leaving the
  board is game over (no wrap-around).
- Statuses: `idle → running ⇄ paused → game-over → running (restart)`.
- Game starts in `idle`; a **Start button** begins the round (never auto-start).
- Pause toggle: **P** or **Esc**. While paused, ticks stop and input is not queued.
- Game over screen shows final score + scoreboard; **Space** or a button restarts.

### Snake & movement

- Initial snake: length 3, centered, heading **right**. Base tick: **150 ms**.
- Turning 180° is ignored. Direction changes go through a **queue of depth 2**
  (two quick turns between ticks are both honored, in order).
- Arrows + WASD both work.

### Items & scoring

| Item | Spawn | Effect | Expiry |
|------|-------|--------|--------|
| Apple | exactly one on board at all times, on a random free cell | +10 points, +1 segment | never |
| Boost ⚡ | 20% chance after an apple is eaten, on a random free cell | +5 points, speed ×1.6 for 5 s | disappears after 30 ticks if not taken |

- Picking a boost while one is active **extends the timer** (resets duration);
  the multiplier never stacks.
- "5 s" is implemented as a tick-count constant (`BOOST_DURATION_TICKS`,
  computed from the boosted interval) — the engine counts ticks, not wall-clock.
- Death: wall or own body.
- **Scoreboard**: top-5 results (`score` + ISO date), persisted, shown on game over.

All numeric values above are named constants in `entities/game/rules.ts`.

## 4. Architecture — trimmed FSD

Layers (imports point strictly downward; no cross-imports between slices of
one layer; each slice exposes a public API via its `index.ts`):

```
src/
├── app/                          # composition layer
│   ├── App.tsx                   #   assembles widgets, owns the game session
│   ├── main.tsx                  #   entry: render + theme bootstrap
│   └── styles/                   #   @layer reset, tokens, layout, theme
├── widgets/                      # composed UI blocks — one component per file
│   ├── game-stage/               #   GameStage (stack, --cell-size), BoardLayer (z0,
│   │                             #   static), EntityLayer (z1), SnakeView, ItemView,
│   │                             #   StartOverlay / GameOverOverlay
│   ├── hud/                      #   Hud, ScoreCounter, StatusBadge
│   └── theme-picker/             #   ThemePicker
├── features/
│   ├── game-session/             #   createGameSession (signals, start/pause/restart,
│   │                             #   input binding), createGameLoop (rAF + accumulator)
│   └── theming/                  #   themes registry, applyTheme, createThemeState
├── entities/
│   └── game/                     #   types, engine (pure reducer), rules, rng port
└── shared/
    ├── input/                    #   keyboard → ControlSignal (no game knowledge)
    └── storage/                  #   KeyValueStore port + localStorage adapter
```

**Invariants (all lint-enforced, see §8):**

- `entities/game` imports **nothing** (not even `shared`) — pure TS, testable without DOM.
- One component per file. Deep imports across slice boundaries are forbidden.
- Direction of dependencies: `app → widgets → features → entities → shared`.

**Patterns on display:** pure reducer state machine (engine), ports & adapters
(input, storage, rng), token-based strategy (themes), thin reactive view layer.

### Engine API (pure, deterministic)

```ts
createInitialState(rules, rng): GameState
start(state): GameState
togglePause(state): GameState
turn(state, dir): GameState        // validates 180°, enqueues (depth 2)
tick(state, rng): GameState        // consumes queue head, moves, eats, collides
restart(state, rules, rng): GameState
```

`GameState` holds snake segments, direction + queue, items (`food`, optional
`boost` with `ttlTicks`), score, status, `boostTicksRemaining`. Effective tick
interval is **derived**: `BASE_TICK / (boost active ? 1.6 : 1)`. RNG is an
injected interface (seeded in tests).

### Data flow

```
keyboard (shared/input) ─ControlSignal─▶ game-session ─commands─▶ engine
engine state ─signals─▶ widgets (EntityLayer diffs cells; BoardLayer never re-renders)
theme state ─CSS custom properties─▶ stage & HUD
```

Game loop: `requestAnimationFrame` + accumulator; advances the engine when the
accumulated time exceeds the current tick interval; pauses cleanly on `paused`.

## 5. Visual design

- **Stage layers:** BoardLayer (z0) — static background, checker or solid per
  theme, walls as border; EntityLayer (z1) — snake + items, positioned by CSS
  transforms from grid coords (`--cell-size`); HUD (z2) — separate widget.
- **Snake:** square segments with gaps; **bottom offset shadow**
  (`box-shadow: 0 Npx 0 var(--snake-shadow)`) for a 2.5D tile look. Head:
  lighter fill, white eyes with pupils, small tongue. Tail: smaller, tapered.
- **Sprites (detailed SVG set):** apple — red with dark outline, highlight,
  stem + leaf; boost — lightning bolt with outline and soft halo. Sprites are
  Solid components; all fills come from theme CSS variables.

## 6. Theming

```ts
interface ThemeTokens {
  boardBg: string; boardCellA: string; boardCellB: string; boardBorder: string;
  snakeHead: string; snakeBody: string; snakeTail: string; snakeShadow: string;
  itemFood: string; itemFoodAccent: string; itemBoost: string;
  hudBg: string; hudText: string; hudAccent: string;
}
interface Theme {
  id: ThemeId; label: string;
  boardStyle: 'checker' | 'solid';   // checker uses cellA/cellB, solid uses boardBg
  tokens: ThemeTokens;
  sprites: SpriteSet;                 // per-theme SVG components (apple, boost)
}
```

- Registry in `features/theming/themes.ts`. The compiler enforces token
  completeness — a theme cannot omit a token and still build.
- `applyTheme` writes tokens as CSS custom properties on the game root and sets
  `data-theme="<id>"`.
- **Six themes:** `dark-checker` (default, classic colors), `dark-solid`,
  `light-checker`, `light-solid`, `nokia` (monochrome LCD), `neon`.
- Themes may share one `SpriteSet` recolored via tokens (the four base themes
  do) or override it with their own shapes (`nokia`, `neon` may).
- Contrast rule: snake and items must stay legible on every board background a
  theme uses (both checker cells, or the solid fill) — verified per theme at
  the demo gate.

## 7. Storage

- `KeyValueStore` port: typed `get<T>` / `set<T>` with JSON serialization.
- `localStorage` adapter; versioned keys: `snake-me:theme:v1`,
  `snake-me:scoreboard:v1`.
- **Failure policy:** corrupt JSON or unavailable storage (private mode) falls
  back to defaults silently — the game must never crash because of storage.
  The engine itself is pure and cannot throw on user input.

## 8. Quality gates

| Gate | Command | Enforces |
|------|---------|----------|
| Typecheck | `pnpm typecheck` | TS strict; theme token completeness |
| Lint | `pnpm lint` | ESLint + `eslint-plugin-boundaries` (FSD layers, no deep imports) + Prettier |
| Tests (logic only) | `pnpm test` | logic tests only: engine golden tests, storage fallback paths, game-session semantics (pause/queue). No render, markup or snapshot tests; UI correctness is carried by the behavioral demo gate and the single Playwright smoke (chunk 06) |
| E2E smoke | `pnpm test:e2e` | Playwright, 1 spec: start → snake moves → score grows |
| Build | `pnpm build` | Vite production build |

**Test focus (engine golden tests):** movement, growth, wall/self collision,
apple respawn on free cells only (seeded RNG), boost lifecycle (spawn chance,
TTL, extend-not-stack), direction queue depth 2 + 180° rejection, pause/idle
semantics, scoreboard top-5 ordering.

## 9. CI / CD

- `ci.yml` (every PR): install → typecheck → lint → test → build → e2e smoke.
  Branch protection requires green CI; PRs **auto-merge (squash)** on green.
- `deploy.yml` (push to `main`): `vite build` with `base: '/snake-me/'` →
  GitHub Pages via `actions/deploy-pages`.
- One chunk = one PR = one squashed commit on `main`.

## 10. Delivery process (pointer)

Process substrate lives in `.claude/orchestration.md` (untracked): gates,
ownership, chunk template, verified-done rules. Product decisions worth
freezing become ADRs in `docs/adr/` (first three: framework choice, trimmed
FSD, theme model). This spec feeds the decompose act; chunks land in
`.claude/work/chunks/`.
