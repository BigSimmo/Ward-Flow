"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { OverlayPortal } from "@/components/wf";

import { openWardHelp } from "./ward-help-events";
import { useCornerCardEscape } from "./use-corner-card-escape";
import styles from "./ward-whats-new.module.css";

/**
 * WHAT'S NEW (Josh, 24 and 25 Oct 2026): a short note after each daily release, shown once per
 * device for the changes it has not seen, and gone once closed. Help keeps the full recent list. A
 * device that has never had the tour gets the tour instead, and the tour's start marks every change
 * read (`TOUR_AUTO_STARTED_EVENT`), so nobody sees both on their first visit.
 *
 * Each change is its own file in `whats-new/`, so parallel pull requests never edit the same lines
 * (Josh, 4 Nov 2026). A pull request that changes something staff will see adds one file,
 * `whats-new/<YYYY-MM-DD-short-slug>.json`, holding `{ "line": "One plain sentence." }`.
 * `scripts/ward-flow/whats-new-list.mjs` combines the files, newest 20 only, and the build inlines
 * the result here as `__WARD_WHATS_NEW__`. The live site only moves at the daily release, so the note
 * appears the morning after the merge, and the release workflow copies the new lines into its
 * GitHub release notes. Lines describe merged, visible changes only. The stored value is the list of
 * ids this device has seen (older devices stored only the newest id, still read below).
 */
export type WhatsNewEntry = { readonly id: string; readonly date: string; readonly line: string };

// Inlined by the build and the tests (`next.config.ts`, `vitest.config.mts`) as a JSON string.
declare const __WARD_WHATS_NEW__: string | undefined;

/** Oldest first: the newest 20 entry files, by date and then id. Empty where nothing inlined it. */
export const WHATS_NEW: readonly WhatsNewEntry[] =
  typeof __WARD_WHATS_NEW__ === "string" ? (JSON.parse(__WARD_WHATS_NEW__) as WhatsNewEntry[]) : [];

/** The most the corner card lists; Help lists the rest. */
export const WHATS_NEW_CARD_LIMIT = 4;

export const WHATS_NEW_STORAGE_KEY = "ward_flow_choice_whats_new_seen";
// The same key and event as `ward-tour-auto-start.tsx`, written out so this note does not load the tour.
const TOUR_AUTO_DONE_STORAGE_KEY = "ward_flow_choice_tour_auto_done";
export const TOUR_AUTO_STARTED_EVENT = "ward-flow-tour-auto-started";

/** The ids a stored value marks seen: a JSON list, or null for a value older devices wrote. */
function seenIds(seen: string | null): ReadonlySet<string> | null {
  if (seen === null || !seen.startsWith("[")) return null;
  try {
    const ids: unknown = JSON.parse(seen);
    return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

/**
 * The one-file list's order before 4 Nov 2026, when a device stored only the newest id it had seen.
 * Such a value marks that id and every one before it here seen, so moving to sorted entry files
 * neither repeats a closed line nor hides an unread one.
 */
export const LEGACY_ORDER = [
  "2026-10-31-role-names-hidden-names",
  "2026-11-01-ed-handover-table",
  "2026-11-01-alerts-redesign",
  "2026-11-01-design-audit-tidy",
  "2026-11-02-one-page-per-clinic",
  "2026-11-02-downtime-one-table",
  "2026-11-02-prelaunch-wording",
  "2026-11-02-help-show-me-around",
  "2026-11-03-tools-overhaul",
  "2026-11-03-save-and-safety-fixes",
  "2026-11-03-reminders-in-alerts",
  "2026-11-03-one-page-scroll",
  "2026-11-03-home-flow",
  "2026-11-03-report-data-correctness",
  "2026-11-03-coordinator-quick-actions",
  "2026-11-03-dropdowns-tips-dots",
  "2026-11-03-waiting-and-all-eds",
  "2026-11-03-integrity-save-confirmation",
  "2026-11-03-journey-recovery",
  "2026-11-03-one-alerts-switch",
  "2026-11-03-simpler-new-referral",
];

/**
 * The changes a device has not seen, newest first. The stored value lists the ids seen, so a change
 * that sorts among older ones still shows. A value older devices stored is the newest id they saw:
 * that id and everything before it in the old order (or, for an id not in it, in `list`) are seen. A
 * device that has seen none gets the newest few, as does one whose stored id has since left the list.
 */
export function unseenWhatsNew(seen: string | null, list: readonly WhatsNewEntry[] = WHATS_NEW): WhatsNewEntry[] {
  let ids = seenIds(seen);
  let at = -1;
  if (ids === null && seen !== null) {
    const legacy = LEGACY_ORDER.indexOf(seen);
    if (legacy >= 0) ids = new Set(LEGACY_ORDER.slice(0, legacy + 1));
    else at = list.findIndex((entry) => entry.id === seen);
  }
  return list
    .slice(at + 1)
    .filter((entry) => !ids?.has(entry.id))
    .toReversed()
    .slice(0, WHATS_NEW_CARD_LIMIT);
}

/** Fired when changes are marked read, so a signed-in account can remember them too. */
export const WHATS_NEW_SEEN_EVENT = "ward-flow-whats-new-seen";

/**
 * Every id a stored value marks read, as a list: a JSON list as it is, and a value older devices
 * wrote as that id and everything before it in the old order.
 */
export function whatsNewSeenIds(seen: string | null, list: readonly WhatsNewEntry[] = WHATS_NEW): string[] {
  const ids = seenIds(seen);
  if (ids !== null || seen === null) return [...(ids ?? [])];
  const legacy = LEGACY_ORDER.indexOf(seen);
  if (legacy >= 0) return LEGACY_ORDER.slice(0, legacy + 1);
  const at = list.findIndex((entry) => entry.id === seen);
  return list.slice(0, at + 1).map((entry) => entry.id);
}

/** Adds `ids` to the changes read on this device (all current ones when none are named). */
export function markWhatsNewSeen(
  ids: readonly string[] = WHATS_NEW.map((entry) => entry.id),
  fromAccount = false,
): void {
  if (ids.length === 0) return;
  try {
    const held = whatsNewSeenIds(window.localStorage.getItem(WHATS_NEW_STORAGE_KEY));
    window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, JSON.stringify([...new Set([...ids, ...held])].slice(0, 200)));
  } catch {
    // Without storage the note never shows (see `readUnseen`), so there is nothing to record.
    return;
  }
  window.dispatchEvent(new CustomEvent(WHATS_NEW_SEEN_EVENT, { detail: { fromAccount } }));
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

// Changes read on another of this account's devices close the note here too.
const subscribeSeen = (onChange: () => void) => {
  window.addEventListener(WHATS_NEW_SEEN_EVENT, onChange);
  return () => window.removeEventListener(WHATS_NEW_SEEN_EVENT, onChange);
};
const readNone = () => NONE;

/**
 * The note itself: a small card in the corner, never a dialog, so it blocks nothing on screen. It is
 * portalled out of the header, whose backdrop filter would otherwise pin a fixed card to the header.
 * It sits in the lowest overlay layer, so any drawer, dialog or toast opens over it and keeps its
 * buttons clickable (P004, 27 Oct 2026); the toast layer had put it above all of them.
 */
export function WardWhatsNew() {
  // Read once from the device; the server and hydration read "nothing new".
  const unseen = useSyncExternalStore(subscribeSeen, readUnseen, readNone);
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    const markAll = () => markWhatsNewSeen();
    window.addEventListener(TOUR_AUTO_STARTED_EVENT, markAll);
    return () => window.removeEventListener(TOUR_AUTO_STARTED_EVENT, markAll);
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
