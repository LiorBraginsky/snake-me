# ADR 0004: Engine API — injected rules and rng

- **Status:** proposed
- **Date:** 2026-08-13
- **Deciders:** Lior

## Context

ADRs 0001–0003 record decisions the design spec had already ratified. This one
runs the other way: it records what building the core in chunk 02 forced, so
chunks 03–05 build against a stated contract instead of re-deriving it.

Spec §4 sketched the engine as six signatures. Three of them cannot be
implemented as written:

- `tick(state, rng)` has no access to the board bounds it needs for wall
  collision, nor to `boostSpawnChance` for the boost roll.
- `turn(state, dir)` has no access to the queue depth, so it cannot know when a
  third turn must be dropped.
- `restart(state, rules, rng)` takes a `state` with nothing to carry forward —
  the score resets and the scoreboard lives outside the engine — and
  `noUnusedParameters` in `tsconfig.json` rejects a parameter that is only
  decorative.

The purity rule (ADR 0002) narrows the ways out. `entities/game` imports
nothing, so configuration either arrives as a value or sits in a module constant
the transition reaches for on its own. There is no third option and nothing to
ask at runtime.

And the reason this chunk exists is golden tests. On the default 24 × 16 board
(spec §3) the nearest wall is twelve ticks from the starting head, and a board
with no free cell left is a 383-segment serpentine fixture. Either the board is
a parameter or those edges are untestable by hand.

The fork was escalated before implementation and resolved by Jimmy on
2026-08-13: *"spec §4 was written as a sketch — a signature with no access to
the rules is a defect of the sketch, not a contract."* The §4 snippet is
therefore corrected to match the code, in the same PR as this ADR.

## Decision

**Configuration is a parameter, not a module import.** Every transition that
needs a gameplay number takes `Rules` explicitly, in the uniform argument order
**state, rules, payload**:

```ts
createInitialState(rules, rng): GameState
start(state): GameState
togglePause(state): GameState
turn(state, rules, direction): GameState
tick(state, rules, rng): GameState
restart(rules, rng): GameState
tickIntervalMs(state, rules): number
```

`rules.ts` names every gameplay constant exactly once — the numbers of spec §3
plus the starting direction — and exports the `Rules` type plus `DEFAULT_RULES`
assembled from them. Production code passes `DEFAULT_RULES` and nothing else;
only tests construct a different `Rules`. `CLAUDE.md`'s invariant is untouched —
the numbers still live in exactly one file, they are just read through a
parameter instead of an import.

**A no-op transition returns its input by reference**, not a clone: `turn` and
`tick` outside `running`, `start` outside `idle`, `togglePause` outside
`running` / `paused`. Chunk 03's Solid signal relies on this to skip
notification when nothing happened, and `engine.test.ts` asserts it with `toBe`.
That makes it a contract, not an accident of the implementation.

**`food` is `FoodItem | undefined`, and a board with no free cell ends the
round.** Eating the last apple returns `status: 'game-over'` with that apple
scored, the snake grown and `food: undefined`. There is deliberately **no `won`
status**: spec §3's status set (`idle → running ⇄ paused → game-over`) is
closed, and the requirement is that chunk 04's HUD and overlays handle exactly
one terminal status with no special case.

**A death tick is a pure status flip.** When the head hits a wall or its own
body, `tick` returns `{ ...state, status: 'game-over' }` — the snake does not
move, the queue head is not consumed and no counter changes, so
`boostTicksRemaining` comes back exactly as it went in. Nothing downstream ever
has to render a head outside the board or inside a segment, and the test is one
exact-equality assertion. The board-full end (above) is the one game-over that
*does* carry a moved snake, because that move was legal.

Three smaller clauses belong to the same API contract:

- **The `Rng` port is `{ next(): number }`**, uniform in the half-open range
  `[0, 1)` — `Math.random`'s contract. The shipped implementation is a seeded
  mulberry32 (`createSeededRng(seed)`), hand-written because the purity rule
  forbids an npm PRNG and because `Math.imul` plus unsigned shifts are
  bit-identical on every JS engine — `rng.test.ts` pins the first draws of two
  seeds as a golden vector, so changing the algorithm or one of its constants
  fails loudly instead of silently reshuffling every seeded round. No
  `Math.random` adapter ships at all: production non-determinism is
  `createSeededRng(Date.now())` at the call site, above the slice.
- **Free-cell selection is defined over a row-major free list** (y outer, x
  inner), with one draw mapped as `free[floor(next() * free.length)]`. That
  order is part of the module's contract rather than an implementation detail —
  it is what makes a seeded spawn predictable: draw `0` is the first free cell,
  `0.999…` the last.
