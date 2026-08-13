import { defineConfig, devices } from '@playwright/test';

// The app is served under Vite's `base` (vite.config.ts), not at the root:
// GitHub Pages hosts it at https://liorbraginsky.github.io/snake-me/. The
// preview server mirrors that, so the e2e exercises the same path shape the
// deployed artifact does. If `base` ever changes, this URL 404s and the smoke
// fails loudly rather than testing a different app.
const PREVIEW_PORT = 4173;
const BASE_URL = `http://localhost:${PREVIEW_PORT}/snake-me/`;

export default defineConfig({
  testDir: './e2e',
  // Generous because the spec chases a randomly placed apple across the
  // board; the chase's own deadline (30 s) sits inside this.
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  // Deliberately 0. The chase has a real, if rare (~5%), residual
  // wall-exposure timing window (see e2e/smoke.spec.ts); a retry would
  // convert that real residual failure mode into a quietly green run instead
  // of evidence.
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: BASE_URL, trace: 'retain-on-failure' },
  // One browser is the ratified scope (spec §8: "Playwright, 1 spec").
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Builds first so `pnpm test:e2e` is green from a clean tree with no
    // prior `pnpm build`. `--strictPort` is load-bearing: without it Vite
    // silently moves to 4174 and Playwright waits on 4173 until it times out.
    command: `pnpm build && pnpm exec vite preview --port ${PREVIEW_PORT} --strictPort`,
    url: BASE_URL,
    // `false` in CI: every run rebuilds and serves fresh. Locally this is
    // `true`, so if anything is already listening on 4173 — including a
    // preview server left over from a previous local run — Playwright reuses
    // it and skips `command` entirely, `pnpm build` included. A local
    // `pnpm test:e2e` can therefore pass against a stale build; killing
    // whatever holds port 4173 (or a machine reboot) forces a fresh one.
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
