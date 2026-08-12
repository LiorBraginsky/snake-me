import solid from 'vite-plugin-solid';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages project site: https://<user>.github.io/snake-me/
  base: '/snake-me/',
  plugins: [solid()],
  test: {
    // 'node' is the final environment, not a staging choice: spec §8's testing
    // policy is logic tests only (engine, storage, game-session semantics) —
    // no render/markup/snapshot tests, so jsdom is never coming.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
  },
});
