"use client";
// Forked from src/components/ward-management/coordinator/since-last-look-band.tsx (Home redesign).

import { ChevronRight, History } from "lucide-react";

import { Badge, Button, Card, CardHead, StatusGlyph, durMinutes, type WfTone } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";

import styles from "@/components/ward-management/coordinator/home.module.css";
import { hasAnyChange, type ChangesSinceLastLook } from "@/components/ward-management/coordinator/since-last-look";
import { plural } from "@/components/ward-management/ward-plural";

import {
  acceptanceWithdrawnLinks,
  dischargeMovedLinks,
  SinceRecordLinks,
  type SinceRecordLink,
} from "@/components/ward-management/coordinator/since-last-look-links";

import local from "./home-redesign.module.css";

/**
 * Redesign: the band answers "what changed since I looked" and nothing else. The event timeline that
 * sat beside it was a second copy of the Activity drawer's feed, so it goes, and the foot opens
 * Activity itself. The three count tiles (Referrals, Beds freed, Delays) said what the lines say,
 * with zeros, so the lines alone carry the counts, each with its noun.
 */
function SinceFoot({ onMarkSeen, onOpenActivity }: { onMarkSeen?: () => void; onOpenActivity: () => void }) {
  return (
    <div className={`${styles.cardFoot} ${local.sinceFoot}`}>
      {onMarkSeen ? (
        <Button variant="sec" size="sm" onClick={onMarkSeen}>
          Mark as seen
        </Button>
      ) : (
        <span />
      )}
      <button type="button" className={local.headLink} onClick={onOpenActivity}>
        All events in Activity
        <ChevronRight size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

export function HomeSinceBand({
  changes,
  now,
  onMarkSeen,
  onOpenActivity,
}: {
  changes: ChangesSinceLastLook | undefined;
  now: Instant;
  onMarkSeen: () => void;
  /** Opens the header's Activity drawer, where every event of the day is listed. */
  onOpenActivity: () => void;
}) {
  if (!changes) {
    // A first look has nothing to compare with yet.
    return (
      <Card className={styles.sinceCard} data-testid="ward-since-last-look">
        <CardHead icon={History} title="Since you looked" aside={<Badge variant="mono">First look</Badge>} />
        <p className={styles.sinceQuiet}>
          <StatusGlyph tone="neutral" size={9} />
          New events count from your next look.
        </p>
        <SinceFoot onOpenActivity={onOpenActivity} />
      </Card>
    );
  }

  const since = formatInstantWithDay(changes.since, now);
  const minutesAgo = Math.max(0, now - changes.since);
  const ago = minutesAgo < 1 ? "Just now" : `${durMinutes(minutesAgo)} ago`;

  if (!hasAnyChange(changes)) {
    return (
      <Card className={styles.sinceCard} data-testid="ward-since-last-look">
        <CardHead icon={History} title="Since you looked" aside={<Badge variant="mono">{ago}</Badge>} />
        <p className={styles.sinceQuiet}>
          <StatusGlyph tone="success" size={9} />
          {changes.basis === "shift"
            ? `Nothing new since the shift started at ${since}.`
            : `Nothing new since you last looked at ${since}.`}
        </p>
        <SinceFoot onOpenActivity={onOpenActivity} />
      </Card>
    );
  }

  const delayCounts = new Map<string, number>();
  for (const delay of changes.newDelays) delayCounts.set(delay.title, (delayCounts.get(delay.title) ?? 0) + 1);
  const bedsTotal = changes.bedsFreed.reduce((sum, entry) => sum + entry.count, 0);
  const lines: { key: string; tone: WfTone; label: string; links?: SinceRecordLink[] }[] = [];
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
  // Closing-the-loop (package E): recorded withdrawals of a ward's "yes", and moved discharge dates.
  if (changes.acceptanceWithdrawn?.length) {
    lines.push({
      key: "acceptance-withdrawn",
      tone: "warning",
      label: plural(changes.acceptanceWithdrawn.length, "acceptance withdrawn", "acceptances withdrawn"),
      links: acceptanceWithdrawnLinks(changes),
    });
  }
  if (changes.dischargeDatesMoved?.length) {
    lines.push({
      key: "discharge-date-moved",
      tone: "info",
      label: plural(changes.dischargeDatesMoved.length, "discharge date moved", "discharge dates moved"),
      links: dischargeMovedLinks(changes),
    });
  }

  return (
    <Card className={styles.sinceCard} aria-label="Since you last looked" data-testid="ward-since-last-look">
      <CardHead
        icon={History}
        title="Since you looked"
        meta={changes.basis === "shift" ? `since the shift started at ${since}` : `at ${since}`}
        aside={<Badge variant="mono">{ago}</Badge>}
      />
      <ul className={`${styles.sinceLines} ${local.sinceLines}`}>
        {lines.map((line) => (
          <li key={line.key} className={styles.sinceLine} data-change={line.key}>
            <StatusGlyph tone={line.tone} size={9} />
            <span>{line.label}</span>
            {line.links ? <SinceRecordLinks links={line.links} label={`${line.label}: records`} /> : null}
          </li>
        ))}
      </ul>
      <SinceFoot onMarkSeen={onMarkSeen} onOpenActivity={onOpenActivity} />
    </Card>
  );
}
