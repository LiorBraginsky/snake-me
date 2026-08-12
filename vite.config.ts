import solid from 'vite-plugin-solid';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages project site: https://<user>.github.io/snake-me/
  base: '/snake-me/',
  plugins: [solid()],
  test: {
    // No DOM needed yet: the engine (chunk 02) is pure TS, and component tests
    // with jsdom + solid-testing-library arrive with the first widget.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
  },
});
