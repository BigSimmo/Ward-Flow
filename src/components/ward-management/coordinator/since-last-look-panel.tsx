"use client";

import { History } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { createBrowserStore } from "@/lib/client-store-factory";

import { Badge, Button, Card, CardHead, Stat, StatGroup, StatusGlyph, durMinutes, type WfTone } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";

import styles from "./home.module.css";
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

export function SinceLastLookPanel({
  world,
  now,
  activity = [],
}: {
  world: LastLookWorld;
  now: Instant;
  activity?: readonly SinceActivityLine[];
}) {
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
  const minutesAgo = Math.max(0, now - changes.since);
  const ago = minutesAgo < 1 ? "Just now" : `${durMinutes(minutesAgo)} ago`;

  if (!hasAnyChange(changes)) {
    return (
      <Card className={styles.sinceCard} data-testid="ward-since-last-look">
        <CardHead icon={History} title="Since you looked" aside={<Badge variant="mono">{ago}</Badge>} />
        <p className={styles.sinceQuiet}>
          <StatusGlyph tone="success" size={9} />
          Nothing new since you last looked at {since}.
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
      label: `${plural(changes.newMovementIds.length, "new person", "new people")} waiting in ED`,
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
    <Card className={styles.sinceCard} aria-label="Since you last looked" data-testid="ward-since-last-look">
      <CardHead
        icon={History}
        title="Since you looked"
        meta={`at ${since}`}
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
        <Button variant="sec" size="sm" onClick={() => writeSnapshot(current)}>
          Mark as seen
        </Button>
      </div>
    </Card>
  );
}
