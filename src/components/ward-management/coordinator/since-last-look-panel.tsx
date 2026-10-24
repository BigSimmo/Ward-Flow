"use client";

import { History } from "lucide-react";
import { useCallback, useContext, useEffect, useMemo, useRef } from "react";

import { createBrowserStore } from "@/lib/client-store-factory";

import { Badge, Button, Card, CardHead, Stat, StatGroup, StatusGlyph, durMinutes, type WfTone } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { currentShiftStartInstant } from "@/components/ward-management/ward-board-time-features";

import styles from "./home.module.css";
import {
  changesSinceInstant,
  changesSinceLastLook,
  hasAnyChange,
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

/** One line of the timeline: the bar's Activity projection (`deriveCommandActivity`). */
export type SinceActivityLine = {
  id: string;
  time: string;
  text: string;
  category?: string;
  tone: "info" | "warning" | "danger";
};

function ActivityTimeline({ lines }: { lines: readonly SinceActivityLine[] }) {
  if (lines.length === 0) return null;
  return (
    <ol className={styles.sinceTimeline} aria-label="Recent activity" data-testid="ward-since-timeline">
      {lines.map((line) => (
        <li key={line.id} className={styles.sinceEvent}>
          <span className={styles.sinceTime}>{line.time}</span>
          {/* A decline is a closed outcome: the neutral cross, never red. */}
          <StatusGlyph tone={line.category === "decline" ? "closed" : line.tone} size={9} />
          <span className={styles.sinceText}>{line.text}</span>
        </li>
      ))}
    </ol>
  );
}

/** Total new things since the last look, for the hero's "New events" count. */
export function sinceLastLookCount(changes: ChangesSinceLastLook | undefined): number {
  if (!changes) return 0;
  return (
    changes.newReferralIds.length +
    changes.newMovementIds.length +
    changes.bedsFreed.reduce((sum, entry) => sum + entry.count, 0) +
    changes.newDelays.length +
    changes.newEscalationIds.length
  );
}

/**
 * Remembers the picture when the coordinator leaves Home and compares it with now. Lives on the
 * screen, not the panel, so the hero can count new events while the panel itself is closed.
 */
export function useSinceLastLook(world: LastLookWorld, now: Instant) {
  const thresholds = useDueSoonThresholds();
  const generation = useOptionalWardFlowSelect("worldGeneration")?.worldGeneration ?? world.worldGeneration ?? 0;
  const account = useContext(SharedAccessContext);
  const userId = account?.actorId ?? "local-demo";
  const current = useMemo(
    () => takeLastLookSnapshot({ ...world, worldGeneration: generation, userId }, now, thresholds),
    [world, now, thresholds, generation, userId],
  );
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

  // Before any look this session, count what the record says happened since the shift started, so
  // "N new since 07:00" is true rather than a 0 (L1, site review, 12 Oct 2026).
  const changes = useMemo(
    () =>
      changesSinceLastLook(previous, current, world) ?? changesSinceInstant(world, currentShiftStartInstant(now), now),
    [previous, current, world, now],
  );
  const markSeen = useCallback(() => writeSnapshot(latest.current), []);
  return { changes, markSeen };
}

/** One group row of the phone sheet: a glyph, a bold count line, and a quiet detail line. */
type SinceGroup = { key: string; tone: WfTone; title: string; detail?: string };

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
  const bedsTotal = changes.bedsFreed.reduce((sum, entry) => sum + entry.count, 0);
  if (changes.newReferralIds.length > 0) {
    groups.push({
      key: "referrals",
      tone: "info",
      title: plural(changes.newReferralIds.length, "new referral", "new referrals"),
    });
  }
  if (changes.newMovementIds.length > 0) {
    groups.push({ key: "journeys", tone: "neutral", title: `${changes.newMovementIds.length} new ED journeys` });
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

export function SinceLastLookPanel({
  changes,
  now,
  activity = [],
  onMarkSeen,
  placement = "column",
}: {
  changes: ChangesSinceLastLook | undefined;
  now: Instant;
  activity?: readonly SinceActivityLine[];
  onMarkSeen: () => void;
  /** `band`: opened from the hero's New events count. `column`: the phone card under the queue. */
  placement?: "band" | "column";
}) {
  if (!changes && placement === "band") {
    // A first look has nothing to compare with yet; the recent activity still reads.
    return (
      <Card className={styles.sinceCard} data-placement={placement} data-testid="ward-since-last-look">
        <CardHead icon={History} title="Since you looked" aside={<Badge variant="mono">First look</Badge>} />
        <p className={styles.sinceQuiet}>
          <StatusGlyph tone="neutral" size={9} />
          New events count from your next look.
        </p>
        <ActivityTimeline lines={activity} />
      </Card>
    );
  }
  if (!changes) return null;

  const since = formatInstantWithDay(changes.since, now);
  const minutesAgo = Math.max(0, now - changes.since);
  const ago = minutesAgo < 1 ? "Just now" : `${durMinutes(minutesAgo)} ago`;

  if (!hasAnyChange(changes)) {
    return (
      <Card className={styles.sinceCard} data-placement={placement} data-testid="ward-since-last-look">
        <CardHead icon={History} title="Since you looked" aside={<Badge variant="mono">{ago}</Badge>} />
        <p className={styles.sinceQuiet}>
          <StatusGlyph tone="success" size={9} />
          {changes.basis === "shift"
            ? `Nothing new since the shift started at ${since}.`
            : `Nothing new since you last looked at ${since}.`}
        </p>
        <ActivityTimeline lines={activity} />
      </Card>
    );
  }

  const delayCounts = new Map<string, number>();
  for (const delay of changes.newDelays) delayCounts.set(delay.title, (delayCounts.get(delay.title) ?? 0) + 1);
  const bedsTotal = changes.bedsFreed.reduce((sum, entry) => sum + entry.count, 0);
  const lines: { key: string; tone: WfTone; label: string }[] = [];
  if (changes.newReferralIds.length > 0) {
    lines.push({
      key: "referrals",
      tone: "info",
      label: plural(changes.newReferralIds.length, "new referral", "new referrals"),
    });
  }
  if (changes.newMovementIds.length > 0) {
    lines.push({
      key: "journeys",
      tone: "neutral",
      label: `${plural(changes.newMovementIds.length, "new person", "new people")} with new open ED journeys`,
    });
  }
  if (bedsTotal > 0) {
    lines.push({
      key: "beds",
      tone: "success",
      label: `${plural(bedsTotal, "bed", "beds")} newly ready: ${changes.bedsFreed
        .map((entry) => `${entry.unitName} +${entry.count}`)
        .join(", ")}`,
    });
  }
  if (changes.newDelays.length > 0) {
    lines.push({
      key: "delays",
      tone: "warning",
      label: `${plural(changes.newDelays.length, "new delay", "new delays")}: ${[...delayCounts]
        .map(([title, count]) => `${title} (${count})`)
        .join(", ")}`,
    });
  }
  if (changes.newEscalationIds.length > 0) {
    lines.push({
      key: "escalations",
      tone: "warning",
      label: `${plural(changes.newEscalationIds.length, "new escalation", "new escalations")}: no suitable bed`,
    });
  }

  return (
    <Card
      className={styles.sinceCard}
      data-placement={placement}
      aria-label="Since you last looked"
      data-testid="ward-since-last-look"
    >
      <CardHead
        icon={History}
        title="Since you looked"
        meta={changes.basis === "shift" ? `since the shift started at ${since}` : `at ${since}`}
        aside={<Badge variant="mono">{ago}</Badge>}
      />
      <StatGroup className={styles.sinceStats}>
        <Stat value={changes.newReferralIds.length} label="Referrals" tone="info" size="sm" />
        <Stat value={bedsTotal} label="Beds freed" tone="success" size="sm" />
        <Stat value={changes.newDelays.length} label="Delays" tone="warning" size="sm" />
      </StatGroup>
      <ul className={styles.sinceLines}>
        {lines.map((line) => (
          <li key={line.key} className={styles.sinceLine} data-change={line.key}>
            <StatusGlyph tone={line.tone} size={9} />
            <span>{line.label}</span>
          </li>
        ))}
      </ul>
      <ActivityTimeline lines={activity} />
      <div className={styles.cardFoot}>
        <Button variant="sec" size="sm" onClick={onMarkSeen}>
          Mark as seen
        </Button>
      </div>
    </Card>
  );
}
