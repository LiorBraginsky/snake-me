# ADR 0006: Theme carries palette and board style, not components

- **Status:** proposed
- **Date:** 2026-08-13
- **Deciders:** Lior

## Context

Spec §6 and ADR 0003 put a `sprites: SpriteSet` field on the `Theme` object:

```ts
interface Theme {
  id: ThemeId; label: string;
  boardStyle: 'checker' | 'solid';
  tokens: ThemeTokens;
  sprites: SpriteSet;                 // per-theme SVG components (apple, boost)
}
```

`features` may not import `widgets` (the trimmed-FSD direction rule), so chunk
04 could not put `SpriteSet` on `Theme` at all: the one detailed SVG set —
`AppleSprite`, `BoltSprite` — had to be parked inside `widgets/game-stage`, with
every fill and `color-mix` anchor taken from the 14 theme tokens rather than a
literal colour. `docs/architecture.md` § Hand-off to chunk 05 left the
permanent home as an open question for this chunk: move the base set down into
`features/theming` and pass it into `GameStage` as a prop, or keep the base set
in the widget and let a theme carry overrides only.

## Decision

`Theme` is `{ id, label, boardStyle, tokens }` — no `sprites` field and no
`SpriteSet` type ships.

The one detailed SVG set lives in `widgets/game-stage` and recolours through
the 14 `ThemeTokens` fields, so each of the six themes already has its own
apple and its own bolt with zero component threading. A theme that needs a
different *treatment* — not a different palette — ships a `[data-theme='…']`
rule in `app/styles/theme.css`: ADR 0003's own escape hatch, exercised here by
two live examples. `nokia`'s eyes become a hole in the ink (`--board-bg`) with
an ink pupil (`--snake-head`), because `ThemeTokens` has no eye field and spec
§5 fixes the eyes as white everywhere else. `neon`'s apple gets the halo the
bolt already has in `entities.css`, via `filter: drop-shadow(...)` keyed off
`--item-food`.

## Alternatives considered

- **Sprites as components in a new `shared/ui` slice.** Legal — `shared` may
  import npm, so Solid components are not forbidden there — but it contradicts
  `docs/architecture.md`'s layer description (`shared` = "framework-agnostic
  ports & adapters — input, storage") and spec §4's tree. It needs a new slice,
  an ADR *and* a spec §4 amendment, and it threads a component set through
  `App` → `GameStage` → `EntityLayer` → `ItemView` (four hops) plus `<Dynamic>`
  rendering — all so that six themes can share one identical set.
- **`SpriteSet` as ids, with the widget branching on them.** Same four-hop
  threading, plus a branch inside `ItemView`, plus a second SVG set someone has
  to actually draw and contrast-check. Spec §6 says `nokia`/`neon` *may*
  override — not must. Buying the mechanism before there is a shape to put in
  it is speculative.
- **A base set in the widget, with the theme carrying overrides only.** An
  "overrides" field cannot hold components under the FSD direction rule, so it
  degenerates into the id variant above with an optional field that is
  `undefined` six times out of six. `Partial`-shaped theme data is exactly what
  ADR 0003's last rejected alternative ("a base token set with per-theme
  partial overrides") already refuses, for the same reason: partial themes
  type-check, so the drift ADR 0003 exists to prevent becomes invisible again.

## Consequences

- A theme override is now a CSS rule, not a data change — the inverse of ADR
  0003's final consequence ("Sprites living inside the theme object means a
  theme override is a data change, not a conditional inside `ItemView`"). A
  genuinely different sprite *shape* per theme (not just a treatment) would
  need this ADR superseded.
- Zero prop threading, no `<Dynamic>`, no fourth slice: `Theme` keeps the same
  four fields chunk 04 already consumes structurally (`boardStyle`, `tokens`).
- `ThemeSwatch`'s preview is the one place in the tree that reads token
  *values* in JS. The cascade only ever carries the **active** theme, so a
  preview of the other five cannot come from `var(--…)`. It is bounded to
  three tokens (`boardCellA`, `snakeBody`, `itemFood`) written into a separate
  `--swatch-*` namespace — never the frozen 14, never a geometry property.
- Nothing in spec §6 asked for a genuinely different sprite shape per theme;
  "may bring their own shapes" is satisfied by the `data-theme` treatment.

## References

- Design spec §5 (visual design), §6 (theming)
  — `docs/specs/2026-08-12-snake-game-design.md`
- ADR 0003 — theme registry and `applyTheme`; narrowed by this ADR
- `docs/architecture.md` § Hand-off to chunk 05 — the open question this ADR
  closes
- `src/app/styles/entities.css` — the sprite fills and `color-mix` anchors this
  decision relies on
- `src/app/styles/theme.css` — the two `[data-theme]` escape-hatch rules
