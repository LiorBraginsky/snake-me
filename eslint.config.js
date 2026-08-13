import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import prettier from 'eslint-config-prettier';
import solid from 'eslint-plugin-solid';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Never looked at.
  {
    // ESLint does not read .gitignore. Playwright's report and artifact
    // directories carry generated files; without this, `eslint .` walks into
    // them and `--max-warnings=0` fails on output nobody wrote.
    ignores: ['dist/**', 'coverage/**', 'playwright-report/**', 'test-results/**'],
  },

  // Baseline JavaScript + TypeScript correctness.
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Solid-specific correctness (reactivity scope, JSX props). We register the
  // plugin ourselves and take only the preset's rules, so the packaged preset
  // cannot pull in type-aware parsing: `pnpm typecheck` already runs strict tsc.
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { solid },
    rules: solid.configs['flat/typescript'].rules,
  },

  // Trimmed FSD, executable. One rule encodes all three invariants from
  // CLAUDE.md / spec §4:
  //   1. direction   — app -> widgets -> features -> entities -> shared, never up,
  //                    never sideways between slices of one layer;
  //   2. entry point — a slice is reachable only through its index.ts;
  //   3. purity      — `entities` may import nothing at all, npm included.
  // Scoped to src/: config files, tests outside src/ and tooling are not elements.
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      // eslint-plugin-boundaries resolves import specifiers via
      // eslint-module-utils/resolve, which defaults to the bundled
      // eslint-import-resolver-node with extensions ['.mjs', '.js', '.json',
      // '.node'] — no TypeScript. Without '.ts'/'.tsx' here, every relative
      // import to a .tsx file or a directory's index.ts resolves to an
      // "unknown" element, and `checkUnknownLocals` defaults to false, so
      // unresolved local dependencies are silently skipped: the rule never
      // fires on ANY import in this codebase, allow or disallow alike.
      'import/resolver': {
        node: {
          extensions: ['.mjs', '.js', '.json', '.node', '.ts', '.tsx'],
        },
      },
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app', partialMatch: false },
        { type: 'widget', pattern: 'src/widgets/*', partialMatch: false, capture: ['slice'] },
        { type: 'feature', pattern: 'src/features/*', partialMatch: false, capture: ['slice'] },
        { type: 'entity', pattern: 'src/entities/*', partialMatch: false, capture: ['slice'] },
        { type: 'shared', pattern: 'src/shared/*', partialMatch: false, capture: ['slice'] },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          // Nothing is permitted unless a policy below says so.
          default: 'disallow',
          // Also check npm / node-builtin imports, so `entities` can be pinned
          // to literally zero dependencies.
          checkAllOrigins: true,
          // Without this, any src/ file matching NO pattern in
          // boundaries/elements (e.g. a stray src/helpers.ts) is invisible to
          // the rule, and importing it from anywhere is silently allowed —
          // a direct hole in the CLAUDE.md layer-boundary invariant.
          checkUnknownLocals: true,
          policies: [
            // Every layer except `entities` may use npm packages.
            {
              from: { element: { type: ['app', 'widget', 'feature', 'shared'] } },
              allow: { to: { module: { origin: 'external' } } },
            },
            // Downward only, and only through the target slice's public API.
            {
              from: { element: { type: 'app' } },
              allow: {
                to: {
                  element: {
                    type: ['widget', 'feature', 'entity', 'shared'],
                    fileInternalPath: 'index.ts',
                  },
                },
              },
            },
            {
              from: { element: { type: 'widget' } },
              allow: {
                to: {
                  element: { type: ['feature', 'entity', 'shared'], fileInternalPath: 'index.ts' },
                },
              },
            },
            {
              from: { element: { type: 'feature' } },
              allow: {
                to: { element: { type: ['entity', 'shared'], fileInternalPath: 'index.ts' } },
              },
            },
            // `entities` gets no allow-policy on purpose. With default:"disallow"
            // and checkAllOrigins:true that means: no shared, no npm, no node
            // builtins. Today the layer holds exactly one slice, `entities/game`
            // (spec §4), so this is the CLAUDE.md invariant, stated one notch
            // stricter. A future second entity slice must revisit this.
          ],
        },
      ],
      // `checkUnknownLocals` above closes the TARGET side of a dependency
      // edge (an import that points AT an unclassified file). It does
      // nothing for the SOURCE side: `boundaries/dependencies` registers no
      // visitors at all when both ends of an edge are unknown, so a file
      // that is itself unclassified — anything under src/ matching no
      // `boundaries/elements` pattern, e.g. a stray src/utils.ts — can
      // import absolutely anything and lint stays green. That is exactly
      // the grab-bag util module CLAUDE.md forbids, smuggled past the
      // architecture. This rule closes the source side: any file under
      // src/ that belongs to no element is itself an error.
      'boundaries/no-unknown-files': 'error',
    },
  },

  // The boundaries invariant guards the direction of PRODUCTION dependencies.
  // A colocated `*.test.ts` importing `vitest`, or reaching into a sibling
  // slice's internals to set up a fixture, is not a production dependency —
  // the file never enters the bundle (`vite build` only ever sees `src/app`'s
  // graph, and Vitest excludes `*.test.*` from coverage of the shipped app).
  // Accepted cost: a test file can deep-import across a slice boundary
  // instead of going through the target's index.ts. That is deliberate — the
  // exception is scoped to the test glob only, so no production file gains
  // that freedom.
  { files: ['src/**/*.test.{ts,tsx}'], rules: { 'boundaries/dependencies': 'off' } },

  // The engine and the game session are headless by contract (ADR 0005): time,
  // input and randomness arrive as injected ports, never as ambient globals.
  // `boundaries/dependencies` structurally cannot see this — a global is not an
  // import — so it needs its own rule. `features/theming` is deliberately NOT in
  // this glob: writing theme tokens onto the document is exactly its job
  // (ADR 0003). Tests are exempt for the same reason they are exempt from the
  // boundaries rules, and because the compile-time `window` proofs live there.
  //
  // `src/shared/**` is IN the glob as of chunk 05. ADR 0005 kept it out only
  // because `shared/storage` was specified as a `localStorage` adapter; the
  // adapter now takes the storage object as an injected provider, so no file
  // under `src/shared/**` needs an ambient global and no carve-out is needed.
  // `features/scoreboard` joins for the same reason `game-session` is here: it
  // must take the ISO date as an injected value, never read the clock.
  {
    files: [
      'src/entities/**/*.{ts,tsx}',
      'src/features/game-session/**/*.{ts,tsx}',
      'src/features/scoreboard/**/*.{ts,tsx}',
      'src/shared/**/*.{ts,tsx}',
    ],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'Headless by contract: take a port (ADR 0005).' },
        { name: 'document', message: 'Headless by contract: take a port (ADR 0005).' },
        { name: 'localStorage', message: 'Headless by contract: take a port (ADR 0005).' },
        { name: 'requestAnimationFrame', message: 'Take a FrameScheduler port (ADR 0005).' },
        { name: 'cancelAnimationFrame', message: 'Take a FrameScheduler port (ADR 0005).' },
        { name: 'performance', message: 'Time arrives as the frame timestamp (ADR 0005).' },
        { name: 'Date', message: 'Determinism: the caller supplies clock values (ADR 0004).' },
        {
          name: 'setTimeout',
          message: 'ADR 0005 rejects setInterval/setTimeout: take a FrameScheduler port.',
        },
        {
          name: 'setInterval',
          message: 'ADR 0005 rejects setInterval/setTimeout: take a FrameScheduler port.',
        },
        { name: 'queueMicrotask', message: 'Headless by contract: take a port (ADR 0005).' },
        { name: 'self', message: 'Headless by contract: take a port (ADR 0005).' },
        { name: 'navigator', message: 'Headless by contract: take a port (ADR 0005).' },
        { name: 'crypto', message: 'Determinism: take the Rng port (ADR 0004).' },
        // Banning the bare identifier (not just a `globalThis.window`-shaped
        // member access) is what actually closes the laundering route: this
        // rule flags every reference eslint-scope resolves to the global
        // variable `globalThis`, including one wrapped in a type assertion —
        // `(globalThis as unknown as { window: Window }).window` still names
        // the identifier, so it still gets caught. A `no-restricted-properties`
        // entry keyed on the object name `globalThis` was tried first and
        // rejected: it inspects `MemberExpression.object.name`, which is
        // `undefined` once the object is a `TSAsExpression` rather than a bare
        // `Identifier`, so it lints the exact adversarial case in this ADR's
        // motivating example clean.
        { name: 'globalThis', message: 'Headless by contract: take a port (ADR 0005).' },
      ],
      // Targets the PROPERTY, not the object, so `Math.max` / `.floor` /
      // `.round` / `.imul` — every real call site in `entities/game` — stay
      // legal. A cast on `Math` itself
      // (`(Math as unknown as { random(): number }).random()`) launders past
      // this the same way the rejected `globalThis` property rule above did,
      // and it is deliberately not closed: closing it means banning the bare
      // `Math` identifier, which takes every legitimate call site with it —
      // and the cast is not an accident anyone commits by mistake, it is
      // written on purpose to get past a rule the author knew was there. This
      // rule catches accidents; deliberate laundering is a review problem
      // (ADR 0005).
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Determinism: take the Rng port (ADR 0004).',
        },
      ],
    },
  },

  // Must stay last: switches off every stylistic rule Prettier owns.
  prettier,
);
