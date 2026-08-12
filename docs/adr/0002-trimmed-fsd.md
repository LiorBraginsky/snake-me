# ADR 0002: Trimmed Feature-Sliced Design as the module architecture

- **Status:** proposed
- **Date:** 2026-08-12
- **Deciders:** Lior

## Context

Ratified in the design spec §2 (decision 3) and §4; recorded here for the ADR log.

The point of this repo is that the structure holds up under reading. A snake
game is small enough that any structure "works" — which means the architecture
has to earn its place by being *enforceable*, not by being necessary.

Two things drive the shape:

- **The game core must be pure.** A deterministic reducer plus a seeded RNG
  gives us golden tests with no DOM, no jsdom, no fake framework runtime
  (spec §8). That only holds if the core is structurally unable to reach for a
  browser API or a Solid signal.
- **Direction of dependencies must be checkable.** Prose conventions about
  "don't import upward" rot on contact with the first deadline. If the rule
  matters, `pnpm lint` has to fail on it (`.claude/orchestration.md`
  § Harvest).

Canonical Feature-Sliced Design ships more layers than this project has meaning
for: `pages` and `processes` are empty concepts in a single-screen game.

## Decision

Adopt **trimmed FSD** — five layers, imports pointing strictly downward:

```
app → widgets → features → entities → shared
```

Rules:

1. **Downward only.** A layer may import from layers below it, never above.
2. **No sideways imports.** Slices within one layer do not import each other;
   shared logic moves down a layer.
3. **Public API per slice.** Every slice exposes its surface through
   `index.ts`. Deep imports across a slice boundary are forbidden.
4. **`entities/game` imports nothing** — not even `shared`. Pure TypeScript, no
   DOM, deterministic under an injected RNG.
5. **One component per file, and every file inside a slice.** No grab-bag
   `utils.ts`; a module is named for what it is, and it lives somewhere.
6. **All gameplay numbers are named constants** in `entities/game/rules.ts`.

Trimmed relative to canonical FSD: no `pages` layer (one screen), no
`processes` layer (the game loop is a feature), and no segment sub-structure
inside slices beyond what a slice actually needs.

Enforcement is mechanical. Rules 1–4 are **one** ESLint rule:
`boundaries/dependencies` from `eslint-plugin-boundaries` v7, configured in
`eslint.config.js`. (In v7 `boundaries/element-types` and `boundaries/entry-point`
are deprecated aliases of that same rule; this repo does not use them.) The
"every file inside a slice" half of rule 5 is a second rule in the same block.

| Rule | Gate | Encoding |
|------|------|----------|
| 1 — downward only | `pnpm lint` | `boundaries/dependencies`: `default: "disallow"` plus one allow-policy per layer, each naming only the layers below it |
| 2 — no sideways | `pnpm lint` | falls out of rule 1 — no policy lets a layer reach itself |
| 3 — public API | `pnpm lint` | every allow-policy targets `fileInternalPath: "index.ts"` |
| 4 — pure core | `pnpm lint` | the `entities` layer gets **no** allow-policy at all; `checkAllOrigins: true` extends that to npm packages and node builtins, `checkUnknownLocals: true` to local files matching no element pattern |
| 5 — every file inside a slice | `pnpm lint` | `boundaries/no-unknown-files: "error"` — a `src/**/*.{ts,tsx}` file belonging to no element is an error in its own right |
| 5 — one component per file | review | promoted to an executable rule if it recurs |
| 6 — gameplay constants | review | promoted to an executable rule if it recurs |

Rule 4 is implemented one notch stricter than it is worded above and in
`CLAUDE.md`: the ban applies to the `entities` **layer**, not to the `game`
slice, because `game` is the layer's only slice (spec §4). **Revisit trigger:**
before a second `entities` slice lands, re-decide whether the ban stays
layer-wide or has to be narrowed to `entities/game`.

**Tests are colocated, and rules 1–4 do not apply to them.** A test lives next
to the code it tests (`src/entities/game/engine.test.ts`), and
`eslint.config.js` turns `boundaries/dependencies` **off** for
`src/**/*.test.{ts,tsx}` via a config glob. The reasoning: the invariant guards
the direction of *production* dependencies, and a test importing `vitest` or
reaching a slice's internals for a fixture is not one — `*.test.*` files never
enter the bundle, since `vite build` only walks `src/app`'s import graph. A pure
reducer must also be testable **directly**; routing engine tests through
`entities/game/index.ts` would turn the slice facade into a testing artifact
instead of a public API. The exception is glob-scoped, not a hole in the slice:
chunk 01 proved both directions — `engine.test.ts` importing `vitest` lints
clean, while a production `src/entities/game/probe.ts` with the identical import
still fails `pnpm lint`. Rule 5 is *not* switched off for tests and does not need
to be: a colocated test lives inside its slice and is classified like any other
file there. **Standing condition:** this exception exists in `eslint.config.js`
and nowhere else — zero `eslint-disable` comments in the tree.

`eslint.config.js` is the authoritative statement of rules 1–5; this ADR states
the intent, not the config. Chunk 01 proved the gate live rather than merely
present: a synthetic upward import (`entities → app`) and a synthetic sideways
one (`features/game-session → features/theming`) both had to fail `pnpm lint`,
with the output pasted into the PR, before they were removed.

