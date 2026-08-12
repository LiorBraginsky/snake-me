import js from '@eslint/js';
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

  // <<< FSD boundaries block is inserted here in Step 2 >>>

  // Must stay last: switches off every stylistic rule Prettier owns.
  prettier,
);
