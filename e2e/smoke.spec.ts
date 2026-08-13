import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * The one end-to-end gate (spec §8): app loads -> Start -> snake moves ->
 * score grows.
 *
 * It plays the REAL game. Production seeds its rng with `Date.now()`
 * (src/app/App.tsx, ADR 0004), so the apple lands somewhere different every
 * run and no fixed key sequence could reach it. Pinning the seed was
 * rejected (it would couple this file to mulberry32's draw order) and a
 * `?seed=` URL param was rejected harder (a test seam in production code).
 * Instead the test chases: it reads board coordinates off the `--x` / `--y`
 * custom properties chunk 04 froze as the coordinate contract
 * (docs/architecture.md § CSS custom property contract) and steers with real
 * arrow keys.
 *
 * Why the chase is not expected to lose the round before it scores:
 *  - Self-collision is structurally impossible. The snake starts at 3
 *    segments (entities/game/rules.ts) and the shortest self-collision loop
 *    needs 5; the chase stops at the first apple, i.e. at 4.
 *  - The chase never steers into a wall. `nextTurn` always turns toward the
 *    apple or perpendicular to break a stale row/column, and only declines to
 *    turn when the apple is already strictly ahead on the current heading.
 *    The one remaining wall exposure is timing, not steering: a sweep of all
 *    381 legal apple positions against this file's `nextTurn` plus the real
 *    engine (entities/game/engine.ts) found that in 20 of them (~5%) the
 *    chase reaches an edge cell with its heading already pointing off-board,
 *    where survival needs the already-decided perpendicular turn to land
 *    inside that same 150 ms tick (rules.ts's BASE_TICK_MS). The atomic read
 *    below removes the torn-read race that used to waste a poll at exactly
 *    those ticks, and the 25 ms poll gives the turn several chances to land
 *    before the tick fires.
 *  - A stale read is never fatal. Every requested turn is perpendicular to
 *    the heading that was read; if the real heading already moved on, the
 *    engine rejects the illegal turn (entities/game/engine.ts) and the next
 *    poll re-decides.
 *  - `score > 0` can only mean the apple was eaten: a boost is drawn only
 *    inside the eat-food branch, so none can exist beforehand.
 *
 * Nothing here asserts a gameplay NUMBER: the score is asserted to grow, not
 * to equal 10, and the board size is read from the DOM. An engine-constant
 * change cannot break this file.
 */

interface Cell {
  readonly x: number;
  readonly y: number;
}

interface Board {
  readonly cols: number;
  readonly rows: number;
}

const ARROW = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
} as const;

type Heading = keyof typeof ARROW;

/**
 * Counters live on `window` because they have to survive between two
 * page.evaluate calls. `head` is the head element captured before the round,
 * compared by identity afterwards. `boardLayer` is the same kind of proof for
 * the board layer: see the `boardIsSame` assertion below for why the mutation
 * count alone cannot be trusted without it.
 */
type ProbeWindow = Window & {
  __snakeProbe?: { board: number; entities: number; head: Element; boardLayer: Element };
};

async function cellOf(locator: Locator): Promise<Cell> {
  return locator.evaluate((el) => ({
    x: Number(el.style.getPropertyValue('--x')),
    y: Number(el.style.getPropertyValue('--y')),
  }));
}

interface ChaseState {
  readonly head: Cell;
  readonly apple: Cell;
  readonly facing: Heading;
}

/**
 * Reads the head cell, the apple cell and the head's facing atomically, in
 * one round trip. Three separate reads (the original shape: `cellOf(head)`,
 * `cellOf(apple)`, a `.snake__face` attribute read) can straddle an engine
 * tick — the tick fires between round-trips and the callback ends up with a
 * post-tick head paired with a pre-tick heading. That torn read matters most
 * at exactly the ticks the spec header calls out (an edge cell, heading
 * already pointing off-board): a wrong `facing` there can make `nextTurn`
 * miscompute or get rejected by the engine, wasting a poll at the one moment
 * that cannot afford to waste one.
 *
 * Returns `null`, never throws, when any of the three elements is
 * momentarily missing (e.g. a re-render mid-read). Playwright's `expect.poll`
 * calls this callback outside its own try/catch, so a throw here is an
 * immediate hard failure with no retry — the honest response to a transient
 * gap is to skip steering for this cycle, not to blow up the test.
 */
async function readChaseState(page: Page): Promise<ChaseState | null> {
  return page.evaluate((): ChaseState | null => {
    const headEl = document.querySelector<HTMLElement>('.snake__segment--head');
    const appleEl = document.querySelector<HTMLElement>('.item--food');
    const faceEl = document.querySelector('.snake__face');
    if (headEl === null || appleEl === null || faceEl === null) {
      return null;
    }

    const facing = faceEl.getAttribute('data-direction');
    if (facing !== 'up' && facing !== 'down' && facing !== 'left' && facing !== 'right') {
      return null;
    }

    return {
      head: {
        x: Number(headEl.style.getPropertyValue('--x')),
        y: Number(headEl.style.getPropertyValue('--y')),
      },
      apple: {
        x: Number(appleEl.style.getPropertyValue('--x')),
        y: Number(appleEl.style.getPropertyValue('--y')),
      },
      facing,
    };
  });
}

/**
 * Greedy pursuit, one axis at a time. Returns undefined when the current
 * heading already points at the apple — the engine rejects a turn equal to
 * the current direction anyway, so not pressing is the honest expression of
 * "keep going".
 */
function nextTurn(head: Cell, apple: Cell, facing: Heading, board: Board): Heading | undefined {
  if (facing === 'left' || facing === 'right') {
    if (apple.y < head.y) return 'up';
    if (apple.y > head.y) return 'down';
    // Same row. If the apple is behind, a 180 is rejected by the engine, so
    // the only legal move is to break the row and come back on the next poll.
    // The detour aims at the board's middle (halving is arithmetic, not a
    // gameplay number) so it can never be a step into a wall.
    const ahead = facing === 'right' ? apple.x > head.x : apple.x < head.x;
    if (ahead) return undefined;
    return head.y * 2 < board.rows ? 'down' : 'up';
  }

  if (apple.x < head.x) return 'left';
  if (apple.x > head.x) return 'right';
  const ahead = facing === 'down' ? apple.y > head.y : apple.y < head.y;
  if (ahead) return undefined;
  return head.x * 2 < board.cols ? 'right' : 'left';
}

test('start, move, and grow the score in a real round', async ({ page }) => {
  await page.goto('./');

  // App loads. The heading is the app shell; `data-theme` on <html> is proof
  // the theme boot ran before first paint (features/theming/applyTheme.ts,
  // ADR 0003) — the one DOM effect the logic-only suite cannot cover.
  await expect(page.getByRole('heading', { name: 'snake-me' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', /\S+/);

  // Assert the data-direction contract ONCE, here, before the chase starts.
  // readChaseState (below) treats an unexpected value as "element momentarily
  // missing" and returns null rather than throwing — Playwright's poll
  // matcher calls that callback outside its own try/catch, so a throw there
  // would be an immediate, un-retried hard failure, which is too blunt for a
  // transient mid-render gap. But that same leniency means a genuinely broken
  // contract would just silently stop the chase from steering, and the test
  // would fail 30 s later with "steered toward the apple but the score never
  // grew" — blaming the wrong half. This assertion is what actually fails
  // loud on the `data-direction` contract itself.
  await expect(page.locator('.snake__face')).toHaveAttribute(
    'data-direction',
    /^(up|down|left|right)$/,
  );

  const stage = page.locator('.stage');
  const head = page.locator('.snake__segment--head');
  const scoreValue = page.locator('.hud__score-value');

  // Board size comes from the DOM, so this file restates no gameplay number:
  // GameStage writes --board-cols / --board-rows inline from DEFAULT_RULES.
  const board: Board = await stage.evaluate((el) => ({
    cols: Number(el.style.getPropertyValue('--board-cols')),
    rows: Number(el.style.getPropertyValue('--board-rows')),
  }));
  const startCell = await cellOf(head);

  // Install the repaint probe BEFORE the round, so it sees every tick.
  // Two observers, not one: the board counter alone is unfalsifiable (the
  // board layer has no children, so a broken probe would also report 0). The
  // entities counter is the positive control — docs/architecture.md § Trap,
  // "a green gate is not by itself evidence the check ran".
  await page.evaluate(() => {
    const boardLayer = document.querySelector('.stage__layer--board');
    const entityLayer = document.querySelector('.stage__layer--entities');
    const headSegment = document.querySelector('.snake__segment--head');
    if (boardLayer === null || entityLayer === null || headSegment === null) {
      throw new Error('stage layers or head segment missing at probe install');
    }

    const counters = { board: 0, entities: 0, head: headSegment, boardLayer };
    (window as ProbeWindow).__snakeProbe = counters;

    const options: MutationObserverInit = {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true,
    };
    new MutationObserver((records) => {
      counters.board += records.length;
    }).observe(boardLayer, options);
    new MutationObserver((records) => {
      counters.entities += records.length;
    }).observe(entityLayer, options);
  });

  const startButton = page.getByRole('button', { name: 'Start' });
  await startButton.click();
  await expect(startButton).toBeHidden();

  // The snake moves.
  await expect
    .poll(() => cellOf(head), { message: 'the head never left its starting cell' })
    .not.toEqual(startCell);

  // The score grows. The poll callback ACTS as well as observes — the round
  // will not score on its own, so this is a control loop, not an observation.
  await expect
    .poll(
      async () => {
        const state = await readChaseState(page);
        if (state !== null) {
          const turn = nextTurn(state.head, state.apple, state.facing, board);
          if (turn !== undefined) {
            await page.keyboard.press(ARROW[turn]);
          }
        }
        return Number(await scoreValue.textContent());
      },
      {
        intervals: [25],
        timeout: 30_000,
        message: 'steered toward the apple but the score never grew',
      },
    )
    .toBeGreaterThan(0);

  const probe = await page.evaluate(() => {
    const counters = (window as ProbeWindow).__snakeProbe;
    if (counters === undefined) {
      throw new Error('probe was never installed');
    }
    return {
      board: counters.board,
      entities: counters.entities,
      headIsSame: counters.head === document.querySelector('.snake__segment--head'),
      boardIsSame: counters.boardLayer === document.querySelector('.stage__layer--board'),
    };
  });

  // Positive control first: a probe that saw nothing anywhere proves nothing.
  expect(probe.entities).toBeGreaterThan(0);
  // Mechanism 1 of docs/architecture.md § "Why a tick cannot repaint the
  // board": script never invalidates the board layer during a live round.
  // This does NOT prove the compositor never repaints it — that stays the
  // manual DevTools paint-flashing check.
  expect(probe.board).toBe(0);
  // A MutationObserver observes a NODE, not a selector. If a tick ever tore
  // down and rebuilt `.stage__layer--board` — exactly the regression this
  // probe exists to catch — the childList record would land on `.stage` (the
  // parent), the observed node would already be detached, and `board` would
  // read 0 forever, for the wrong reason. Zero mutations is only meaningful
  // together with proof the observed node is still the live one.
  expect(probe.boardIsSame).toBe(true);
  // Mechanism 2: the head is one persistent element; a tick rewrites its two
  // coordinate custom properties, it never rebuilds the node.
  expect(probe.headIsSame).toBe(true);
});
