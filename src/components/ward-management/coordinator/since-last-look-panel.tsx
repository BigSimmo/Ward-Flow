"use client";

import { useEffect, useMemo, useRef } from "react";

import { createBrowserStore } from "@/lib/client-store-factory";

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";

import styles from "./coordinator.module.css";
import {
  changesSinceLastLook,
  hasAnyChange,
  LAST_LOOK_STORAGE_KEY,
  parseLastLookSnapshot,
  takeLastLookSnapshot,
  type LastLookSnapshot,
  type LastLookWorld,
} from "./since-last-look";

/**
 * Smart feature 9: the short "Since you last looked" list at the top of the Command screen. The
 * comparison lives in `since-last-look.ts`; this file only remembers when the coordinator left and
 * shows the difference when they come back.
 *
 * The picture is saved when the coordinator LEAVES the screen (or presses "Mark as seen"), not when
 * they arrive, so their own actions on this screen are not reported back to them as news.
 */

/** Fired after a same-tab write; the native `storage` event only reaches other tabs. */
const CHANGE_EVENT = "ward-flow-last-look-change";

function readStored(): string | null {
  try {
    return window.sessionStorage.getItem(LAST_LOOK_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeSnapshot(snapshot: LastLookSnapshot): void {
  try {
    window.sessionStorage.setItem(LAST_LOOK_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Private browsing or a full quota: the list simply starts fresh next time.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

let pendingLeaveSave: number | undefined;

// `null` on the server and in the hydration render, so both agree; the stored value follows.
const useStoredLastLook = createBrowserStore(subscribe, readStored, null);

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function SinceLastLookPanel({ world, now }: { world: LastLookWorld; now: Instant }) {
  const current = useMemo(() => takeLastLookSnapshot(world, now), [world, now]);
  const latest = useRef(current);
  useEffect(() => {
    latest.current = current;
  }, [current]);

  const stored = useStoredLastLook();
  const previous = useMemo(() => parseLastLookSnapshot(stored), [stored]);

  // Saved on the way out (route change, reload, tab close), never on arrival. The unmount save
  // waits one task and a remount cancels it: React's development double-mount unmounts and
  // remounts at once, and saving there would overwrite the picture before it was compared.
  useEffect(() => {
    if (pendingLeaveSave !== undefined) {
      window.clearTimeout(pendingLeaveSave);
      pendingLeaveSave = undefined;
    }
    const saveOnLeave = () => writeSnapshot(latest.current);
    window.addEventListener("pagehide", saveOnLeave);
    return () => {
      window.removeEventListener("pagehide", saveOnLeave);
      pendingLeaveSave = window.setTimeout(() => {
        pendingLeaveSave = undefined;
        saveOnLeave();
      }, 0);
    };
  }, []);

  const changes = useMemo(() => changesSinceLastLook(previous, current, world), [previous, current, world]);

  if (!changes) return null;

  const since = formatInstantWithDay(changes.since, now);

  if (!hasAnyChange(changes)) {
    return (
      <p className={styles.sinceLastLookQuiet} data-testid="ward-since-last-look">
        Nothing new since you last looked at {since}.
      </p>
    );
  }

  const delayCounts = new Map<string, number>();
  for (const delay of changes.newDelays) delayCounts.set(delay.title, (delayCounts.get(delay.title) ?? 0) + 1);
  const bedsTotal = changes.bedsFreed.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <section className={styles.sinceLastLook} aria-label="Since you last looked" data-testid="ward-since-last-look">
      <div className={styles.sinceLastLookHeader}>
        <h2>Since you last looked at {since}</h2>
        <button
          type="button"
          className={styles.clearSelectionButton}
          onClick={() => {
            writeSnapshot(current);
          }}
        >
          Mark as seen
        </button>
      </div>
      <ul className={styles.sinceLastLookList}>
        {changes.newReferralIds.length > 0 ? (
          <li data-change="referrals">{plural(changes.newReferralIds.length, "new referral", "new referrals")}</li>
        ) : null}
        {changes.newMovementIds.length > 0 ? (
          <li data-change="journeys">
            {plural(changes.newMovementIds.length, "new person", "new people")} waiting in an emergency department
          </li>
        ) : null}
        {bedsTotal > 0 ? (
          <li data-change="beds">
            {plural(bedsTotal, "bed", "beds")} newly ready:{" "}
            {changes.bedsFreed.map((entry) => `${entry.unitName} +${entry.count}`).join(", ")}
          </li>
        ) : null}
        {changes.newDelays.length > 0 ? (
          <li data-change="delays">
            {plural(changes.newDelays.length, "new delay", "new delays")}:{" "}
            {[...delayCounts].map(([title, count]) => `${title} (${count})`).join(", ")}
          </li>
        ) : null}
        {changes.newEscalationIds.length > 0 ? (
          <li data-change="escalations">
            {plural(changes.newEscalationIds.length, "new escalation", "new escalations")}: no suitable bed found in the
            network
          </li>
        ) : null}
      </ul>
    </section>
  );
}
