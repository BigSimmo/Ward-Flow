"use client";

import { readWardAccessSnapshot, useWardAccessSnapshot } from "@/components/ward-management/shell/ward-access-store";
import { useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import type { Instant } from "@/components/ward-management/ward-clock";

import {
  noteWardSessionAccount,
  wardLeaveSaveAllowed,
  wardLeaveSaveTicket,
} from "@/components/ward-management/ward-browser-data";
import {
  changesForStoredLook,
  scopedChangesSinceLastLook,
  scopeLastLookWorld,
  LAST_LOOK_STORAGE_KEY,
  parseLastLookSnapshot,
  takeLastLookSnapshot,
  type ChangesSinceLastLook,
  type LastLookSnapshot,
  type LastLookWorld,
} from "./since-last-look";

import { SharedAccessContext } from "@/components/ward-management/shell/ward-shared-access-context";
import { useOptionalWardFlowSelect, useDueSoonThresholds } from "@/components/ward-management/ward-flow-provider";
/**
 * Smart feature 9: the short "Since you last looked" notice at the top of the Command screen. The
 * comparison lives in `since-last-look.ts`; this file only remembers when the coordinator left and
 * shows the difference when they come back.
 *
 * The picture is saved when the coordinator LEAVES the screen (or presses "Mark as seen"), not when
 * they arrive, so their own actions on this screen are not reported back to them as news.
 */

/** Fired after a same-tab write; the native `storage` event only reaches other tabs. */
const CHANGE_EVENT = "ward-flow-last-look-change";

function readStored(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSnapshot(snapshot: LastLookSnapshot, key: string): void {
  if (readWardAccessSnapshot().previewOf !== null) return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(snapshot));
  } catch {
    // Private browsing or a full quota: the list simply starts fresh next time.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function clearSnapshot(key: string): void {
  if (readWardAccessSnapshot().previewOf !== null) return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Nothing stored to clear.
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

const pendingLeaveSaves = new Map<string, number>();

const serverLastLook = () => null;

/** One line of the timeline: the bar's Activity projection (`deriveCommandActivity`). */
export type SinceActivityLine = {
  id: string;
  time: string;
  text: string;
  category?: string;
  tone: "info" | "warning" | "danger";
};

/** Total new things since the last look, for the hero's "New events" count. */
export function sinceLastLookCount(changes: ChangesSinceLastLook | undefined): number {
  if (!changes) return 0;
  return (
    changes.newReferralIds.length +
    changes.newMovementIds.length +
    changes.bedsFreed.reduce((sum, entry) => sum + entry.count, 0) +
    changes.newDelays.length +
    changes.newEscalationIds.length +
    (changes.acceptanceWithdrawn?.length ?? 0) +
    (changes.dischargeDatesMoved?.length ?? 0) +
    (changes.updates?.length ?? 0)
  );
}

/**
 * Remembers the picture when the coordinator leaves Home and compares it with now. Lives on the
 * screen, not the panel, so the hero can count new events while the panel itself is closed.
 */
export function useSinceLastLook(
  passedWorld: LastLookWorld,
  now: Instant,
  options?: { scopeKey?: string; windowMinutes?: number; explicit?: boolean },
) {
  const scopeKey = options?.scopeKey;
  const preview = useWardAccessSnapshot().previewOf !== null;
  // Home's Activity panel (Josh, 30 Oct 2026): review is explicit, so leaving the screen saves nothing.
  const explicit = options?.explicit ?? false;
  const windowMinutes = options?.windowMinutes ?? 15;
  // Closing-the-loop (package E): "discharge date moved" reads the stays from the store when the
  // caller's world does not carry them.
  const storeAdmissions = useOptionalWardFlowSelect("admissions")?.admissions;
  const world = useMemo(
    () => (passedWorld.admissions || !storeAdmissions ? passedWorld : { ...passedWorld, admissions: storeAdmissions }),
    [passedWorld, storeAdmissions],
  );
  const scoped = useMemo(() => (scopeKey ? scopeLastLookWorld(world, scopeKey) : world), [world, scopeKey]);
  const thresholds = useDueSoonThresholds();
  const generation = useOptionalWardFlowSelect("worldGeneration")?.worldGeneration ?? world.worldGeneration ?? 0;
  const account = useContext(SharedAccessContext);
  const userId = account?.actorId ?? "local-demo";
  noteWardSessionAccount(account);
  const baseStorageKey = scopeKey
    ? `${LAST_LOOK_STORAGE_KEY}:${scopeKey}:${encodeURIComponent(userId)}:${encodeURIComponent(world.scenario)}:${generation}`
    : LAST_LOOK_STORAGE_KEY;
  const storageKey = account?.scopeKey
    ? `${baseStorageKey}:desk:${account.scopeKey}:${encodeURIComponent(userId)}:${encodeURIComponent(world.scenario)}:${generation}`
    : baseStorageKey;

  const current = useMemo(
    () => takeLastLookSnapshot({ ...scoped, worldGeneration: generation, userId }, now, thresholds, scopeKey),
    [scoped, now, thresholds, generation, userId, scopeKey],
  );
  const latest = useRef(current);
  useEffect(() => {
    latest.current = current;
  }, [current]);

  const read = useCallback(() => readStored(storageKey), [storageKey]);
  const stored = useSyncExternalStore(subscribe, read, serverLastLook);
  const previous = useMemo(() => parseLastLookSnapshot(stored), [stored]);

  // Coordinator pictures are saved on the way out; scoped Ward/ED pictures only on explicit review.
  // Navigating away must preserve their unread updates. The coordinator unmount save
  // waits one task and a remount cancels it: React's development double-mount unmounts and
  // remounts at once, and saving there would overwrite the picture before it was compared.
  useEffect(() => {
    const timer = pendingLeaveSaves.get(storageKey);
    if (timer !== undefined) window.clearTimeout(timer);
    pendingLeaveSaves.delete(storageKey);
    if (scopeKey || explicit || preview) return;
    const ticket = wardLeaveSaveTicket(account);
    const saveOnLeave = () => {
      // A cleanup from another account/world must never write that world's picture, and none may
      // write after its session ended, even one scheduled by a signed-out re-render (A4-07).
      const snapshot = latest.current;
      if (
        wardLeaveSaveAllowed(ticket) &&
        snapshot.userId === userId &&
        snapshot.worldGeneration === generation &&
        snapshot.scopeKey === scopeKey
      )
        writeSnapshot(snapshot, storageKey);
    };
    window.addEventListener("pagehide", saveOnLeave);
    return () => {
      window.removeEventListener("pagehide", saveOnLeave);
      pendingLeaveSaves.set(
        storageKey,
        window.setTimeout(() => {
          pendingLeaveSaves.delete(storageKey);
          saveOnLeave();
        }, 0),
      );
    };
  }, [storageKey, userId, generation, scopeKey, account, explicit, preview]);

  // Before any usable look, count what the record says happened in the shift window, so "N new
  // since 07:00" is true rather than a 0 (L1, site review, 12 Oct 2026). Audit L4, D-210 (Josh,
  // 14 Nov 2026): the same review test and window as the Activity panel (`changesForStoredLook`).
  const changes = useMemo(
    () =>
      scopeKey
        ? scopedChangesSinceLastLook(previous, current, windowMinutes)
        : changesForStoredLook(previous, current, world, now),
    [previous, current, world, now, scopeKey, windowMinutes],
  );
  const markSeen = useCallback(() => {
    if (!preview) writeSnapshot(latest.current, storageKey);
  }, [storageKey, preview]);
  /** Explicit review: save a given picture (the one taken when Activity opened), or clear it. */
  const saveReview = useCallback(
    (snapshot: LastLookSnapshot | undefined) => {
      // A press from a screen whose session has ended (A4-07) writes nothing.
      if (preview || !wardLeaveSaveAllowed(wardLeaveSaveTicket(account))) return;
      if (snapshot) writeSnapshot(snapshot, storageKey);
      else clearSnapshot(storageKey);
    },
    [storageKey, account, preview],
  );
  return { changes, markSeen, previous, current, saveReview };
}
