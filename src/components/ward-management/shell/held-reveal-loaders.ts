/**
 * D-137 follow-up (11 Nov 2026): since a fresh device is held, the browser draws the whole page
 * itself, on the pass straight after hydration. Before the hold, the server drew a route's
 * code-split cards into the page. Now a card whose code had not arrived drew nothing and then
 * popped in: Home's "Beds that fit" and "since you were last here" cards pushed Home down by 0.13
 * on a desktop (release-gate layout shift). A route's code-split modules register their loaders
 * here, and a held first load waits for them before it shows the page (`WardDeskHold`). A load
 * that is not held does not wait, and the loaders still preload when idle as before.
 */
const loaders = new Set<() => Promise<unknown>>();

/** The longest a held first load waits for its cards' code. A slower card loads as it did before. */
const HELD_REVEAL_WAIT_MS = 3_000;

export function loadBeforeHeldReveal(...load: Array<() => Promise<unknown>>): void {
  if (typeof window === "undefined") return;
  for (const loader of load) loaders.add(loader);
}

export function hasHeldRevealLoaders(): boolean {
  return loaders.size > 0;
}

/** Starts every registered load and settles when all have finished, or after the wait. */
export function heldRevealReady(waitMs = HELD_REVEAL_WAIT_MS): Promise<void> {
  const all = Promise.allSettled([...loaders].map((load) => load())).then(() => undefined);
  return Promise.race([all, new Promise<void>((resolve) => window.setTimeout(resolve, waitMs))]);
}

export function resetHeldRevealLoadersForTests(): void {
  loaders.clear();
}