That proof paid for itself immediately — the first version of the rule was a
silent no-op. `eslint-plugin-boundaries` resolves import specifiers through
`eslint-import-resolver-node`, which knows nothing about `.ts` / `.tsx`, so every
local import classified as an "unknown" element, and `checkUnknownLocals` (false
by default) skipped it; the rule passed everything while reporting green. Four
things are load-bearing, not one: the `import/resolver` extensions,
`checkAllOrigins: true`, `checkUnknownLocals: true`, and the companion rule
`boundaries/no-unknown-files`. The first three make `boundaries/dependencies`
see an import edge at all; the fourth covers what that rule structurally cannot —
a file that is itself unclassified, which the dependency rule never visits. The
maintainer warning lives in `docs/architecture.md` § Enforcement, next to the
table people actually read.

## Consequences

- The engine is testable in milliseconds with no environment setup, and its
  tests are golden tests — same seed, same output (spec §8).
- Ports land where they belong: RNG in `entities/game` (the core defines what
  it needs), keyboard and storage in `shared` (adapters the app wires up).
  The dependency rule produces ports & adapters as a side effect rather than as
  a separate ceremony.
- A framework swap (ADR 0001) cannot reach the core.
- **"Where does this file go?" has no escape answer.** A module that fits no
  slice cannot be parked at the root of `src/` while someone decides — that is a
  lint error. The question has to be answered when the file is created, which is
  the only time the answer is cheap.
- Chunk boundaries fall out of layer boundaries: chunk 02 is `entities`,
  chunk 03 is `shared/input` + `features/game-session`, chunk 04 is `widgets`,
  chunk 05 is `features/theming` + `shared/storage`. Parallel work has fewer
  collisions because slices own files, not features own files.
- **Cost — ceremony.** Every slice carries an `index.ts` re-export. Small
  slices look over-packaged. Accepted: the `fileInternalPath` policy is what
  makes rule 3 checkable.
- **Cost — no reaching sideways.** Two slices in one layer that want the same
  helper must either push it down to `shared` or duplicate it. This will feel
  wrong at least once, and pushing down is the answer — `shared` is for things
  with no domain knowledge.
- **Cost — file count.** One component per file plus one constant file inflates
  the tree. For a repo meant to be *read*, this trades favourably.
- **Cost — a test file may deep-import across a slice boundary.** That is the
  accepted price of the colocation decision above: the test glob buys direct
  access to a slice's internals, and nothing but review stops a test from using
  it gratuitously. Production files gain nothing — the same import outside the
  glob still errors.
- **Cost — the gate has a silent failure mode.** The whole architecture rests on
  one config block that has to be told four separate things: that TypeScript
  exists, that npm and node builtins count, that unclassified local files count
  as import targets, and that an unclassified file is itself an error. Removing
  any of the four does not error — it disables part of the architecture while
  `pnpm lint` stays green. Mitigation is procedural, not structural: re-prove
  with a deliberate violation after any change to the boundaries block.
- **Consequence — cross-slice imports stay relative.** No path aliases: an alias
  would need declaring in `tsconfig.json`, `vite.config.ts` *and* the boundaries
  resolver, and the copy that drifts is the one that decides whether the
  architectural gate still sees the import. `../../entities/game` is uglier and
  honest.

## Alternatives considered

- **Flat `src/components` + `src/lib`** — the fastest thing that works at this
  size, and it has no direction to enforce. That absence is exactly what this
  project is trying to demonstrate the opposite of.
- **Canonical FSD (with `pages`, `processes`, full segment layout)** — the
  recognisable version, at the price of layers that would sit empty. Empty
  layers teach a reader that the structure is copied, not chosen.
- **Hexagonal / clean architecture with an explicit ports-and-adapters tree** —
  same guarantees, more scaffolding. The three ports we genuinely need (rng,
  input, storage) already emerge from the layer rule; a dedicated `ports/`
  layer would add naming without adding constraint.
- **Feature folders with no layering** (`src/features/*` each self-contained) —
  good colocation, but nothing stops a feature from importing another feature,
  and the pure core would have no structural home.
- **Tests in a parallel `test/` tree, outside `src/`** — would need no boundaries
  exception at all, since the rules are scoped to `src/**`. Rejected: it
  separates a test from the module it describes, and it hides the exception
  rather than removing it — the engine would still have to be reachable for
  testing, just through a longer path.

## References

- Design spec §2 (decision 3), §4 (layers, invariants, engine API, data flow),
  §8 (quality gates) — `docs/specs/2026-08-12-snake-game-design.md`
- `CLAUDE.md` § Architecture invariants (lint-enforced)
- `eslint.config.js` — `boundaries/dependencies` with its resolver settings and
  two `check*` flags, `boundaries/no-unknown-files`, and the test-glob
  exception; the executable form of rules 1–5
- ADR 0001 — Solid.js (the choice this architecture contains)
- ADR 0003 — theme model (a `features` slice that obeys these rules)
- `docs/architecture.md` — slice inventory, enforcement table, the colocated-test
  exception, and the four-part trap that keeps the gate real
