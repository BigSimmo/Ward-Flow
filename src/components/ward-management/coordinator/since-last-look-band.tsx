"use client";

import { History } from "lucide-react";

import { Badge, Button, Card, CardHead, Stat, StatGroup, StatusGlyph, durMinutes, type WfTone } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";

import styles from "./home.module.css";
import { hasAnyChange, type ChangesSinceLastLook } from "./since-last-look";
import { plural, type SinceActivityLine } from "./since-last-look-panel";

/*
 * Phone budget (21 October 2026): the desktop "Since you last looked" band only draws when its hero
 * count is opened, so it lives apart from `useSinceLastLook` and Home loads it lazily
 * (since-last-look-band-lazy.tsx).
 */

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
