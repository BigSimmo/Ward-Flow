import { WardLoadingRows } from "@/components/ward-management/shell/ward-loading-rows";
import { SyntheticMark } from "@/components/wf";

import styles from "./loading.module.css";

/**
 * The "Loading page" line and its 15 s reload note, shared by `loading.tsx` and `HeldDeskLoading`.
 * `label` names a hand-over in words (phone load audit, 10 Nov 2026: "Opening Help").
 *
 * Shared design parts item 12 (Josh, 13 Nov 2026; F-62): no spinner. The words stay quiet at the
 * top left, the synthetic-data mark sits at the right of the same row from the first paint, and the
 * grey rows below show the page is on its way.
 */
export function WardLoadingStatus({ label = "Loading page" }: { label?: string }) {
  return (
    <div className={styles.top}>
      <p className={styles.status} role="status">
        {label}
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
      <SyntheticMark />
    </div>
  );
}

/**
 * Desk walk follow-up (9 Nov 2026): what the server sends while a held desk is not yet known
 * (`WardDeskHold` in layout.tsx). It draws no page shape, so unlike `loading.tsx` it adds no
 * page-shape code to a screen's phone download. Phone load audit (10 Nov 2026): the client
 * hand-overs (old Seclusion address, Activity and Help addresses) show it too, never a blank body.
 * Item 12 (13 Nov 2026): it draws server-only grey rows shaped like a list (`WardLoadingRows`), which
 * add no client code; this is where a fresh phone opening Home lands first.
 */
export function HeldDeskLoading({ label }: { label?: string }) {
  return (
    <main id="main-content" className={styles.main} aria-busy="true" data-testid="ward-flow-loading">
      <WardLoadingStatus label={label} />
      <WardLoadingRows />
    </main>
  );
}
