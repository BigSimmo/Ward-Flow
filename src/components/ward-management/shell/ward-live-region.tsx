"use client";

import { useSyncExternalStore } from "react";

/**
 * The shell's one polite live region. `WardRail`, `WardBar` and, later, a mounting host page all
 * call `announceToWardShell` rather than rendering their own `aria-live` region, so a second
 * `aria-live` region anywhere in `shell/` would be the same defect as a second fixed search bar
 * (`docs/search-chrome-behaviour.md`'s "one owner" rule, applied to announcements not layout).
 *
 * The authority is standard §7.4 ("Every change of subject is one sentence to THE live region" —
 * the definite article is the rule), NOT §7.7 as an earlier version of this comment claimed.
 * §7.7 is "The rail's state, remembered", and its "a screen reader hears one landmark" is about
 * there being no second NAV in the tree. It was quoted here as if it legislated live regions.
 * A real sentence, accurately transcribed, from a section about something else.
 *
 * ⚠️ And the scope above is deliberate: "anywhere in `shell/`", which is a claim this file can
 * keep. §7.4's own scope is the whole PAGE, and the ward app renders six more `aria-live`
 * elements outside `shell/` (community-index, morning-tour, patient-typeahead, ward-global-search,
 * ward-management-modes, ward-management-network). Whether any two co-render — and so whether a
 * screen reader hears two owners competing — is a runtime question NOT measured here, and it is
 * not this file's to settle. Errata §AU.
 *
 * A plain module-level store, not React context: the announcer must be callable from an event
 * handler with no component instance in scope (a document-level Escape listener, a click handler
 * a level away from any provider), the same reason `use-ward-sidebar-collapsed.ts` reaches for an
 * external store over context for a cross-tree preference. `useSyncExternalStore` is what keeps
 * `<WardLiveRegion />`'s own render in sync with calls that happen from outside React's tree.
 */

type WardLiveRegionState = {
  /** Incremented on every announce so two IDENTICAL sentences in a row are still two distinct
   *  snapshots — see `announceToWardShell` below for why this is not solved by the text alone. */
  revision: number;
  text: string;
};

const SILENT_SERVER_SNAPSHOT: WardLiveRegionState = { revision: 0, text: "" };
let state: WardLiveRegionState = SILENT_SERVER_SNAPSHOT;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): WardLiveRegionState {
  return state;
}

// The server never announces anything — the live region starts silent on every render, and the
// first real announcement is always a client interaction.
function getServerSnapshot(): WardLiveRegionState {
  return SILENT_SERVER_SNAPSHOT;
}

/**
 * Announces one sentence to the shell's live region.
 *
 * Standard §7.4: "A repeated sentence gets a zero width space so it is read again." A screen
 * reader does not re-announce a live region whose text content did not change, so pressing the
 * same rail link twice ("Command. This is the screen you are on.") a second time would otherwise
 * announce nothing at all. Appending a zero-width space on every OTHER call (tracked by
 * `revision`, never by comparing against the previous text — two DIFFERENT sentences must never
 * be conflated into "the same, so skip it") guarantees the rendered text content changes on every
 * single call, whether or not the sentence itself repeats.
 */
export function announceToWardShell(text: string): void {
  // ⚠️ ESCAPED, NEVER TYPED RAW — see tests/ward-no-control-characters.test.ts's own file header.
  // A zero-width space is legitimate and necessary here (see this function's doc comment), but a
  // raw invisible byte in source is indistinguishable from an editor artefact or paste-corruption
  // to every tool that reads this file — a diff, a reviewer's eye, `cat`. The escape sequence
  // produces the exact same runtime character with none of that ambiguity.
  const zeroWidthSpace = state.revision % 2 === 0 ? "" : "\u200B";
  state = { revision: state.revision + 1, text: text + zeroWidthSpace };
  for (const listener of Array.from(listeners)) listener();
}

/** Test-only reset so one test file's announcements never leak into the next. */
export function resetWardLiveRegionForTests(): void {
  state = { revision: 0, text: "" };
  for (const listener of Array.from(listeners)) listener();
}

export function useWardLiveRegionText(): string {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return snapshot.text;
}

/**
 * Renders the shell's one live region. Mount exactly once — see the file header. Visually
 * hidden, per standard §9 ("A skip link is the first focusable element, and one polite live
 * region receives every change of subject as a sentence") — `srOnly` rather than `hidden`, which
 * would also hide it from assistive tech.
 */
export function WardLiveRegion() {
  const text = useWardLiveRegionText();
  return (
    <p className="sr-only" aria-live="polite" aria-atomic="true" data-testid="ward-live-region">
      {text}
    </p>
  );
}
