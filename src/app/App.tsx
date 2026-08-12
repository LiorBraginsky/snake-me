import type { JSX } from 'solid-js';

export function App(): JSX.Element {
  return (
    <main class="app">
      <h1 class="app__title">snake-me</h1>
      <div class="app__stage-placeholder" data-testid="stage-placeholder" aria-hidden="true" />
    </main>
  );
}
