"use client";

import { useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import { StatusGlyph, durMinutes, type WfTone } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { currentShiftStartInstant } from "@/components/ward-management/ward-board-time-features";

import styles from "./home.module.css";
import { onWardSessionEnd } from "@/components/ward-management/ward-browser-data";
import {
  changesSinceInstant,
  scopedChangesSinceLastLook,
  scopeLastLookWorld,
  changesSinceLastLook,
  LAST_LOOK_STORAGE_KEY,
  parseLastLookSnapshot,
  takeLastLookSnapshot,
  type ChangesSinceLastLook,
  type LastLookSnapshot,
  type LastLookWorld,
} from "./since-last-look";
import {
  acceptanceWithdrawnLinks,
  dischargeMovedLinks,
  SinceRecordLinks,
  type SinceRecordLink,
} from "./since-last-look-links";

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
  try {
    window.sessionStorage.setItem(key, JSON.stringify(snapshot));
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

const pendingLeaveSaves = new Map<string, number>();
// Audit 4 A4-07: a leave-save scheduled as the signed-in screen closes ran after the sign-out
// sweep and left this picture behind. Each session end moves this on, and a save from before stops.
let sessionEpoch = 0;
onWardSessionEnd(() => {
  sessionEpoch += 1;
});

const serverLastLook = () => null;

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

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
  options?: { scopeKey: string; windowMinutes?: number },
) {
  const scopeKey = options?.scopeKey;
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
  const storageKey = scopeKey
    ? `${LAST_LOOK_STORAGE_KEY}:${scopeKey}:${encodeURIComponent(userId)}:${encodeURIComponent(world.scenario)}:${generation}`
    : LAST_LOOK_STORAGE_KEY;
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
    if (scopeKey) return;
    const epoch = sessionEpoch;
    const saveOnLeave = () => {
      // A cleanup from another account/world must never write that world's picture.
      const snapshot = latest.current;
      if (
        epoch === sessionEpoch &&
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
  }, [storageKey, userId, generation, scopeKey]);

  // Before any look this session, count what the record says happened since the shift started, so
  // "N new since 07:00" is true rather than a 0 (L1, site review, 12 Oct 2026).
  const changes = useMemo(
    () =>
      scopeKey
        ? scopedChangesSinceLastLook(previous, current, windowMinutes)
        : (changesSinceLastLook(previous, current, world) ??
          changesSinceInstant(world, currentShiftStartInstant(now), now)),
    [previous, current, world, now, scopeKey, windowMinutes],
  );
  const markSeen = useCallback(() => writeSnapshot(latest.current, storageKey), [storageKey]);
  return { changes, markSeen };
}

/** One group row of the phone sheet: a glyph, a bold count line, and a quiet detail line. */
type SinceGroup = { key: string; tone: WfTone; title: string; detail?: string; links?: SinceRecordLink[] };

/** The phone sheet's quiet line under its title: when the last look was, and how long ago. */
export function sinceSheetDescription(changes: ChangesSinceLastLook | undefined, now: Instant): string {
  if (!changes) return "First look this session";
  if (changes.basis === "shift")
    return `First look this session. Counted from the shift start, ${formatInstantWithDay(changes.since, now)}`;
  const minutesAgo = Math.max(0, now - changes.since);
  const ago = minutesAgo < 1 ? "just now" : `${durMinutes(minutesAgo)} ago`;
  return `Your last visit ${formatInstantWithDay(changes.since, now)}, ${ago}`;
}

function sinceGroups(changes: ChangesSinceLastLook): SinceGroup[] {
  const groups: SinceGroup[] = [];
  for (const [kind, label] of [
    ["referral", "referral"],
    ["movement", "journey"],
    ["release", "bed release"],
  ] as const) {
    const count = changes.updates?.filter((update) => update.kind === kind).length ?? 0;
    if (count) groups.push({ key: kind, tone: "info", title: `${plural(count, label, `${label}s`)} updated` });
  }
  const bedsTotal = changes.bedsFreed.reduce((sum, entry) => sum + entry.count, 0);
  if (changes.newReferralIds.length > 0) {
    groups.push({
      key: "referrals",
      tone: "info",
      title: plural(changes.newReferralIds.length, "new referral", "new referrals"),
    });
  }
  if (changes.newMovementIds.length > 0) {
    groups.push({ key: "journeys", tone: "neutral", title: `${changes.newMovementIds.length} new in ED` });
  }
  if (bedsTotal > 0) {
    groups.push({
      key: "beds",
      tone: "success",
      title: `${bedsTotal} ${bedsTotal === 1 ? "bed" : "beds"} freed`,
      detail: changes.bedsFreed.map((entry) => `${entry.count} at ${entry.unitName}`).join(", "),
    });
  }
  if (changes.newDelays.length > 0) {
    const delayCounts = new Map<string, number>();
    for (const delay of changes.newDelays) delayCounts.set(delay.title, (delayCounts.get(delay.title) ?? 0) + 1);
    groups.push({
      key: "delays",
      tone: "warning",
      title: plural(changes.newDelays.length, "new delay", "new delays"),
      detail: [...delayCounts].map(([title, count]) => `${title}, ${count}`).join(" · "),
    });
  }
  if (changes.newEscalationIds.length > 0) {
    groups.push({
      key: "escalations",
      tone: "warning",
      title: plural(changes.newEscalationIds.length, "new escalation", "new escalations"),
      detail: "No suitable bed",
    });
  }
  groups.push(...closingLoopGroups(changes));
  return groups;
}

/** Closing-the-loop (package E): acceptances withdrawn and discharge dates moved, by ward name. */
function closingLoopGroups(changes: ChangesSinceLastLook): SinceGroup[] {
  const groups: SinceGroup[] = [];
  const wards = (rows: readonly { unitName?: string }[]) =>
    [...new Set(rows.flatMap((row) => (row.unitName ? [row.unitName] : [])))].join(", ") || undefined;
  const withdrawn = changes.acceptanceWithdrawn ?? [];
  if (withdrawn.length > 0) {
    groups.push({
      key: "acceptance-withdrawn",
      tone: "warning",
      title: plural(withdrawn.length, "acceptance withdrawn", "acceptances withdrawn"),
      detail: wards(withdrawn),
      links: acceptanceWithdrawnLinks(changes),
    });
  }
  const moved = changes.dischargeDatesMoved ?? [];
  if (moved.length > 0) {
    groups.push({
      key: "discharge-date-moved",
      tone: "info",
      title: plural(moved.length, "discharge date moved", "discharge dates moved"),
      detail: wards(moved),
      links: dischargeMovedLinks(changes),
    });
  }
  return groups;
}

/**
 * Phone sheet body (v10 Home phone, "Since you looked"): one card of group rows, each a glyph,
 * a bold count and a quiet detail line. The sheet's own title and description carry the time.
 * A look with nothing new says so in one line; a first look says new events count from the next
 * look. The event-by-event list lives in Activity, never here (it named records by id and read as
 * news under "Nothing new").
 */
export function SinceLastLookSheetBody({
  changes,
}: {
  changes: ChangesSinceLastLook | undefined;
  /** Accepted for the band panel's signature; the phone sheet lists counts only. */
  activity?: readonly SinceActivityLine[];
}) {
  const groups = changes ? sinceGroups(changes) : [];
  const rows: SinceGroup[] =
    groups.length > 0
      ? groups
      : [
          {
            key: "quiet",
            tone: changes ? "success" : "neutral",
            title: !changes
              ? "New events count from your next look"
              : changes.basis === "shift"
                ? "Nothing new since the shift started"
                : "Nothing new since you last looked",
            detail: !changes || changes.basis === "shift" ? "This is your first look this session" : undefined,
          },
        ];
  return (
    <ul className={styles.sinceSheetList} data-testid="ward-since-last-look" aria-label="Since you last looked">
      {rows.map((row) => (
        <li key={row.key} className={styles.sinceSheetRow} data-change={row.key}>
          <StatusGlyph tone={row.tone} size={10} />
          <span className={styles.sinceSheetText}>
            <span className={styles.sinceSheetTitle}>{row.title}</span>
            {row.detail ? <span className={styles.sinceSheetDetail}>{row.detail}</span> : null}
            {row.links ? <SinceRecordLinks links={row.links} label={`${row.title}: records`} /> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The phone sheet's digest as plain handover text, one line per group. */
export function sinceHandoverText(changes: ChangesSinceLastLook | undefined, now: Instant): string {
  const head = `Since you looked: ${sinceSheetDescription(changes, now)}`;
  const groups = changes ? sinceGroups(changes) : [];
  if (groups.length === 0) return `${head}\n${changes ? "Nothing new." : "First look this session."}`;
  return [head, ...groups.map((group) => (group.detail ? `${group.title}: ${group.detail}` : group.title))].join("\n");
}
