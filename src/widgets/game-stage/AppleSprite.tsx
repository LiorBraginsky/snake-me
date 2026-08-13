import type { JSX } from 'solid-js';

/**
 * The apple (spec §5): red body with a dark outline, a highlight, a stem and a
 * leaf. The sprite carries shape only — every fill arrives from a theme token or
 * a colour mixed from one, through the classes styled in
 * `app/styles/entities.css`. `fill="var(--item-food)"` as a presentation
 * attribute would not be substituted by browsers, which is why paint is CSS.
 */
export function AppleSprite(): JSX.Element {
  return (
    <svg class="item__sprite sprite-apple" viewBox="0 0 24 24" aria-hidden="true">
      <path
        class="sprite-apple__body"
        d="M12 7.4c1.1-1.2 3.1-1.6 4.6-.9 2.3 1 3.6 3.4 3.6 6.2 0 4.4-3.4 8.3-6.4 8.3-.8 0-1.3-.3-1.8-.3s-1 .3-1.8.3C7.2 21 3.8 17.1 3.8 12.7c0-2.8 1.3-5.2 3.6-6.2 1.5-.7 3.5-.3 4.6.9Z"
      />
      <path
        class="sprite-apple__highlight"
        d="M8.6 9.6c.9-.8 1.9-1.1 2.4-.7.5.4.1 1.3-.8 2-.9.8-1.9 1.1-2.4.7-.5-.4-.1-1.3.8-2Z"
      />
      <path class="sprite-apple__stem" d="M12 7.4c0-1.6.2-2.9.6-3.9" />
      <path
        class="sprite-apple__leaf"
        d="M12.8 4.4c1.2-1.6 3.3-2.2 4.6-1.7.2 1.7-1.4 3.5-3.2 3.7-.7.1-1.2-.1-1.4-.4-.3-.4-.3-1 0-1.6Z"
      />
    </svg>
  );
}
