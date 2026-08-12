# ADR 0001: Solid.js + TypeScript (strict) + Vite

- **Status:** proposed
- **Date:** 2026-08-12
- **Deciders:** Lior

## Context

Ratified in the design spec §2 (decisions 1 and 2); recorded here for the ADR log.

snake-me is a portfolio showcase, not a product with users to serve. That shapes
the constraints:

- **Static hosting only.** No backend, no accounts (spec §1). The build is a
  bundle on GitHub Pages, so payload size is a visible quality signal.
- **Small, hot render surface.** A 16 × 24 board advancing every 150 ms
  (spec §3). Each tick moves a handful of cells; the static board background
  and the walls never change during a round.
- **A pure core that must stay framework-free.** The engine is a deterministic
  reducer in `entities/game` that imports nothing (ADR 0002). Only the view
  layer is coupled to whatever framework we pick, which caps the blast radius
  of this decision.
- **The stack itself is part of the artifact.** A reader should see a
  deliberate choice, not a default.

## Decision

Build the view layer with **Solid.js**, in **TypeScript with `strict`**, bundled
by **Vite** (`vite-plugin-solid`). Package manager: pnpm (spec §2, decision 9).

Rendering is **DOM + CSS custom properties** — a grid of elements positioned by
CSS transforms, with no canvas or WebGL (spec §2, decision 2). This is not a
separate choice so much as the reason Solid fits: the stage is a layered DOM
tree (`BoardLayer` z0 / `EntityLayer` z1 / HUD z2, spec §5), and Solid's
fine-grained reactivity updates exactly the entity nodes that changed without
re-running the components that own the static layers.

The engine and the view meet in one place: `features/game-session` wraps engine
state in signals. Nothing below that layer knows Solid exists.

## Consequences

- Per-tick updates touch only changed nodes. `BoardLayer` renders once and is
  never re-run by a tick — an invariant we can check in DevTools paint flashing
  (chunk 04 demo criterion), not just assert.
- Theming becomes a CSS concern rather than a render concern: swapping a theme
  writes custom properties on one root element and the cascade does the rest
  (ADR 0003). No component re-render, no VDOM pass.
- Small runtime and no virtual DOM keeps the Pages bundle honest.
- **Cost — ecosystem size.** Fewer libraries and fewer answers than React. We
  are accepting this for a self-contained game with no third-party UI needs.
- **Cost — Solid's JSX is not React's.** Props must not be destructured, and
  components run once rather than on every update. React habits break quietly
  here. Mitigation: `eslint-plugin-solid`'s TypeScript preset runs in
  `pnpm lint` — but only the flag makes it a gate. The preset splits severities:
  `solid/no-destructure` and `solid/prefer-for` ship as errors, while the
  reactivity-scope rules (`solid/reactivity`, `solid/components-return-once`,
  `solid/event-handlers`) ship as **warnings**, and `eslint` exits 0 on
  warnings. What turns them into a failure is `pnpm lint` being
  `eslint . --max-warnings=0 && prettier --check .`. Drop `--max-warnings=0` and
  every Solid reactivity rule silently becomes advisory while the gate keeps
  printing green — the same trap class as the boundaries resolver setting
  (`docs/architecture.md` § Enforcement). Review catches the rest.
- **Cost — the compiler version is pinned by the lint gate, not by taste.**
  `typescript-eslint@8.67.0` declares its peer as `typescript: ">=4.8.4 <6.1.0"`,
  so the refusal boundary is **TS 6.1**, not the next major. The dependency is
  therefore `~6.0.3` rather than `^6.0.3` — the caret would let 6.1 in. Crossing
  that line would mean dropping `pnpm lint`, and with it the boundaries gate the
  whole architecture rests on (ADR 0002). The upgrade waits for
  typescript-eslint, and is a deliberate decision, not a dependabot bump.
- **No component or render tests, ever.** The project tests logic only
  (spec §8), so `@solidjs/testing-library` and jsdom never enter the tree and
  `environment: 'node'` in `vite.config.ts` is the **final** state, not a staging
  one. What a Solid component actually paints is carried by the behavioral demo
  gate and the single Playwright smoke (chunk 06) — the two places that exercise
  a real browser. Engine tests need no DOM at all, which is the point of
  ADR 0002.
- Should the framework choice ever be revisited, the rewrite is confined to
  `app/`, `widgets/` and the reactive half of `features/` — `entities/game`
  and `shared/` port out unchanged.

## Alternatives considered

- **React** — the largest ecosystem and the safest hiring signal, but every
  tick pays a VDOM diff for a change we can address directly, and the bundle is
  heavier for a page that renders one screen. Nothing in this project needs what
  React is good at.
- **Svelte** — comparable ergonomics and output size. Rejected on explicitness:
  reactivity triggered by assignment reads as magic, whereas signals make the
  dependency graph legible — and legibility is the deliverable here.
- **Vanilla TypeScript + direct DOM** — smallest possible output, zero
  dependencies. Rejected because the HUD, overlays and theme picker would end up
  with a hand-rolled reactivity layer: the same work, less rigorously, with
  nothing to show for it.
- **Canvas / WebGL rendering** (spec §2, decision 2) — the reflex choice for
  games, and wrong at this scale. A 16 × 24 grid at ~7 ticks/s is not a DOM
  performance problem, while canvas would cost us CSS-custom-property theming,
  inspectable markup, and free layout and accessibility.

## References

- Design spec §2 (decisions 1, 2, 9), §4 (data flow), §5 (visual design),
  §8 (quality gates — logic-only testing policy) —
  `docs/specs/2026-08-12-snake-game-design.md`
- `package.json` — the pinned versions this ADR argues about and the `lint`
  script whose `--max-warnings=0` gives the Solid rules teeth;
  `vite.config.ts` — Pages base path and the vitest environment
- ADR 0002 — trimmed FSD (why the framework choice stays contained)
- ADR 0003 — theme model (why theming rides on CSS custom properties)
- `docs/architecture.md` — living architecture map; § Toolchain pins records the
  `eslint-plugin-solid` peer-range gap that any eslint upgrade has to re-verify
