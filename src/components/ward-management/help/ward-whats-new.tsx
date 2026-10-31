"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { OverlayPortal } from "@/components/wf";

import { openWardHelp } from "./ward-help-events";
import { useCornerCardEscape } from "./use-corner-card-escape";
import styles from "./ward-whats-new.module.css";
import entries from "./whats-new.json";

/**
 * WHAT'S NEW (Josh, 24 and 25 Oct 2026): a short note after each daily release, shown once per
 * device for the changes it has not seen, and gone once closed. Help keeps the full recent list. A
 * device that has never had the tour gets the tour instead, and the tour's start marks every change
 * read (`TOUR_AUTO_STARTED_EVENT`), so nobody sees both on their first visit.
 *
 * `whats-new.json` is the one list. A pull request that changes something staff will see adds one
 * plain line at the end; the live site only moves at the daily release, so the note appears the
 * morning after the merge, and the release workflow copies the same new lines into its GitHub
 * release notes. Lines describe merged, visible changes only. The stored value is the id of the
 * newest change this device has seen.
 */
export type WhatsNewEntry = { readonly id: string; readonly date: string; readonly line: string };

/** Oldest first, as the file is written. */
export const WHATS_NEW: readonly WhatsNewEntry[] = entries;

/** The most the corner card lists; Help lists the rest. */
export const WHATS_NEW_CARD_LIMIT = 4;

export const WHATS_NEW_STORAGE_KEY = "ward_flow_choice_whats_new_seen";
// The same key and event as `ward-tour-auto-start.tsx`, written out so this note does not load the tour.
const TOUR_AUTO_DONE_STORAGE_KEY = "ward_flow_choice_tour_auto_done";
export const TOUR_AUTO_STARTED_EVENT = "ward-flow-tour-auto-started";

/**
 * The changes a device has not seen, newest first: those after the stored id. A device that has
 * seen none gets the newest few, as does one whose stored id has since left the list.
 */
export function unseenWhatsNew(seenId: string | null, list: readonly WhatsNewEntry[] = WHATS_NEW): WhatsNewEntry[] {
  const at = seenId === null ? -1 : list.findIndex((entry) => entry.id === seenId);
  return list
    .slice(at + 1)
    .toReversed()
    .slice(0, WHATS_NEW_CARD_LIMIT);
}

/** Marks every current change read on this device. */
export function markWhatsNewSeen(): void {
  const newest = WHATS_NEW.at(-1);
  if (!newest) return;
  try {
    window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, newest.id);
  } catch {
    // Without storage the note never shows (see `readUnseen`), so there is nothing to record.
  }
}

const NONE: readonly WhatsNewEntry[] = [];
let cached: { key: string; value: readonly WhatsNewEntry[] } = { key: "", value: NONE };

/**
 * Only on a device that has had the tour. Unreadable storage shows nothing. The result is kept so
 * repeated reads return the same list, as `useSyncExternalStore` needs.
 */
function readUnseen(): readonly WhatsNewEntry[] {
  try {
    const storage = window.localStorage;
    if (storage.getItem(TOUR_AUTO_DONE_STORAGE_KEY) === null) return NONE;
    const seen = storage.getItem(WHATS_NEW_STORAGE_KEY);
    const key = `seen:${seen}`;
    if (cached.key !== key) cached = { key, value: unseenWhatsNew(seen) };
    return cached.value;
  } catch {
    return NONE;
  }
}

const noSubscribe = () => () => {};
const readNone = () => NONE;

/**
 * The note itself: a small card in the corner, never a dialog, so it blocks nothing on screen. It is
 * portalled out of the header, whose backdrop filter would otherwise pin a fixed card to the header.
 * It sits in the lowest overlay layer, so any drawer, dialog or toast opens over it and keeps its
 * buttons clickable (P004, 27 Oct 2026); the toast layer had put it above all of them.
 */
export function WardWhatsNew() {
  // Read once from the device; the server and hydration read "nothing new".
  const unseen = useSyncExternalStore(noSubscribe, readUnseen, readNone);
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    window.addEventListener(TOUR_AUTO_STARTED_EVENT, markWhatsNewSeen);
    return () => window.removeEventListener(TOUR_AUTO_STARTED_EVENT, markWhatsNewSeen);
  }, []);
  const close = () => {
    markWhatsNewSeen();
    setClosed(true);
  };
  // Escape is "Got it".
  useCornerCardEscape(unseen.length > 0 && !closed, close);
  if (unseen.length === 0 || closed) return null;
  return (
    <OverlayPortal layer="overlay" name="ward-whats-new">
      <section className={styles.card} aria-labelledby="ward-whats-new-title" data-testid="ward-whats-new">
        <h2 id="ward-whats-new-title" className={styles.title}>
          What&apos;s new
        </h2>
        <ul className={styles.list}>
          {unseen.map((entry) => (
            <li key={entry.id}>{entry.line}</li>
          ))}
        </ul>
        <div className={styles.buttons}>
          <button
            type="button"
            className={styles.primary}
            onClick={() => {
              close();
              openWardHelp("new");
            }}
          >
            See all in Help
          </button>
          <button type="button" className={styles.secondary} onClick={close} data-testid="ward-whats-new-close">
            Got it
          </button>
        </div>
      </section>
    </OverlayPortal>
  );
}