- **The tick phase order is a contract**: queue head → wall check → eat test,
  tail drop, self check → boost countdown → new snake → boost pickup → boost
  TTL → apple respawn (draw 1) → boost roll (draw 2) and its cell (draw 3).
  Three of those orderings carry meaning: the countdown sits after both
  collision checks because a death tick changes no counter (above), pickup
  before TTL makes a boost pickable on the last tick of its life, and TTL before
  respawn frees an expiring boost's cell for the new apple. Tests script the RNG
  draws in that order and the stub throws when the engine asks for one more, so
  a reordering fails loudly.

## Consequences

- Golden tests state an edge case instead of constructing one. Fixtures shrink
  the board to 5 × 5 or 2 × 2, so wall collision is one tick of setup and the
  board-full end is a four-cell fixture rather than 383 segments of serpentine.
- `tickIntervalMs` is the only place the boost multiplier is applied, so chunk
  03's loop derives its interval from the engine instead of restating `1.6`.
- **Cost — every call site threads `rules`.** `features/game-session` holds a
  `Rules` and passes it on every command. That is deliberate noise, taken over a
  hidden dependency: the signature says what a transition depends on.
- **Cost — a perfect player sees "game over", not a win screen.** Filling the
  board is the best possible outcome and it reads as a loss. Stated honestly
  rather than papered over. Adding a win state means a new status, a new overlay
  and a session branch — a new chunk, not a bug fix.
- **Cost — two orderings are contracts that nothing type-checks.** The row-major
  free list and the tick phase order are load-bearing for every seeded test, yet
  a refactor that reorders either compiles fine. Mitigation is the scripted-RNG
  stub: it throws on an unexpected extra draw, so the tests fail loudly instead
  of drifting.
- **Cost — `Rules` is structurally open.** Any object of the right shape is
  accepted, including boards the game would never ship. Accepted: it is a value,
  not validated config, and that openness is the whole testing benefit.
- Spec §4 now matches `engine.ts`. Spec text that contradicts the code is worse
  than either signature set, which is why the snippet was corrected rather than
  worked around.
- **Ratification pending.** Status stays `proposed`; Lior's ratification is
  batched with ADRs 0001–0003 and does not gate the chunk-02 merge.

## Alternatives considered

- **The literal spec signatures, with `tick` and `turn` reading module
  constants** (escalation option (a)) — the smallest diff from §4, and it keeps
  the document true by fiat. Rejected: `restart` would keep a decorative `state`
  parameter, and one gameplay number would end up with two access paths — a
  parameter for some transitions, a module constant for others. Two ways to
  reach one value is how the value drifts.
- **No `rules` parameter at all — the engine imports its constants directly**
  (escalation option (c)) — the shortest signatures of the three and honest
  about where the numbers live. Rejected because every fixture would then be
  forced onto the real 24 × 16 board: wall collision becomes twelve ticks of
  setup and board-full a 383-cell serpentine nobody will read, which costs
  exactly the tests this chunk exists to write.
- **A `createEngine(rules)` factory closing over the configuration** — call
  sites get the short signatures and the numbers are bound once. Rejected:
  transitions would stop being plain functions of their arguments, which is the
  property both the golden tests and ADR 0002 rest on, and a test comparing two
  rule sets would have to build two engines instead of passing two values.
- **A `won` status for the board-full case** — arguably what the game *means*,
  and kinder to a perfect player. Rejected here: the status set is frozen in
  spec §3, and a fifth status ripples into chunk 03's session and chunk 04's
  overlays for an outcome no player will reach. It is a candidate chunk, not a
  defect.
- **`food: FoodItem | null`** — the conventional "explicitly empty" marker.
  Rejected: it puts two empty values in one field, and it buys nothing —
  `exactOptionalPropertyTypes` is off, so `food` is a required property that may
  hold `undefined` and every state literal has to state it anyway.
- **An npm seeded PRNG (`seedrandom` and friends)** — battle-tested and shorter
  than writing one. It cannot be imported: the `entities` layer has no
  allow-policy in `eslint.config.js` and `checkAllOrigins: true` extends that to
  npm, so `pnpm lint` fails on it. The rule is doing what it exists for.

## References

- Design spec §3 (rules, the closed status set), §4 (Engine API — corrected in
  this PR to the signatures above), §8 (engine test focus) —
  `docs/specs/2026-08-12-snake-game-design.md`
- `src/entities/game/engine.ts`, `rules.ts`, `rng.ts`, `board.ts` — the
  executable form of everything above
- `src/entities/game/engine.test.ts` — the `toBe` assertions that make the no-op
  contract a gate, and the scripted-RNG stub that pins the phase order
- `src/entities/game/index.ts` — the public surface chunks 03–05 import against
- `CLAUDE.md` § Architecture invariants (all gameplay numbers in `rules.ts`)
- ADR 0002 — trimmed FSD (the purity rule this decision works inside)
- ADR 0001 — Solid.js (the reactive layer that consumes the no-op contract)
- `docs/architecture.md` § `entities/` — the injected-configuration note and the
  Decisions table
