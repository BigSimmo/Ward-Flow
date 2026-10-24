"use client";

import { useState, useSyncExternalStore } from "react";

import { openWardHelp } from "./ward-help-events";
import styles from "./ward-whats-new.module.css";

/**
 * WHAT'S NEW (Josh, 24 Oct 2026): a short note after a change people will notice, shown once per
 * device and gone for good once closed. A device that has never had the tour gets the tour instead,
 * which marks this note read (`markWhatsNewSeen`), so nobody sees both on their first visit.
 *
 * To announce a change, give `WHATS_NEW` a new id and its lines. Lines describe merged, visible
 * changes only, in plain words. The stored value is the id, a fixed date string.
 */
export const WHATS_NEW = {
  id: "2026-10-24-help",
  lines: [
    "Help now has a guide for your desk: your main jobs, step by step, each with a link to its screen.",
    "The tour starts by itself only once on each device. Open it again any time from Help.",
    "On a computer, the ? beside each screen's name opens help for that screen.",
  ],
} as const;

export const WHATS_NEW_STORAGE_KEY = "ward_flow_choice_whats_new_seen";
// The same key as `ward-tour-auto-start.tsx`, written out so this note does not load the tour.
const TOUR_AUTO_DONE_STORAGE_KEY = "ward_flow_choice_tour_auto_done";

/** Marks the current note read on this device. */
export function markWhatsNewSeen(): void {
  try {
    window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, WHATS_NEW.id);
  } catch {
    // Without storage the note never shows (see `shouldShow`), so there is nothing to record.
  }
}

/** Shows only on a device that has had the tour and has not closed this note. Unreadable storage shows nothing. */
function shouldShow(): boolean {
  try {
    const storage = window.localStorage;
    return (
      storage.getItem(TOUR_AUTO_DONE_STORAGE_KEY) !== null && storage.getItem(WHATS_NEW_STORAGE_KEY) !== WHATS_NEW.id
    );
  } catch {
    return false;
  }
}

const noSubscribe = () => () => {};

/** The note itself: a small card in the corner, never a dialog, so it blocks nothing on screen. */
export function WardWhatsNew() {
  // Read once from the device; the server and hydration read "not shown".
  const due = useSyncExternalStore(noSubscribe, shouldShow, () => false);
  const [closed, setClosed] = useState(false);
  if (!due || closed) return null;
  const close = () => {
    markWhatsNewSeen();
    setClosed(true);
  };
  return (
    <section className={styles.card} aria-labelledby="ward-whats-new-title" data-testid="ward-whats-new">
      <h2 id="ward-whats-new-title" className={styles.title}>
        What&apos;s new
      </h2>
      <ul className={styles.list}>
        {WHATS_NEW.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div className={styles.buttons}>
        <button
          type="button"
          className={styles.primary}
          onClick={() => {
            close();
            openWardHelp("desk");
          }}
        >
          Open Help
        </button>
        <button type="button" className={styles.secondary} onClick={close} data-testid="ward-whats-new-close">
          Got it
        </button>
      </div>
    </section>
  );
}
