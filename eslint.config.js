import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import prettier from 'eslint-config-prettier';
import solid from 'eslint-plugin-solid';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Never looked at.
  {
    ignores: ['dist/**', 'coverage/**'],
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

  // Must stay last: switches off every stylistic rule Prettier owns.
  prettier,
);
