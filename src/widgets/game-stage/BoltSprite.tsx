import type { JSX } from 'solid-js';

export function BoltSprite(): JSX.Element {
  return (
    <svg class="item__sprite sprite-bolt" viewBox="0 0 24 24" aria-hidden="true">
      <path class="sprite-bolt__body" d="M14.6 2.5 6.4 13.2h4.2L9.4 21.5l8.2-11.1h-4.3l1.3-7.9Z" />
    </svg>
  );
}
