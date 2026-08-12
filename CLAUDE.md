# snake-me

Classic snake game as a **portfolio showcase** — clean modules, trimmed FSD,
pure game core, token-driven theming. Solid.js + TypeScript (strict) + Vite,
deployed to GitHub Pages.

## Truth

- Design spec: `docs/specs/2026-08-12-snake-game-design.md` (single source for
  rules, architecture, theming).
- Living architecture map: `docs/architecture.md` (created at scaffold).
- Frozen decisions: `docs/adr/`.
- Delivery process: `.claude/orchestration.md` (untracked, agents read it).

## Commands (canonical names; wired at scaffold)

- `pnpm typecheck` — `tsc --noEmit`
- `pnpm lint` — ESLint (+ boundaries) + Prettier check
- `pnpm test` — vitest
- `pnpm test:e2e` — Playwright smoke
- `pnpm build` / `pnpm dev` — Vite

## Architecture invariants (lint-enforced)

- Trimmed FSD: `app → widgets → features → entities → shared`; imports point
  down only; slices talk through their `index.ts` (no deep imports).
- `entities/game` imports **nothing** — pure TS, no DOM, deterministic
  (injected RNG).
- One component per file. No grab-bag util files.
- All gameplay numbers are named constants in `entities/game/rules.ts`.

## Git

- Feature branches named `chunk-NN-<slug>`; PR per chunk; squash auto-merge on
  green CI. Never push to `main` directly. Never `--force`, `--no-verify`, or
  amend published commits.

## Language

- Repo artifacts (code, comments, docs, commits) — **English**.
