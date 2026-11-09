import styles from "./loading.module.css";

/** The "Loading page" line and its 15 s reload note, shared by `loading.tsx` and `HeldDeskLoading`. */
export function WardLoadingStatus() {
  return (
    <p className={styles.status} role="status">
      <span className={styles.spin} aria-hidden="true" />
      Loading page
      {/* Q275 (pre-launch review E3, 2 Nov 2026): a page change that never finished showed this
        forever. After 15 s this line shows (a CSS delay, so the boundary ships no extra code); its
        Reload button is handled by the layout's inline script (ward-loading-note-early.ts),
        which reloads the address. Josh (5 Nov 2026, design audit card 8): the same words and
        the same 15 s as the first-load note (WARD_LOADING_SLOW_MS, DESIGN-SYSTEM §6). */}
      <span className={styles.slow} data-testid="ward-loading-slow">
        Still loading. Check the connection.
        {/* eslint-disable-next-line local/require-button-wiring -- wired by WARD_LOADING_NOTE_EARLY_SCRIPT */}
        <button type="button" className={styles.retry} data-wf-loading-reload="">
          Reload
        </button>
      </span>
    </p>
  );
}

/**
 * Desk walk follow-up (9 Nov 2026): what the server sends while a held desk is not yet known
 * (`WardDeskHold` in layout.tsx). Server-only, so unlike `loading.tsx` it adds no page-shape code
 * to every screen's phone download.
 */
export function HeldDeskLoading() {
  return (
    <main id="main-content" className={styles.main} aria-busy="true" data-testid="ward-flow-loading">
      <WardLoadingStatus />
    </main>
  );
}
