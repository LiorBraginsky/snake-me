# ADR 0003: Typed theme registry with CSS custom properties

- **Status:** proposed
- **Date:** 2026-08-12
- **Deciders:** Lior
- **Narrowed by:** [ADR 0006](0006-theme-carries-no-components.md) — `Theme`
  carries no components.

## Context

Ratified in the design spec §2 (decision 7) and §6; recorded here for the ADR log.

The game ships **six themes**: `dark-checker` (default), `dark-solid`,
`light-checker`, `light-solid`, `nokia`, `neon`. They are not six palettes of
the same picture:

- The board is structurally different per theme — `checker` alternates two cell
  colours, `solid` paints one background. That is a branch in `BoardLayer`, not
  a colour.
- Sprites may differ per theme. The four base themes share one SVG set
  recoloured through tokens; `nokia` and `neon` may bring their own shapes
  (spec §6).
- Switching happens at runtime, mid-session, and must persist across reloads
  (spec §7) without disturbing the game loop.

The failure mode to design out is a **half-defined theme**: a theme that omits
a token, builds fine, and renders an invisible snake on someone else's machine.
The compiler should refuse it.

## Decision

A **typed theme registry** in `features/theming`.

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
}
```

- `ThemeTokens` is a **closed record of required fields**. A theme that omits
  one fails `pnpm typecheck`. Completeness is a gate, not a checklist.
- Structural variation is **typed data**, not a CSS trick: `boardStyle` is a
  field the board layer branches on.
- `themes.ts` holds the registry keyed by `ThemeId`; the picker enumerates the
  registry, so registry and UI cannot drift apart.
- **`applyTheme`** is the only bridge from TypeScript to paint: it writes each
  token as a CSS custom property on the game root and sets `data-theme="<id>"`.
- Components **never read token values in JS**. They reference
  `var(--snake-body)` and friends in CSS; the cascade distributes the change.
- `data-theme` is the escape hatch for the rare rule that a colour variable
  cannot express (e.g. a monochrome LCD treatment for `nokia`).
- Persistence goes through the `KeyValueStore` port (`snake-me:theme:v1`), which
  falls back to the default theme silently when storage is unavailable or
  corrupt (spec §7).

The cascade is staged for this already: `src/app/styles/index.css` declares
`@layer reset, tokens, layout, theme` once, and `theme.css` is deliberately empty
until chunk 05 — so landing the themes changes contents, never cascade order.

## Consequences

- A theme switch is ~14 property writes on one element. Zero component
  re-renders, zero per-cell JS work, no interaction with the tick loop — which
  is what makes live switching mid-round safe.
- Adding a token is a deliberately loud change: all six themes must supply it or
  the build fails. That is the intended cost — it is mechanical, complete, and
  impossible to half-finish.
- **Cost — the token names are a frozen contract.** Chunk 04 hardcodes the
  `dark-checker` values as custom-property defaults in `app/styles`; chunk 05's
  registry must emit exactly those names or the widgets silently lose their
  paint. A rename must land in both places in one commit. Nothing type-checks
  the string names against the stylesheet — this is the seam in the design, and
  it is why the names are treated as a contract rather than an implementation
  detail. **Closed on the emit side as of the chunk 05 fix round:**
  `features/theming/applyTheme.test.ts` asserts `themeCustomProperties` emits
  exactly the 14 frozen names for every registered theme. The other half —
  that all 14 are declared on `tokens.css`'s `:root` — is a cross-check between
  `features/theming` and `app`, not between two siblings, so it lives one
  layer above both, in `test/theme-token-contract.test.ts` (chunk 05 second
  fix round). The CSS side is checked as a subset (tokens.css may legitimately
  declare more, e.g. geometry), not proven exhaustive the other way — a name
  renamed in `themes.ts` but never removed from `tokens.css` would still pass.
  The seam is narrower, not gone.
- **Cost — contrast is not type-checkable.** "Snake and items stay legible on
  every board background a theme uses" (spec §6) survives only as a behavioral
  demo criterion in chunk 05. The compiler guarantees a theme is *complete*, not
  that it is *readable*.
- Testing splits by what needs a DOM, and only one half gets tests. Type-level:
  a theme missing a token fails to compile — that is the completeness gate.
  Logic: the persistence round-trip through the `KeyValueStore` port, including
  the fallback on corrupt or unavailable storage, runs on vitest's `node`
  environment against a fake store. Everything DOM-dependent — `applyTheme`
  actually writing the custom properties, the picker rendering the registry —
  gets **no** unit test: the project tests logic only (spec §8), so those halves
  are carried by the chunk 05 behavioral demo and the chunk 06 Playwright smoke.
  There is no jsdom in this project and none is coming.
- Sprites are **not** theme data (ADR 0006): a per-theme sprite treatment is a
  `[data-theme]` rule, which is the same escape hatch this ADR already defines
  for the eyes.

## Alternatives considered

- **CSS-only themes — a `[data-theme="x"] { --token: … }` block per theme.**
  No TypeScript, less code. Rejected: a missing variable is silent (falls back
  or renders nothing), and `boardStyle` / per-theme sprites cannot be expressed
  as data the components can branch on.
- **Tailwind or a utility framework's theme config.** Drags a build-level
  dependency and a config indirection into a project with one screen, and
  runtime switching still ends up on custom properties anyway.
- **CSS-in-JS / a theme context provider passing tokens as values.** Idiomatic
  in React-land, but it moves colours into the reactive graph: every consumer
  re-reads on switch. Custom properties get the same result from the cascade for
  free.
- **A base token set with per-theme partial overrides** (`Partial<ThemeTokens>`
  merged over a default). Less repetition across six themes. Rejected precisely
  because partial themes type-check — the drift this ADR exists to prevent would
  become invisible again.

## References

- Design spec §2 (decision 7), §5 (visual design), §6 (theming), §7 (storage),
  §8 (quality gates — logic-only testing policy)
  — `docs/specs/2026-08-12-snake-game-design.md`
- ADR 0001 — Solid.js (why the cascade, not the render loop, carries theming)
- ADR 0002 — trimmed FSD (where `features/theming` and `shared/storage` sit)
- `docs/architecture.md` — slice inventory and current status
