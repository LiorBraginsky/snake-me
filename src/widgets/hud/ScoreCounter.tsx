import type { JSX } from 'solid-js';

export interface ScoreCounterProps {
  readonly score: number;
}

export function ScoreCounter(props: ScoreCounterProps): JSX.Element {
  return (
    <p class="hud__score">
      <span class="hud__score-label">Score</span>
      <span class="hud__score-value">{props.score}</span>
    </p>
  );
}
